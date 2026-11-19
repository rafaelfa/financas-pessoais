import { prisma } from '@repo/db/client';
import { dueOccurrences, toIsoDate, toRecurrenceFrequency } from '@repo/shared';

/**
 * O núcleo de geração das ocorrências em atraso: sem sessão, sem pedido, sem
 * diretiva nenhuma. É chamado pelos dois caminhos que existem para gerar — a
 * Server Action do botão, com o `userId` da sessão, e o Vercel Cron, com os
 * `userId` lidos da base — e por isso não pode viver em nenhum dos dois:
 *
 * 1. Não no ficheiro das acções, que marca todos os seus exports como
 *    alcançáveis pelo cliente. Os docs do Next instalado
 *    (`dist/docs/01-app/02-guides/data-security.md`) não deixam margem —
 *    «even if a Server Action or utility function is not imported elsewhere in
 *    your code, it can still be called externally». Uma função que recebe um
 *    `userId` à escolha do chamador seria exatamente a variante que a decisão
 *    D22 rejeitou.
 * 2. Não no `route.ts` do cron: seria a camada de serviço (`src/server/`) a
 *    importar da borda (`src/app/api/`), e por arrasto meteria `next/headers` e
 *    `next/server` no grafo de uma Server Action. Hoje compila; amanhã alguém
 *    põe na rota uma API que só existe em route handler e a rutura aparece num
 *    sítio onde ninguém procura.
 */

/** `YYYY-MM-DD` como meia-noite UTC: a data de calendário, não o relógio. */
export function asDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** As ocorrências que uma série criou, para o resumo que o botão mostra. */
export interface GenerationDetail {
  readonly recurrenceName: string;
  readonly dates: string[];
}

/** O resultado de uma corrida do gerador, para quem o chamar. */
export interface GenerationOutcome {
  readonly created: number;
  readonly truncated: boolean;
  readonly details: GenerationDetail[];
  /** `null` quando todas as séries passaram; senão, a mensagem da que falhou. */
  readonly failure: string | null;
}

/**
 * Gera as ocorrências em atraso das séries ativas de **um** utilizador.
 *
 * Idempotente por construção: cria as ocorrências e avança `nextRunDate` na
 * mesma transação, por isso duas chamadas no mesmo dia não criam a renda duas
 * vezes. Quem chama decide o `userId` — a sessão, no botão; a base, no cron — e
 * `today` passa-se explicitamente para que a lista de séries e a geração falem
 * do mesmo dia de Lisboa.
 */
export async function gerarRecorrenciasParaUtilizador(
  userId: string,
  today: string,
): Promise<GenerationOutcome> {
  const recurrences = await prisma.recurrence.findMany({
    where: {
      userId,
      isActive: true,
      nextRunDate: { lte: asDate(today) },
    },
    orderBy: [{ nextRunDate: 'asc' }],
  });

  const details: GenerationDetail[] = [];
  let created = 0;
  let truncated = false;

  for (const recurrence of recurrences) {
    /*
     * A conversão vive no motor e falha alto: um `YEARLY` gravado na base (o enum
     * admite-o) deixava de cair numa cauda `else` que o tornava mensal. Era aqui
     * o pior dos quatro sítios — o gerador criava **doze ocorrências por ano**.
     */
    const frequency = toRecurrenceFrequency(recurrence.frequency);

    const result = dueOccurrences({
      nextRunDate: toIsoDate(recurrence.nextRunDate),
      frequency,
      interval: recurrence.interval,
      dayOfMonth: recurrence.dayOfMonth ?? undefined,
      endDate: recurrence.endDate === null ? undefined : toIsoDate(recurrence.endDate),
      today,
    });

    if (result.dates.length === 0) {
      continue;
    }

    truncated = truncated || result.truncated;

    try {
      const claimed = await prisma.$transaction(async (tx) => {
        /*
         * Reserva a série **antes** de criar nada.
         *
         * A leitura das séries em atraso acontece fora da transação, por isso duas
         * gerações em paralelo (dois separadores, um duplo clique, o painel e o
         * botão, ou o botão e o cron) viam as duas a mesma `nextRunDate` e
         * criavam as mesmas ocorrências: a verificação adversarial mediu **18
         * lançamentos em vez de 10**. Um avanço condicional na data que foi lida
         * resolve-o sem esquema novo — a segunda transação avança zero linhas e
         * desiste sem escrever. Sem esta condição, o comentário do motor ("gerar
         * nunca pode duplicar") era verdade sequencial e falso concorrente.
         */
        const claimed = await tx.recurrence.updateMany({
          where: { id: recurrence.id, nextRunDate: recurrence.nextRunDate },
          data: { nextRunDate: asDate(result.nextRunDate) },
        });

        if (claimed.count !== 1) {
          return false;
        }

        for (const date of result.dates) {
          await tx.transaction.create({
            data: {
              userId,
              kind: recurrence.kind,
              status: 'CONFIRMED',
              amountInCents: recurrence.amountInCents,
              date: asDate(date),
              description: recurrence.description ?? recurrence.name,
              financialAccountId: recurrence.financialAccountId,
              categoryId: recurrence.categoryId,
              recurrenceId: recurrence.id,
              paymentMethod: 'DEBIT',
              paymentCondition: 'RECURRING',
              // Uma ocorrência gerada é um movimento que já aconteceu: conta no
              // saldo. Séries que ainda não ocorreram têm `nextRunDate` no
              // futuro e por isso não são geradas.
              settled: true,
              settledOn: asDate(date),
            },
          });
        }

        return true;
      });

      // Não reclamada: outra geração chegou primeiro. Não é um erro, e não se
      // conta nada — quem perdeu a corrida não criou lançamento nenhum.
      if (!claimed) {
        continue;
      }

      created += result.dates.length;
      details.push({ recurrenceName: recurrence.name, dates: result.dates });
    } catch (error) {
      console.error(`[recorrências] falhou a série ${recurrence.name}:`, error);

      return {
        created,
        truncated,
        details,
        failure: `Não consegui gerar as ocorrências de "${recurrence.name}". Nada foi alterado nessa série.`,
      };
    }
  }

  return { created, truncated, details, failure: null };
}
