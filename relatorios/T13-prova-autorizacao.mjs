/**
 * T13 — prova da falha de autorização em `createAccountGroup`.
 *
 * Cenário: dois utilizadores descartáveis (A e B). A cria um grupo enviando um
 * `accountId` que pertence a B. Se a linha ficar gravada em `account_group_item`
 * a ligar o grupo de A à conta de B, o isolamento entre utilizadores está
 * quebrado e a T13 nasce com prova.
 *
 * ESTE TESTE DEVE FICAR VERMELHO ATÉ A T13 SER CORRIGIDA. Vermelho = a falha
 * existe. Quando o Dev acrescentar a verificação de posse, o teste passa a
 * verde e deixa de ser vermelho por si.
 *
 * Uso (com o servidor de produção a correr na :3000 e o `.env` no ramo de teste):
 *
 *   node --env-file=.env relatorios/T13-prova-autorizacao.mjs
 *
 * Requer: `pnpm build` + `pnpm --filter @repo/web start`. Não toca em produção:
 * aborta se o `DATABASE_URL` não for o ramo `testes-e2e`. Limpa tudo (utilizadores
 * A e B em cascata) mesmo quando falha.
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { Client } = require('pg');

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.BETTER_AUTH_URL ?? BASE;
const TEST_ENDPOINT = 'ep-spring-mud-b11fe546';

const stamp = Date.now();
const userA = { email: `qa.t13.a.${stamp}@example.test`, password: `Qa!T13a-${stamp}` };
const userB = { email: `qa.t13.b.${stamp}@example.test`, password: `Qa!T13b-${stamp}` };

function abort(msg) {
  console.error(`ABORTADO: ${msg}`);
  process.exit(2);
}

if (!process.env.DATABASE_URL) abort('falta DATABASE_URL (corre com --env-file=.env)');
if (!process.env.DATABASE_URL.includes(TEST_ENDPOINT)) {
  abort(`o DATABASE_URL não é o ramo de teste ${TEST_ENDPOINT}; recuso-me a escrever`);
}

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

async function q(sql, params = []) {
  return (await db.query(sql, params)).rows;
}

async function signUp(user, name) {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: user.email, password: user.password, name }),
  });
  if (!res.ok) abort(`sign-up de ${user.email} falhou: ${res.status} ${await res.text()}`);
}

async function signIn(user) {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  if (!res.ok) abort(`sign-in de ${user.email} falhou: ${res.status}`);

  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');

  if (!cookie) abort(`sign-in de ${user.email} não devolveu cookie de sessão`);

  return cookie;
}

async function api(cookie, path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Origin: ORIGIN,
      Cookie: cookie,
      ...(init.headers ?? {}),
    },
  });

  let body = null;

  try {
    body = await res.json();
  } catch {
    body = null;
  }

  return { status: res.status, body };
}

const resultados = [];
function regista(nome, ok, detalhe) {
  resultados.push({ nome, ok, detalhe });
  console.log(
    `${ok ? 'PASSA ' : 'FALHA '} ${nome}${detalhe === undefined ? '' : ' — ' + JSON.stringify(detalhe)}`,
  );
}

try {
  // ---------- preparação ----------
  await signUp(userA, 'QA T13 A');
  await signUp(userB, 'QA T13 B');
  const cookieA = await signIn(userA);
  const cookieB = await signIn(userB);

  const [a] = await q('select id from "user" where email = $1', [userA.email]);
  const [b] = await q('select id from "user" where email = $1', [userB.email]);

  if (!a || !b) abort('utilizadores não ficaram criados');

  const [contaB] = await q(
    'select id, name from financial_account where "userId" = $1 order by "createdAt" limit 1',
    [b.id],
  );
  const [contaA] = await q(
    'select id, name from financial_account where "userId" = $1 order by "createdAt" limit 1',
    [a.id],
  );

  if (!contaB || !contaA) abort('as contas por omissão dos utilizadores não existem');

  console.log(
    `\nA=${userA.email} (${a.id}) · conta ${contaA.name}=${contaA.id}\n` +
      `B=${userB.email} (${b.id}) · conta ${contaB.name}=${contaB.id}\n`,
  );

  // ---------- a falha: grupo de A com conta de B ----------
  const criado = await api(cookieA, '/api/account-group', {
    method: 'POST',
    body: JSON.stringify({ name: `QA T13 cruzado ${stamp}`, accountIds: [contaB.id] }),
  });

  const [grupoA] = await q(
    'select id, name, "userId" from account_group where "userId" = $1 and name = $2',
    [a.id, `QA T13 cruzado ${stamp}`],
  );

  const cruzados = grupoA
    ? await q(
        `select i.id, i."accountGroupId", i."financialAccountId", fa.name as conta, fa."userId" as dono_conta
           from account_group_item i
           join financial_account fa on fa.id = i."financialAccountId"
          where i."accountGroupId" = $1 and fa."userId" <> $2`,
        [grupoA.id, a.id],
      )
    : [];

  regista(
    'createAccountGroup aceita um accountId de outro utilizador (FALHA ESPERADA)',
    cruzados.length === 0,
    cruzados.length === 0
      ? { resposta: criado.status, nota: 'nenhuma linha cruzada — a falha já não existe' }
      : {
          resposta: criado.status,
          linhas_cruzadas: cruzados.map((l) => ({
            item: l.id,
            conta: l.conta,
            dono_da_conta: l.dono_conta,
            grupo: l.accountGroupId,
          })),
        },
  );

  // ---------- controlos: o resto do módulo, num grupo limpo ----------
  const controlo = await api(cookieA, '/api/account-group', {
    method: 'POST',
    body: JSON.stringify({ name: `QA T13 controlo A ${stamp}` }),
  });
  const [grupoCtlA] = await q('select id from account_group where "userId" = $1 and name = $2', [
    a.id,
    `QA T13 controlo A ${stamp}`,
  ]);

  if (!grupoCtlA) abort(`não consegui criar o grupo de controlo (${controlo.status})`);

  const itensCtl = async () =>
    q(
      `select i."financialAccountId", fa."userId" as dono
         from account_group_item i
         join financial_account fa on fa.id = i."financialAccountId"
        where i."accountGroupId" = $1`,
      [grupoCtlA.id],
    );

  // updateAccountGroup passou a escrever accountIds (T11): o grupo de controlo
  // começa vazio e o PUT legítimo tem de deixar exatamente a conta enviada.
  const antesDoPut = await itensCtl();
  const put = await api(cookieA, '/api/account-group', {
    method: 'PUT',
    body: JSON.stringify({
      id: grupoCtlA.id,
      name: `QA T13 controlo A ${stamp}`,
      accountIds: [contaA.id],
    }),
  });
  const depoisDoPut = await itensCtl();
  regista(
    'updateAccountGroup escreve os accountIds enviados (T11)',
    put.status === 200 &&
      depoisDoPut.length === antesDoPut.length + 1 &&
      depoisDoPut.some((item) => item.financialAccountId === contaA.id),
    { status: put.status, itens_antes: antesDoPut.length, itens_depois: depoisDoPut.length },
  );

  const antesDoAdd = await itensCtl();
  const addCruzado = await api(cookieA, '/api/account-group', {
    method: 'DELETE',
    body: JSON.stringify({ action: 'addAccount', groupId: grupoCtlA.id, accountId: contaB.id }),
  });
  const depoisDoAdd = await itensCtl();
  regista(
    'addAccountToGroup recusa conta de outro utilizador',
    addCruzado.status === 400 &&
      depoisDoAdd.length === antesDoAdd.length &&
      depoisDoAdd.every((item) => item.dono === a.id),
    {
      status: addCruzado.status,
      erro: addCruzado.body?.error,
      linhas_antes: antesDoAdd.length,
      linhas_depois: depoisDoAdd.length,
    },
  );

  const antesDoRemove = await itensCtl();
  const removeCruzado = await api(cookieA, '/api/account-group', {
    method: 'DELETE',
    body: JSON.stringify({
      action: 'removeAccount',
      groupId: grupoCtlA.id,
      accountId: contaB.id,
    }),
  });
  const depoisDoRemove = await itensCtl();
  regista(
    'removeAccountFromGroup não altera nada com conta alheia',
    removeCruzado.status === 400 && depoisDoRemove.length === antesDoRemove.length,
    {
      status: removeCruzado.status,
      erro: removeCruzado.body?.error,
      linhas_antes: antesDoRemove.length,
      linhas_depois: depoisDoRemove.length,
    },
  );

  // B cria um grupo; A tenta apagá-lo
  const grupoBRes = await api(cookieB, '/api/account-group', {
    method: 'POST',
    body: JSON.stringify({ name: `QA T13 grupo de B ${stamp}` }),
  });
  const [grupoB] = await q('select id from account_group where "userId" = $1', [b.id]);

  if (grupoB) {
    const apagar = await api(cookieA, '/api/account-group', {
      method: 'DELETE',
      body: JSON.stringify({ action: 'delete', id: grupoB.id }),
    });
    const aindaExiste = await q('select id from account_group where id = $1', [grupoB.id]);
    regista(
      'deleteAccountGroup recusa apagar grupo de outro utilizador',
      apagar.status === 400 && aindaExiste.length === 1,
      { status: apagar.status, erro: apagar.body?.error, grupo_de_B: grupoBRes.status },
    );
  }
} finally {
  // ---------- limpeza ----------
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
console.log(
  `
${resultados.length - falhas.length}/${resultados.length} verificações passaram`,
);

// Qualquer verificação falhada é falha do teste, não só a do createAccountGroup.
if (falhas.length > 0) {
  console.error();
  if (falhas.some((f) => f.nome.startsWith('createAccountGroup aceita'))) {
    console.error(
      'VERMELHO (esperado): createAccountGroup grava account_group_item sem confirmar que a conta é do utilizador.',
    );
  } else {
    console.error(`VERMELHO: ${falhas.length} verificação(ões) falharam.`);
  }

  process.exit(1);
}

console.error();
console.log('VERDE: createAccountGroup já recusa contas de outro utilizador.');
process.exit(0);
