import { expect, type Locator, type Page } from '@playwright/test';

import { CONTA_PRINCIPAL } from './dados';
import { eurosParaCentimos } from './format';

/**
 * Percursos de interface reutilizados pelos specs.
 *
 * Os localizadores são por **nome acessível** (`getByRole`, `getByLabel`) e não
 * por CSS: é o mesmo caminho que um leitor de ecrã usa, e por isso um percurso
 * que passa aqui é um percurso que continua utilizável quando o aspeto muda. Nas
 * raras exceções (o campo de ficheiro) usa-se o `id`, que é contrato do próprio
 * componente.
 */

/**
 * Abre uma rota e falha se o servidor responder com erro.
 *
 * O `smoke.mjs` faz o mesmo por HTTP; aqui, além do estado, verifica-se que a
 * página não mostra o ecrã de exceção do Next — que em `dev` chega com o mesmo
 * `200`.
 */
export async function abrirRota(page: Page, rota: string): Promise<void> {
  const resposta = await page.goto(rota);
  const estado = resposta?.status() ?? 0;

  expect(estado, `A rota ${rota} respondeu ${estado}.`).toBeLessThan(500);

  await expect(page.locator('body')).not.toContainText(
    'Application error: a server-side exception',
  );
  await expect(page.locator('body')).not.toContainText('Internal Server Error');
}

/** O formulário do lançamento rápido, em `/transacoes`. */
export function formularioDeLancamentoRapido(page: Page): Locator {
  return page.locator('form').filter({ hasText: 'Natureza' });
}

/** Espera pelo aviso (toast) com o texto indicado. */
export async function esperarAviso(page: Page, texto: string | RegExp): Promise<void> {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: texto }).first()).toBeVisible({
    timeout: 20_000,
  });
}

/** Escolhe uma opção num `Select` (Radix) pelo nome. */
export async function escolherNoSelect(trigger: Locator, opcao: string): Promise<void> {
  await trigger.click();
  await trigger.page().getByRole('option', { name: opcao, exact: true }).click();
}

/** O cartão de uma conta, em `/contas`. */
export function cartaoDaConta(page: Page, nome = CONTA_PRINCIPAL): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(nome, { exact: true }) })
    .first();
}

/** O cartão de um objetivo, em `/objetivos`. */
export function cartaoDoObjetivo(page: Page, nome: string): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(nome, { exact: true }) })
    .first();
}

/** Lê um KPI do painel, em cêntimos. */
export async function lerKpiDoPainel(page: Page, rotulo: string): Promise<number> {
  const cartao = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText(rotulo, { exact: true }) })
    .first();

  await expect(cartao).toBeVisible();

  return eurosParaCentimos(await cartao.locator('p').first().innerText());
}

/** Lê o saldo calculado da conta indicada, em cêntimos. */
export async function lerSaldoDaConta(page: Page, nome = CONTA_PRINCIPAL): Promise<number> {
  const cartao = cartaoDaConta(page, nome);

  await expect(cartao).toBeVisible();

  const valor = cartao.locator('p:has-text("Saldo calculado") + p');

  return eurosParaCentimos(await valor.innerText());
}

/** Cria um gasto pelo lançamento rápido. Devolve após o aviso de sucesso. */
export async function lancarGasto(
  page: Page,
  opcoes: {
    readonly valor: string;
    readonly descricao?: string;
    readonly categoria?: string;
    readonly data?: string;
  },
): Promise<void> {
  const rapido = formularioDeLancamentoRapido(page);

  await expect(rapido).toBeVisible();

  if (opcoes.categoria !== undefined) {
    await escolherNoSelect(rapido.getByLabel('Categoria', { exact: true }), opcoes.categoria);
  }

  await rapido.getByLabel('Valor', { exact: true }).fill(opcoes.valor);

  if (opcoes.data !== undefined) {
    await rapido.getByLabel('Data', { exact: true }).fill(opcoes.data);
  }

  if (opcoes.descricao !== undefined) {
    await rapido.getByLabel('Descrição', { exact: true }).fill(opcoes.descricao);
  }

  await rapido.getByRole('button', { name: 'Lançar', exact: true }).click();
  await esperarAviso(page, 'Gasto registado.');
}

/** Registo pela interface, como o faria uma pessoa. */
export async function registarPelaInterface(
  page: Page,
  dados: { readonly nome: string; readonly email: string; readonly palavraPasse: string },
): Promise<void> {
  await abrirRota(page, '/registar');

  await page.getByLabel('Nome', { exact: true }).fill(dados.nome);
  await page.getByLabel('E-mail', { exact: true }).fill(dados.email);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(dados.palavraPasse);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();

  /*
   * O sinal de sucesso é a navegação, **não** o aviso: as páginas de
   * autenticação chamam `toast.success`, mas o `<Toaster />` só existe no shell
   * autenticado (`app-shell.tsx:64`), portanto naquele ecrã não se desenha nada
   * (é o I14 do relatório T8.4). Esperar pelo aviso aqui tornaria o teste refém
   * de um defeito de produto que não é deste spec.
   */
  await expect(page).toHaveURL(/\/entrar$/, { timeout: 30_000 });
}

/** Entrada pela interface. */
export async function entrarPelaInterface(
  page: Page,
  dados: { readonly email: string; readonly palavraPasse: string },
): Promise<void> {
  await abrirRota(page, '/entrar');

  await page.getByLabel('E-mail', { exact: true }).fill(dados.email);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(dados.palavraPasse);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  // O painel é a raiz: é onde a entrada bem-sucedida aterra.
  await expect(page).toHaveURL(/\/$|\/\?/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Painel', level: 1 })).toBeVisible();
}

/** Hoje em Lisboa, como `YYYY-MM-DD` (o mesmo formato que a aplicação usa). */
export function hojeEmLisboa(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  return partes;
}

/** Soma (ou subtrai) dias a uma data `YYYY-MM-DD`, sem fusos à mistura. */
export function deslocarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  const referencia = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1));

  referencia.setUTCDate(referencia.getUTCDate() + dias);

  return referencia.toISOString().slice(0, 10);
}
