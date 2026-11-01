/**
 * T16 — corrida no pagamento de uma conta a pagar/receber.
 *
 * Dois pedidos `PATCH /api/receivable-payable` **simultâneos** sobre a mesma
 * conta. O que se mede: exatamente um 200, os restantes 400 com mensagem em
 * pt-PT, e na base **1** linha em `receivable_payable_payment` e **1** em
 * `transaction`. Três rondas com contas diferentes, mais uma ronda com 3
 * pedidos (a lacuna que o Dev deixou declarada).
 *
 * O caminho é o HTTP da aplicação (rota → server action → `updateMany` com
 * `where status != PAID` dentro da transação), não uma chamada à função.
 *
 * Uso (servidor de produção na :3000, `.env` do ramo de teste):
 *
 *   node --env-file=.env relatorios/T16-corrida.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { Client } = require('pg');

const BASE = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const ORIGIN = process.env.BETTER_AUTH_URL ?? BASE;
const TEST_ENDPOINT = 'ep-spring-mud-b11fe546';
const stamp = Date.now();

const user = { email: `qa.t16.${stamp}@example.test`, password: `Qa!T16-${stamp}` };

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

async function signUp() {
  const res = await fetch(`${BASE}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ ...user, name: 'QA T16' }),
  });
  if (!res.ok) abort(`sign-up: ${res.status} ${await res.text()}`);
}

async function signIn() {
  const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify(user),
  });
  if (!res.ok) abort(`sign-in: ${res.status}`);
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie) abort('sign-in sem cookie');
  return cookie;
}

async function api(cookie, path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
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

const resultados = [];
function regista(nome, ok, detalhe) {
  resultados.push({ nome, ok });
  console.log(`${ok ? 'PASSA ' : 'FALHA '} ${nome} — ${JSON.stringify(detalhe)}`);
}

try {
  await signUp();
  const cookie = await signIn();

  const [a] = await q('select id from "user" where email = $1', [user.email]);
  if (!a) abort('utilizador não criado');

  // Duas contas de pagamento alternadas pelas rondas (a por omissão + uma nova).
  await q(
    `insert into financial_account (id, "userId", type, name, "openingBalanceInCents", currency, origin, "createdAt", "updatedAt")
     values (gen_random_uuid()::text, $1, 'CHECKING', 'QA T16 Conta 2', 0, 'EUR', 'MANUAL', now(), now())`,
    [a.id],
  );
  const contas = await q(
    'select id, name from financial_account where "userId" = $1 order by "createdAt"',
    [a.id],
  );
  if (contas.length < 2) abort('contas de pagamento em falta');

  const pagamentos = async (descricao) =>
    (
      await q(
        `select count(*)::int as n from receivable_payable_payment p
         join receivable_payable r on r.id = p."receivablePayableId"
        where r.description = $1`,
        [descricao],
      )
    )[0].n;
  const movimentos = async (descricao) =>
    (await q('select count(*)::int as n from "transaction" where description = $1', [descricao]))[0]
      .n;

  /** Uma ronda: cria a conta a pagar e dispara `pedidos` PATCH ao mesmo tempo. */
  async function ronda(numero, pedidos) {
    const descricao = `QA T16 ronda ${numero} ${stamp}`;
    const criada = await api(cookie, '/api/receivable-payable', 'POST', {
      type: 'PAYABLE',
      description: descricao,
      amountInCents: 1234,
      dueDate: '2026-11-01',
    });
    if (criada.status !== 200) abort(`criar conta da ronda ${numero}: ${criada.status}`);

    const [conta] = await q('select id from receivable_payable where description = $1', [
      descricao,
    ]);
    if (!conta) abort(`conta da ronda ${numero} não encontrada`);
    const financeira = contas[(numero - 1) % contas.length];

    const corpo = {
      id: conta.id,
      financialAccountId: financeira.id,
      paymentDate: '2026-11-01',
      createTransaction: true,
    };

    const respostas = await Promise.all(
      Array.from({ length: pedidos }, () => api(cookie, '/api/receivable-payable', 'PATCH', corpo)),
    );

    const sucessos = respostas.filter((r) => r.status === 200 && r.body?.success === true);
    const recusas = respostas.filter((r) => r.status === 400);
    const outros = respostas.filter((r) => r.status !== 200 && r.status !== 400);
    const mensagens = recusas.map((r) => r.body?.error);

    const nPagamentos = await pagamentos(descricao);
    const nMovimentos = await movimentos(descricao);

    const detalhe = {
      pedidos,
      codigos: respostas.map((r) => r.status),
      sucessos: sucessos.length,
      recusas: recusas.length,
      outros: outros.length,
      mensagens,
      pagamentos: nPagamentos,
      movimentos: nMovimentos,
      conta_pagamento: financeira.name,
    };

    regista(
      `ronda ${numero} (${pedidos} pedidos simultâneos): 1 sucesso, 1 pagamento, 1 movimento`,
      sucessos.length === 1 &&
        recusas.length === pedidos - 1 &&
        outros.length === 0 &&
        nPagamentos === 1 &&
        nMovimentos === 1 &&
        mensagens.every((m) => m === 'Esta conta já está paga.'),
      detalhe,
    );
  }

  await ronda(1, 2);
  await ronda(2, 2);
  await ronda(3, 2);
  await ronda(4, 3);
} finally {
  try {
    await q('delete from "user" where email = $1', [user.email]);
  } catch (erro) {
    console.error('aviso: limpeza falhou —', erro.message);
  }
  await db.end();
}

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} rondas passaram`);
process.exit(falhas.length === 0 ? 0 : 1);
