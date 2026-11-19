import { timingSafeEqual } from 'node:crypto';

import { prisma } from '@repo/db/client';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { todayInLisbon } from '@/lib/today';
import { asDate, gerarRecorrenciasParaUtilizador } from '@/server/recurrence-generation';

/**
 * `GET /api/cron/recurrences` — as ocorrências em atraso geram-se sozinhas.
 *
 * É o caminho privilegiado da decisão D22: o único sítio do código fora de
 * `(app)` em que uma escrita não parte do `userId` da sessão. O Vercel Cron
 * chama por HTTP **sem cookies**, por isso não há sessão aqui; o segredo no
 * cabeçalho é a única porta e os `userId` vêm **da base**, um a um, nunca do
 * pedido.
 *
 * Este ficheiro é só a borda: o guarda, a lista de donos e as contagens. A
 * geração vive em `@/server/recurrence-generation`, o mesmo núcleo que o botão
 * da UI chama — porque o botão tem sessão e o cron não, mas o que acontece na
 * base tem de ser exatamente a mesma coisa nos dois caminhos.
 */
export const dynamic = 'force-dynamic';

/**
 * A única autoridade da rota: o cabeçalho tem de bater com o segredo.
 *
 * Sem `CRON_SECRET` no ambiente a rota **fecha**, nunca abre: um segredo
 * ausente não é «sem verificação», é «ninguém pode entrar» — que é o estado
 * seguro quando a produção é pública e esta rota escreve na base de todos.
 *
 * A comparação é em tempo constante (`timingSafeEqual`), não por `===`: é a
 * única porta do repositório sem sessão, por isso não se deixa medir o
 * prefixo certo byte a byte. O comprimento decide **antes** da chamada, que a
 * função lança com buffers de tamanhos diferentes — e a diferença de
 * comprimento, essa, não é segredo que valha um 500.
 *
 * Em produção o valor vem das settings do projeto na Vercel e é **capturado no
 * momento do build**: um 401 silencioso depois de rodar o segredo significa que
 * o deployment que serve produção ainda espera o valor antigo.
 */
function autorizado(authorization: string | null): boolean {
  const secret = process.env.CRON_SECRET;

  if (secret === undefined || secret === '') {
    return false;
  }

  const esperado = Buffer.from(`Bearer ${secret}`);

  if (authorization === null) {
    return false;
  }

  const recebido = Buffer.from(authorization);

  if (recebido.length !== esperado.length) {
    return false;
  }

  return timingSafeEqual(recebido, esperado);
}

export async function GET(): Promise<NextResponse> {
  const authorization = (await headers()).get('authorization');

  if (!autorizado(authorization)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const today = todayInLisbon();

  /*
   * Os donos das séries em atraso leem-se da base, não do pedido: é o que
   * impede quem chama de escolher em que conta se escreve. Um `userId` por
   * linha, com a geração a correr isolada por utilizador — a falha de um não
   * travou os outros.
   */
  const owners = await prisma.recurrence.findMany({
    where: { isActive: true, nextRunDate: { lte: asDate(today) } },
    select: { userId: true },
    distinct: ['userId'],
  });

  let created = 0;
  let truncated = false;
  let failures = 0;

  for (const { userId } of owners) {
    const outcome = await gerarRecorrenciasParaUtilizador(userId, today);

    created += outcome.created;
    truncated = truncated || outcome.truncated;
    failures += outcome.failure === null ? 0 : 1;
  }

  // Só contagens: nada do que se gerou — descrições, montantes, datas, ids de
  // utilizador ou séries — sai daqui. O corpo é o recibo do job, não uma leitura.
  return NextResponse.json({ created, truncated, users: owners.length, failures });
}
