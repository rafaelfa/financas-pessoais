import { CheckCircle2, ChevronRight, CreditCard, HelpCircle, Timer, Wallet } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getReviewCounts, type ReviewCounts } from '@/server/review';

export const metadata: Metadata = { title: 'Revisão' };

/**
 * Revisão: quatro contagens e um salto.
 *
 * A página **não corrige nada** (decisão registada na T54): cada cartão conta o
 * que está por arrumar e leva ao ecrã onde a correção já se faz — o extrato, com
 * as ações em massa, ou as contas e os cartões.
 */

interface ReviewCard {
  readonly key: keyof Omit<ReviewCounts, 'total'>;
  readonly title: string;
  readonly href: string;
  readonly description: string;
  /** Frase do estado zero: um `0` sem explicação não diz nada. */
  readonly empty: string;
  readonly done: string;
  /** O que a contagem mede, em português, para o nome acessível. */
  readonly unit: readonly [singular: string, plural: string];
  readonly icon: typeof Wallet;
}

const CARDS: readonly ReviewCard[] = [
  {
    key: 'pending',
    title: 'Por confirmar',
    href: '/transacoes?status=pending',
    description: 'Lançamentos que ainda não foram confirmados nem ignorados.',
    empty: 'Nada por confirmar',
    done: 'Tudo confirmado',
    unit: ['lançamento por confirmar', 'lançamentos por confirmar'],
    icon: HelpCircle,
  },
  {
    key: 'uncategorized',
    title: 'Sem categoria',
    href: '/transacoes?semCategoria=1',
    description: 'Gastos e ganhos sem categoria — não entram nos relatórios por categoria.',
    empty: 'Nada sem categoria',
    done: 'Tudo classificado',
    unit: ['lançamento sem categoria', 'lançamentos sem categoria'],
    icon: Timer,
  },
  {
    key: 'overdue',
    title: 'Contas vencidas',
    href: '/contas-pagar-receber',
    description: 'Contas a pagar ou a receber cujo vencimento já passou.',
    empty: 'Nada vencido',
    done: 'Nada vencido',
    unit: ['conta vencida', 'contas vencidas'],
    icon: Wallet,
  },
  {
    key: 'unpaidInvoices',
    title: 'Faturas por pagar',
    href: '/cartoes',
    description: 'Faturas de cartão já fechadas com valor por liquidar.',
    empty: 'Nenhuma fatura por pagar',
    done: 'Nenhuma fatura por pagar',
    unit: ['fatura por pagar', 'faturas por pagar'],
    icon: CreditCard,
  },
];

/** «1 lançamento por confirmar» / «3 lançamentos por confirmar». */
function countLabel(card: ReviewCard, count: number): string {
  return count === 1 ? card.unit[0] : `${count} ${card.unit[1]}`;
}

export default async function ReviewPage() {
  const counts = await getReviewCounts();

  return (
    <>
      <PageHeader
        title="Revisão"
        description="O que ainda está por arrumar, em quatro números. Cada cartão leva ao ecrã onde a correção se faz — esta página não altera nada."
      />

      <div className="space-y-6">
        <p className="text-sm text-muted-foreground" role="status">
          {counts.total === 0 ? (
            'Nada por arrumar.'
          ) : (
            <>
              <span className="font-medium text-foreground">{counts.total}</span>{' '}
              {counts.total === 1 ? 'coisa por arrumar' : 'coisas por arrumar'} — a soma dos quatro
              cartões abaixo.
            </>
          )}
        </p>

        {/*
          A ordem do documento é a ordem visual e a do `Tab`: são quatro
          ligações seguidas, sem nada pelo meio.
        */}
        <ul className="grid gap-4 sm:grid-cols-2">
          {CARDS.map((card) => {
            const count = counts[card.key];
            const Icon = card.icon;

            return (
              <li key={card.key}>
                <Link
                  href={card.href}
                  className="group block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <Card className="h-full transition-colors group-hover:bg-muted/40">
                    <CardContent className="flex h-full flex-col gap-3 p-4 sm:p-5">
                      <div className="flex items-center gap-2">
                        <Icon className="size-4 text-muted-foreground" aria-hidden />
                        <h2 className="text-sm font-medium">{card.title}</h2>
                      </div>

                      <div className="flex items-baseline gap-2">
                        {count > 0 ? (
                          <span className="text-3xl font-semibold tabular-nums">{count}</span>
                        ) : (
                          <CheckCircle2 className="size-6 text-success" aria-hidden />
                        )}
                        <p
                          className={cn(
                            'text-sm',
                            count > 0 ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {count > 0 ? countLabel(card, count) : card.empty}
                        </p>
                      </div>

                      <p className="text-sm text-muted-foreground">{card.description}</p>

                      <span className="mt-auto flex items-center gap-1 text-sm font-medium text-primary">
                        {count > 0 ? 'Resolver' : 'Ver'}
                        <ChevronRight className="size-4" aria-hidden />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
