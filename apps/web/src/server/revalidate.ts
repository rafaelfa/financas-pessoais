import { revalidatePath } from 'next/cache';

/**
 * Invalidação de cache das vistas.
 *
 * Uma compra num cartão muda o extrato de transações, a fatura do cartão, o
 * saldo em caixa no mês em que a fatura for paga e o património. Estes caminhos
 * andam sempre juntos; tê-los num sítio só evita o erro clássico de acrescentar
 * um ecrã novo e esquecer um `revalidatePath` — que se manifesta como "os dados
 * só aparecem depois de recarregar a página".
 */

/** Depois de mexer em transações. */
export function revalidateTransactionViews(): void {
  revalidatePath('/transacoes');
  revalidatePath('/');
  revalidatePath('/relatorios');
}

/** Depois de mexer em cartões, faturas ou parcelamentos. */
export function revalidateCardViews(): void {
  revalidatePath('/cartoes');
  revalidatePath('/contas');
  revalidatePath('/transacoes');
  revalidatePath('/relatorios');
  revalidatePath('/');
}
