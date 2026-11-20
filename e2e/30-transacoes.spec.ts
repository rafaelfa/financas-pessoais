import { expect, test } from '@playwright/test';

import {
  abrirRota,
  formularioDeLancamentoRapido,
  hojeEmLisboa,
  lancarGasto,
  lerKpiDoPainel,
  lerSaldoDaConta,
} from './support/ui';

/**
 * Percurso 2 — criar uma transação e vê-la no extrato, no painel e no saldo.
 *
 * Os valores são medidos por **diferença**, não em absoluto: os specs partilham
 * um utilizador e a ordem podia mudar o saldo. A diferença é o que se quer
 * provar (o lançamento moveu exatamente 37,45 €).
 */

test.describe('Percurso 2 — lançar um gasto', () => {
  test('o gasto aparece no extrato, nas saídas do mês e no saldo da conta', async ({ page }) => {
    const sufixo = Date.now().toString(36);
    const descricao = `E2E transportes ${sufixo}`;

    /*
     * Um lançamento de aquecimento **antes** de medir.
     *
     * Sem ele, o painel de um utilizador sem movimentos mostra o estado vazio
     * («Ainda não há nada para mostrar») e não tem cartões de KPI nenhuns: a
     * primeira versão deste teste falhava a procurar «Saídas do mês» num painel
     * vazio (medido na corrida de 2026-10-11 15:01, `30-transacoes.spec.ts`).
     * Medir diferenças exige um estado de partida com dados.
     */
    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '10,00',
      descricao: `E2E base ${sufixo}`,
      categoria: 'Outros',
    });

    await abrirRota(page, '/contas');
    const saldoAntes = await lerSaldoDaConta(page);

    await abrirRota(page, '/');
    const saidasAntes = await lerKpiDoPainel(page, 'Saídas do mês');

    await abrirRota(page, '/transacoes');
    await lancarGasto(page, {
      valor: '37,45',
      descricao,
      categoria: 'Transportes',
      data: hojeEmLisboa(),
    });

    // 1. O extrato mostra a linha, com o valor.
    const linha = page.getByRole('row', { name: new RegExp(descricao) });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText('37,45');

    // 2. O painel conta o gasto nas saídas do mês (visão de caixa).
    await abrirRota(page, '/');
    const saidasDepois = await lerKpiDoPainel(page, 'Saídas do mês');

    expect(saidasDepois - saidasAntes, 'as saídas do mês têm de subir exatamente 37,45 €').toBe(
      3745,
    );

    // 3. O saldo da conta desce exatamente o valor lançado.
    await abrirRota(page, '/contas');
    const saldoDepois = await lerSaldoDaConta(page);

    expect(saldoDepois - saldoAntes, 'o saldo tem de descer exatamente 37,45 €').toBe(-3745);
  });
});

/**
 * Percurso 3 — comportamento do campo Valor: conta expressível, erro de valor
 * ilegível, limpeza de aviso após correção.
 *
 * **Atualização pós-T74:** antes deste patch, o botão desactivava com montante
 * inválido (`amountInCents === null` na linha 705). O N2 pediu que ficasse activo
 * e explicasse o motivo no campo (`aria-invalid` + `aria-describedby`). T74
 * removeu a condição `amountInCents === null`. Os asserts antigos `toBeDisabled()`
 * foram reescritos para afirmar o novo contrato (botão activo + razão visível).
 */

