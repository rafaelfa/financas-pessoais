/**
 * A data de hoje em Portugal, como data de calendário `YYYY-MM-DD`.
 *
 * `new Date().toISOString()` daria a data em UTC: às 23h30 de verão em Lisboa
 * já é o dia seguinte em UTC, e o painel mostraria o mês errado. Formatar com o
 * fuso explícito evita essa classe de erros.
 */
export function todayInLisbon(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
