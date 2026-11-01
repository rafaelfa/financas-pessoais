/**
 * T11 — provas contra a base de teste.
 *
 * 1. O tipo de uma conta a pagar/receber não muda (400 e base intacta); com o
 *    mesmo tipo, a edição passa.
 * 2. Editar um grupo de 2 para 3 contas deixa exatamente 3 itens.
 * 3. Editar um grupo enviando uma conta alheia é recusado e o grupo fica
 *    intacto (os itens antigos não são apagados antes de validar).
 *
 * Verificação sempre por SQL, nunca pelo código HTTP.
 *
 * Uso (servidor na :3000, `.env` do ramo de teste):
 *
 *   node --env-file=.env relatorios/T11-provas.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { Client } = require('pg');

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.BETTER_AUTH_URL ?? BASE;
const TEST_ENDPOINT = 'ep-spring-mud-b11fe546';
const stamp = Date.now();

const userA = { email: `qa.t11.a.${stamp}@example.test`, password: `Qa!T11-${stamp}` };
const userB = { email: `qa.t11.b.${stamp}@example.test`, password: `Qa!T11-${stamp}` };

function abort(msg) {
  console.error(`ABORTADO: ${msg}`);
  process.exit(2);
}

if (!process.env.DATABASE_URL) abort('falta DATABASE_URL (--env-file=.env)');
if (!process.env.DATABASE_URL.includes(TEST_ENDPOINT)) {
  abort(`o DATABASE_URL não é o ramo de teste ${TEST_ENDPOINT}`);
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const q = async (sql, params = []) => (await db.query(sql, params)).rows;

async function signUp(user, name) {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: user.email, password: user.password, name }),
  });
  if (!res.ok) abort(`sign-up ${user.email}: ${res.status} ${await res.text()}`);
}

async function signIn(user) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!res.ok) abort(`sign-in ${user.email}: ${res.status}`);
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie) abort(`sign-in ${user.email} sem cookie`);
  return cookie;
}

async function api(cookie, path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

const resultados = [];
function regista(nome, ok, detalhe) {
  resultados.push({ nome, ok });
  console.log(`${ok ? 'PASSA ' : 'FALHA '} ${nome} — ${JSON.stringify(detalhe)}`);
}

try {
  await signUp(userA, 'QA T11 A');
  await signUp(userB, 'QA T11 B');
  const cookieA = await signIn(userA);
  await signIn(userB);

  const [a] = await q('select id from "user" where email = $1', [userA.email]);
  const [b] = await q('select id from "user" where email = $1', [userB.email]);
  if (!a || !b) abort('utilizadores não criados');

  // A: duas contas ativas + uma arquivada (para o filtro do formulário)
  await q(
    `insert into financial_account (id, "userId", type, name, "openingBalanceInCents", currency, origin, "createdAt", "updatedAt", "archivedAt")
     values (gen_random_uuid()::text, $1, 'CHECKING', 'QA T11 Activa 1', 0, 'EUR', 'MANUAL', now(), now(), null),
            (gen_random_uuid()::text, $1, 'CHECKING', 'QA T11 Activa 2', 0, 'EUR', 'MANUAL', now(), now(), null),
            (gen_random_uuid()::text, $1, 'SAVINGS',  'QA T11 Arquiva', 0, 'EUR', 'MANUAL', now(), now(), now())`,
    [a.id],
  );
  const contasA = await q(
    'select id, name, "archivedAt" from financial_account where "userId" = $1 and name like $2 order by name',
    [a.id, 'QA T11 %'],
  );
  const ativasA = contasA.filter((c) => c.name.startsWith('QA T11 Activa'));
  const arquivadaA = contasA.find((c) => c.archivedAt !== null);
  const [contaB] = await q('select id from financial_account where "userId" = $1', [b.id]);
  if (ativasA.length !== 2 || !arquivadaA || !contaB) abort('contas de teste em falta');

  // ---------- 1. tipo imutável ----------
  const criada = await api(cookieA, '/api/receivable-payable', 'POST', {
    type: 'PAYABLE',
    description: `QA T11 conta ${stamp}`,
    amountInCents: 1234,
    dueDate: '2026-11-01',
  });
  const [conta] = await q(
    'select id, type, description from receivable_payable where "userId" = $1 and description = $2',
    [a.id, `QA T11 conta ${stamp}`],
  );
  if (!conta)
    abort(`a conta a pagar não foi criada (${criada.status}: ${JSON.stringify(criada.body)})`);

  const mudarTipo = await api(cookieA, '/api/receivable-payable', 'PUT', {
    id: conta.id,
    type: 'RECEIVABLE',
    description: `QA T11 conta ${stamp}`,
    amountInCents: 1234,
    dueDate: '2026-11-01',
  });
  const [depoisDoTipo] = await q('select type, description from receivable_payable where id = $1', [
    conta.id,
  ]);
  regista(
    'editar o tipo devolve 400 com a mensagem e não muda a base',
    mudarTipo.status === 400 &&
      mudarTipo.body?.error === 'O tipo de uma conta não pode ser alterado.' &&
      depoisDoTipo.type === 'PAYABLE',
    { status: mudarTipo.status, erro: mudarTipo.body?.error, tipo_na_base: depoisDoTipo.type },
  );

  const mesmoTipo = await api(cookieA, '/api/receivable-payable', 'PUT', {
    id: conta.id,
    type: 'PAYABLE',
    description: `QA T11 conta editada ${stamp}`,
    amountInCents: 2500,
    dueDate: '2026-11-02',
  });
  const [depoisDoMesmoTipo] = await q(
    'select type, description, "amountInCents" from receivable_payable where id = $1',
    [conta.id],
  );
  regista(
    'editar com o mesmo tipo continua a funcionar',
    mesmoTipo.status === 200 &&
      depoisDoMesmoTipo.type === 'PAYABLE' &&
      depoisDoMesmoTipo.description === `QA T11 conta editada ${stamp}` &&
      depoisDoMesmoTipo.amountInCents === 2500,
    {
      status: mesmoTipo.status,
      tipo: depoisDoMesmoTipo.type,
      descricao: depoisDoMesmoTipo.description,
      valor: depoisDoMesmoTipo.amountInCents,
    },
  );

  // ---------- 2. grupo 2 → 3 contas ----------
  const criar = await api(cookieA, '/api/account-group', 'POST', {
    name: `QA T11 grupo ${stamp}`,
    accountIds: ativasA.map((c) => c.id),
  });
  const [grupo] = await q('select id from account_group where "userId" = $1 and name = $2', [
    a.id,
    `QA T11 grupo ${stamp}`,
  ]);
  if (!grupo) abort(`grupo não criado (${criar.status})`);

  const itens = async () =>
    q(
      `select i."financialAccountId", fa."userId" as dono
         from account_group_item i join financial_account fa on fa.id = i."financialAccountId"
        where i."accountGroupId" = $1 order by i."financialAccountId"`,
      [grupo.id],
    );

  const dois = await itens();
  const tresContas = contasA.map((c) => c.id); // inclui a arquivada: o update não a filtra por design
  const passarParaTres = await api(cookieA, '/api/account-group', 'PUT', {
    id: grupo.id,
    name: `QA T11 grupo ${stamp}`,
    accountIds: tresContas,
  });
  const depoisDeTres = await itens();
  const pedidos = new Set(tresContas);
  const devolvidos = new Set(depoisDeTres.map((i) => i.financialAccountId));
  regista(
    'editar o grupo de 2 para 3 contas deixa exatamente 3 itens, sem duplicados',
    passarParaTres.status === 200 &&
      dois.length === 2 &&
      depoisDeTres.length === 3 &&
      devolvidos.size === 3 &&
      [...pedidos].every((id) => devolvidos.has(id)),
    { status: passarParaTres.status, antes: dois.length, depois: depoisDeTres.length },
  );

  // ---------- 3. conta alheia no update: recusa e grupo intacto ----------
  const antesDoAtaque = await itens();
  const comAlheia = await api(cookieA, '/api/account-group', 'PUT', {
    id: grupo.id,
    name: `QA T11 grupo ${stamp}`,
    accountIds: [...ativasA.map((c) => c.id), contaB.id],
  });
  const depoisDoAtaque = await itens();
  const mesmosItens =
    antesDoAtaque.length === depoisDoAtaque.length &&
    antesDoAtaque.every((antes) =>
      depoisDoAtaque.some((depois) => depois.financialAccountId === antes.financialAccountId),
    );
  regista(
    'editar com conta alheia devolve 400 e deixa o grupo intacto',
    comAlheia.status === 400 && mesmosItens && depoisDoAtaque.every((i) => i.dono === a.id),
    {
      status: comAlheia.status,
      erro: comAlheia.body?.error,
      antes: antesDoAtaque.length,
      depois: depoisDoAtaque.length,
    },
  );

  // ---------- 4. a arquivada não entra numa criação pela interface ----------
  // (o filtro da UI é provado à parte, no browser; aqui garante-se que o servidor
  // aceita a conta arquivada quando o pedido legítimo a inclui, para não falsear)
  const arquivada = arquivadaA;
  const [itemArquivada] = await q(
    'select id from account_group_item where "accountGroupId" = $1 and "financialAccountId" = $2',
    [grupo.id, arquivada.id],
  );
  regista(
    'a conta arquivada é uma conta da utilizadora (entra no grupo quando pedida)',
    Boolean(itemArquivada),
    { conta: arquivada.name, item: itemArquivada ? itemArquivada.id : null },
  );
} finally {
  try {
    await q(
      'delete from account_group where "userId" in (select id from "user" where email = any($1))',
      [[userA.email, userB.email]],
    );
    await q('delete from "user" where email = any($1)', [[userA.email, userB.email]]);
  } catch (erro) {
    console.error('aviso: limpeza falhou —', erro.message);
  }
  await db.end();
}

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram`);
process.exit(falhas.length === 0 ? 0 : 1);
