/**
 * T13 — provas adicionais depois da correção (tentativas de furar o guard).
 *
 * Complementa `T13-prova-autorizacao.mjs`: aqui tentam-se os casos que o teste
 * original não cobre — id inexistente, mistura de conta própria com conta alheia,
 * o mesmo id repetido, `accountIds: []` explícito — e os caminhos legítimos, com
 * verificação **por SQL** (não pelo código HTTP) do que ficou na base.
 *
 * Uso (servidor de produção na :3000, `.env` do ramo de teste):
 *
 *   node --env-file=.env relatorios/T13-provas-adicionais.mjs
 *
 * Sai com 0 se todos os casos se comportarem como esperado; 1 se alguma conta
 * alheia entrar num grupo ou se um caso legítimo deixar de funcionar.
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { Client } = require('pg');

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.BETTER_AUTH_URL ?? BASE;
const TEST_ENDPOINT = 'ep-spring-mud-b11fe546';
const stamp = Date.now();

const userA = { email: `qa.t13x.a.${stamp}@example.test`, password: `Qa!T13x-${stamp}` };
const userB = { email: `qa.t13x.b.${stamp}@example.test`, password: `Qa!T13x-${stamp}` };

function abort(msg) {
  console.error(`ABORTADO: ${msg}`);
  process.exit(2);
}

if (!process.env.DATABASE_URL) abort('falta DATABASE_URL (corre com --env-file=.env)');
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

async function criarGrupo(cookie, body) {
  const res = await fetch(`${BASE}/api/account-group`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN, Cookie: cookie },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, body: json };
}

async function grupoPorNome(userId, nome) {
  const [grupo] = await q('select id, name from account_group where "userId" = $1 and name = $2', [
    userId,
    nome,
  ]);
  if (!grupo) return { existe: false, itens: [] };
  const itens = await q(
    `select i."financialAccountId", fa."userId" as dono, fa.name
       from account_group_item i
       join financial_account fa on fa.id = i."financialAccountId"
      where i."accountGroupId" = $1`,
    [grupo.id],
  );
  return { existe: true, id: grupo.id, itens };
}

const resultados = [];
function regista(nome, ok, detalhe) {
  resultados.push({ nome, ok });
  console.log(`${ok ? 'PASSA ' : 'FALHA '} ${nome} — ${JSON.stringify(detalhe)}`);
}

try {
  await signUp(userA, 'QA T13x A');
  await signUp(userB, 'QA T13x B');
  const cookieA = await signIn(userA);
  await signIn(userB); // garante que B também entra (sessão válida)

  const [a] = await q('select id from "user" where email = $1', [userA.email]);
  const [b] = await q('select id from "user" where email = $1', [userB.email]);
  if (!a || !b) abort('utilizadores não criados');

  // A precisa de duas contas próprias
  await q(
    `insert into financial_account (id, "userId", type, name, "openingBalanceInCents", currency, origin, "createdAt", "updatedAt")
     values (gen_random_uuid()::text, $1, 'CHECKING', 'QA T13x Activa 1', 0, 'EUR', 'MANUAL', now(), now()),
            (gen_random_uuid()::text, $1, 'CHECKING', 'QA T13x Activa 2', 0, 'EUR', 'MANUAL', now(), now())`,
    [a.id],
  );
  const contasA = await q(
    'select id, name from financial_account where "userId" = $1 order by name',
    [a.id],
  );
  const [contaB] = await q(
    'select id, name from financial_account where "userId" = $1 order by "createdAt" limit 1',
    [b.id],
  );
  if (contasA.length < 3 || !contaB) abort('contas de teste em falta');

  const nome = (sufixo) => `QA T13x ${sufixo} ${stamp}`;
  const totalGruposA = async () =>
    (await q('select count(*)::int as n from account_group where "userId" = $1', [a.id]))[0].n;
  const gruposAntes = await totalGruposA();

  // ---- 1. id inexistente ----
  const inexistente = '00000000-0000-4000-8000-000000000000';
  let r = await criarGrupo(cookieA, { name: nome('inexistente'), accountIds: [inexistente] });
  let g = await grupoPorNome(a.id, nome('inexistente'));
  regista('id inexistente é recusado e não cria grupo', r.status === 400 && !g.existe, {
    status: r.status,
    erro: r.body?.error,
    grupo: g.existe,
  });

  // ---- 2. mistura: conta própria + conta alheia ----
  r = await criarGrupo(cookieA, {
    name: nome('mistura'),
    accountIds: [contasA[0].id, contaB.id],
  });
  g = await grupoPorNome(a.id, nome('mistura'));
  regista(
    'mistura própria+alheia é recusada e não cria grupo nem metade das linhas',
    r.status === 400 && !g.existe,
    { status: r.status, erro: r.body?.error, grupo: g.existe },
  );

  // ---- 3. o mesmo id repetido (conta própria) ----
  r = await criarGrupo(cookieA, {
    name: nome('repetido'),
    accountIds: [contasA[0].id, contasA[0].id],
  });
  g = await grupoPorNome(a.id, nome('repetido'));
  const repetidoOk =
    (r.status === 200 && g.existe && g.itens.length === 1) || (r.status === 400 && !g.existe);
  regista('id repetido não duplica nem rebenta (5xx) e não deixa lixo', repetidoOk, {
    status: r.status,
    erro: r.body?.error,
    grupo: g.existe,
    itens: g.itens.length,
  });

  // ---- 4. accountIds: [] explícito ----
  r = await criarGrupo(cookieA, { name: nome('vazio'), accountIds: [] });
  g = await grupoPorNome(a.id, nome('vazio'));
  regista(
    'accountIds: [] explícito cria o grupo sem linhas',
    r.status === 200 && g.existe && g.itens.length === 0,
    { status: r.status, grupo: g.existe, itens: g.itens.length },
  );

  // ---- 5. caminho legítimo: duas contas próprias ----
  r = await criarGrupo(cookieA, {
    name: nome('legitimo'),
    accountIds: contasA.map((c) => c.id),
  });
  g = await grupoPorNome(a.id, nome('legitimo'));
  const donos = new Set(g.itens.map((i) => i.dono));
  regista(
    'grupo só com contas próprias cria as linhas todas',
    r.status === 200 && g.existe && g.itens.length === contasA.length && donos.size === 1,
    { status: r.status, pedidas: contasA.length, itens: g.itens.length, donos: [...donos] },
  );

  // ---- 6. nenhuma conta alheia ficou em nenhum grupo de A ----
  const cruzadas = await q(
    `select count(*)::int as n
       from account_group_item i
       join account_group g on g.id = i."accountGroupId"
       join financial_account fa on fa.id = i."financialAccountId"
      where g."userId" = $1 and fa."userId" <> $1`,
    [a.id],
  );
  regista('nenhuma linha cruzada em account_group_item', cruzadas[0].n === 0, {
    linhas_cruzadas: cruzadas[0].n,
  });
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
