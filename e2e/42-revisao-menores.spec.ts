import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { lerCredenciais } from './support/dados';
import {
  contarEstadoDoUtilizador,
  criarContaAPagarDoSpec,
  criarLancamentoDoSpec,
  limparDadosDoSpec,
} from './support/db';
import { abrirRota } from './support/ui';

/**
 * Percurso 42 — três menores da Revisão (T63).
 *
 * 1. O número grande passou a `aria-hidden` (o nome acessível lia «3 3 lançamentos»);
 *    e com **uma** coisa o nome tem de dizer «1 lançamento por confirmar», não
 *    «lançamento por confirmar» sem numeral.
 * 2. `done` saiu do cartão (campo morto).
 * 3. «Vencida» compara datas de calendário com o **hoje de Lisboa**, não com a
 *    meia-noite do browser — o defeito só se vê a oeste de UTC.
 *
 * O fuso é o caso que uma verificação manual não impede de voltar, por isso é
 * este o teste que fica: `America/Sao_Paulo`, uma conta que vence **hoje** em
 * Lisboa (não é vencida) e uma que venceu ontem (é). A página e o cartão da
 * Revisão têm de dizer o mesmo — 1 e 1.
 */

const PREFIXO = 'T63 prova';

const email = (): string => lerCredenciais().email;

function hojeEmLisboa(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function deslocar(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function cartao(page: Page, href: string) {
  return page.locator(`main a[href="${href}"]`).first();
}

async function nomeAcessivel(page: Page, href: string): Promise<string> {
  return cartao(page, href).evaluate((a) => a.textContent?.replace(/\s+/g, ' ').trim() ?? '');
}

/** O texto que o leitor de ecrã lê (o `ariaSnapshot` do link inclui o nome calculado). */
async function nomeARIA(page: Page, href: string): Promise<string> {
  const snapshot = await cartao(page, href).ariaSnapshot();

  return /^- link "([^"]*)"/.exec(snapshot)?.[1] ?? snapshot;
}

test.describe('Revisão: nome acessível, estado zero e fuso (T63)', () => {
  test.afterAll(async () => {
    await limparDadosDoSpec(email(), PREFIXO);
  });

  test.beforeAll(async () => {
    /* Por confirmar: 3. Sem categoria: 1 (sem `categoryId`). Vencidas: 0. */
    for (const [i, valor] of [1000, 1001, 1002].entries()) {
      await criarLancamentoDoSpec({
        email: email(),
        descricao: `${PREFIXO} pendente ${i + 1}`,
        valorInCents: -valor,
        estado: 'PENDING',
      });
    }

    await criarLancamentoDoSpec({
      email: email(),
      descricao: `${PREFIXO} sem categoria`,
      valorInCents: -2000,
      estado: 'CONFIRMED',
      comCategoria: false,
    });
  });

  test('o nome diz o número uma vez, qualquer que seja a contagem', async ({ page }) => {
    /* As contagens vêm da base: o utilizador partilhado traz dados de outras specs. */
    const { pendentes, semCategoria, contasVencidas } = await contarEstadoDoUtilizador(email());

    await abrirRota(page, '/revisao');

    const casos: readonly [string, number, string][] = [
      ['/transacoes?status=pending', pendentes, 'lançamento'],
      ['/transacoes?semCategoria=1', semCategoria, 'lançamento'],
      ['/contas-pagar-receber', contasVencidas, 'conta'],
    ];

    for (const [href, count, unidade] of casos) {
      const nome = await nomeARIA(page, href);

      if (count === 0) {
        expect(nome, `contagem 0 em ${href} mostra o estado`).toMatch(/Nada |Nenhuma /);
        continue;
      }

      const plural = count === 1 ? unidade : `${unidade}s`;
      expect(nome, `${count} ${plural} em ${href}`).toContain(`${count} ${plural}`);
      /* Sem a repetição do número grande («3 3 lançamentos»). */
      expect(nome, `o número não se repete em ${href}`).not.toMatch(
        new RegExp(`\b${count}\s+${count}\b`),
      );
    }

    /* O texto visível continua com o número grande. */
    expect(await nomeAcessivel(page, '/transacoes?status=pending')).toMatch(/^Por confirmar\s*\d/);
  });

  test('o fuso não muda o vencimento: página e Revisão dizem 1 e 1', async ({ browser }) => {
    const hoje = hojeEmLisboa();
    const contaAPagar = async (descricao: string, cents: number, vencimento: string) => {
      await criarContaAPagarDoSpec(email(), descricao, 'PAYABLE', cents, vencimento);
    };

    await contaAPagar(`${PREFIXO} vence hoje`, 3000, hoje);
    await contaAPagar(`${PREFIXO} venceu ontem`, 4000, deslocar(hoje, -1));

    /* Browser a oeste de UTC: a meia-noite local não é a de Lisboa. */
    const contexto = await browser.newContext({
      storageState: 'e2e/.auth/utilizador.json',
      locale: 'pt-PT',
      timezoneId: 'America/Sao_Paulo',
    });
    const page = await contexto.newPage();

    await abrirRota(page, '/contas-pagar-receber');
    const vencidasNaPagina = await page.evaluate(() => {
      const texto = document.body.innerText;

      return (texto.match(/Vencida/g) ?? []).length;
    });

    await abrirRota(page, '/revisao');
    const noCartao = await cartao(page, '/contas-pagar-receber').evaluate((a) => {
      const grande = [...a.querySelectorAll('span')].find((s) => s.className.includes('text-3xl'));

      return grande ? Number(grande.textContent ?? '0') : 0;
    });

    expect(vencidasNaPagina, 'só a de ontem está vencida').toBe(1);
    expect(noCartao, 'o cartão da Revisão conta a mesma').toBe(1);

    await contexto.close();
  });

  test('axe 0 nas duas rotas, a 1280 e a 360', async ({ page }) => {
    for (const largura of [1280, 360]) {
      await page.setViewportSize({ width: largura, height: largura === 360 ? 800 : 1000 });

      for (const rota of ['/revisao', '/contas-pagar-receber']) {
        await abrirRota(page, rota);
        const resultado = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();

        expect(
          resultado.violations.map((v) => `${largura} ${rota}: ${v.id} (${v.nodes.length})`),
          `violações a ${largura} em ${rota}`,
        ).toEqual([]);

        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(largura);
      }
    }
  });
});
