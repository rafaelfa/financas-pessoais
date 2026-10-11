import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { Amount } from '@/components/amount';
import {
  firstNegativeDay,
  formatDayLong,
  type DashboardForecastData,
} from '@/components/dashboard-forecast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/**
 * Aviso de saldo negativo.
 *
 * É o primeiro bloco do painel e existe por uma razão concreta: saber o saldo de
 * hoje não evita um descoberto na semana que vem. O aviso diz **a data** e **o
 * valor**, não apenas que «há um problema» — e aponta para os dois sítios onde
 * se resolve (o que está por liquidar e as séries que ainda vão correr).
 *
 * Quando a previsão não fica negativa, não renderiza nada: um aviso permanente
 * deixa de ser um aviso.
 */
export function DashboardForecastAlert({ forecast }: { readonly forecast: DashboardForecastData }) {
  if (!forecast.goesNegative) {
    return null;
  }

  const date = firstNegativeDay(forecast) ?? forecast.lowestDate;

  return (
    <Alert variant="destructive" className="mb-6 border-destructive/50">
      <TriangleAlert aria-hidden />

      <AlertTitle className="text-base">
        {date === null
          ? 'O saldo previsto fica negativo nos próximos dias'
          : `O saldo previsto fica negativo a ${formatDayLong(date)}`}
      </AlertTitle>

      <AlertDescription className="space-y-2">
        <p>
          Nesse dia o saldo previsto é{' '}
          <Amount
            amountInCents={forecast.lowestBalanceInCents}
            tone="expense"
            className="font-medium"
          />
          . A previsão já conta com as recorrências ativas e as faturas por pagar nas respetivas
          datas de vencimento.
        </p>
        <p>
          Vê o que está por liquidar em <Link href="/transacoes">Transações</Link> e as séries que
          ainda vão correr em <Link href="/recorrencias">Recorrências</Link>. Se os números já não
          correspondem à realidade, trava o saldo em <Link href="/contas">Contas</Link>.
        </p>
      </AlertDescription>
    </Alert>
  );
}