test.describe('Percurso 3 — comportamento do campo Valor', () => {
  test('o botão fica activo com valor inválido e mostra o erro no campo', async ({ page }) => {
    await abrirRota(page, '/transacoes');

    const rapido = formularioDeLancamentoRapido(page);
    const lancar = rapido.getByRole('button', { name: 'Lançar', exact: true });
    const valor = rapido.getByLabel('Valor', { exact: true });

    // Sem valor: botão activo (N2). Antes de T74 era `toBeDisabled()`.
    await expect(lancar).toBeEnabled();

    await valor.fill('12,50 + 3,20');

    // A conta é resolvida no campo e anunciada antes de submeter.
    await expect(rapido.getByText('15,70 €')).toBeVisible();

    // Só ao sair do campo (ou com Enter) é que a conta se torna o valor do
    // formulário: é esse o contrato do `MoneyInput`.
    await valor.blur();
    await expect(lancar).toBeEnabled();
  });

  test('um valor ilegível é anunciado no campo e a submissão é recusada com explicação', async ({
    page,
  }) => {
    /*
     * Antigo assert: `toBeDisabled()`. Novo: `toBeEnabled()` + erro visível.
     * O N2 mudou o contrato: botão activo, erro explicado no campo.
     *
     * 2.ª volta da T74 (achado g): o título prometia «não deixa lançar» e nenhuma
     * asserção o media. Agora mede-se: com `abc` o formulário recusa a submissão
     * com o guard novo («Escreve o valor.») e não aparece aviso de sucesso.
     */
    await abrirRota(page, '/transacoes');

    const rapido = formularioDeLancamentoRapido(page);
    const lancar = rapido.getByRole('button', { name: 'Lançar', exact: true });

    await rapido.getByLabel('Valor', { exact: true }).fill('abc');

    // MoneyInput anuncia «Valor inválido.» enquanto o texto não é número.
    await expect(rapido.getByRole('alert')).toContainText('Valor inválido.');

    // Botão activo com erro visível no campo (MoneyInput em tempo real).
    await expect(lancar).toBeEnabled();

    await lancar.click();

    // A submissão foi recusada: o formulário explica que falta um valor legível
    // e não há «Gasto registado.».
    await expect(page.locator('#lancamento-valor-erro')).toHaveText('Escreve o valor.');
    await expect(page.getByText('Gasto registado.')).toHaveCount(0);
  });

  /**
   * Escrever uma conta válida depois de um erro limpa o aviso e mostra o resultado.
   *
   * **Este teste era um `test.fail`.** `apps/web/src/components/money-input.tsx`
   * só limpava o erro quando o texto novo **não** era uma conta por resolver:
   * depois de `abc`, escrever `12,50 + 3,20` deixava «Valor inválido.» no ecrã,
   * marcava o campo como inválido e **suprimia** a pré-visualização `= 15,70 €`
   * (que só é renderizada quando não há erro). Medido na corrida de 2026-10-11
   * 15:01 — o campo ficou `[invalid]` com o alerta antigo e sem a linha de
   * resultado, com `12,50 + 3,20` lá dentro. Foi o achado I15 do relatório
   * `docs/spec/T8.4-e2e-e-desempenho.md`; o `handleChange` passou a limpar o erro
   * quando a conta é válida, mantendo a guarda para contas a meio (`12,50 +`).
   *
   * **Pós-T74:** `await expect(lancar).toBeDisabled()` (linha 142 antiga) →
   * `toBeEnabled()` porque `amountInCents === null` já não desactiva o botão.
   */
  test('escrever uma conta válida depois de um erro limpa o aviso e mostra o resultado', async ({
    page,
  }) => {
    await abrirRota(page, '/transacoes');

    const rapido = formularioDeLancamentoRapido(page);
    const lancar = rapido.getByRole('button', { name: 'Lançar', exact: true });
    const valor = rapido.getByLabel('Valor', { exact: true });

    await valor.fill('abc');
    await expect(rapido.getByRole('alert')).toContainText('Valor inválido.');

    await valor.fill('12,50 + 3,20');

    await expect(rapido.getByRole('alert')).toHaveCount(0);
    await expect(rapido.getByText('15,70 €')).toBeVisible();

    // O botão está activo (pós-T74: sem `null` no disabled). A conta ainda não é
    // o valor do formulário: só ao confirmar (sair do campo ou `Enter`) é que o
    // campo propaga o valor. É o contrato do `MoneyInput`.
    await expect(lancar).toBeEnabled();

    await valor.blur();
    await expect(lancar).toBeEnabled();
    await expect(valor).toHaveValue('15,70');

    /*
     * 2.ª volta da T74 (achado 3): `toBeEnabled()` antes e depois do blur não
     * distingue «por confirmar» de «confirmado». `toHaveValue` também não chega:
     * o texto vem do `setText` do próprio `MoneyInput`, que corre mesmo sem
     * `onValueChange`. A prova de que o valor chegou ao **formulário** é a
     * submissão: com o montante propagado, a validação passa e o único erro é a
     * categoria; sem `onValueChange`, veria `amountInCents === null` e o guard
     * responderia «Escreve o valor.».
     */
    await lancar.click();
    await expect(page.locator('#lancamento-categoria-erro')).toHaveText('Escolhe uma categoria.');
    await expect(page.locator('#lancamento-valor-erro')).toHaveCount(0);
  });
});
