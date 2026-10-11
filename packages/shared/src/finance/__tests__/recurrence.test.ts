import { describe, expect, it } from 'vitest';

import {
  describeFrequency,
  dueOccurrences,
  nextOccurrence,
  seriesDayOfMonth,
  toRecurrenceFrequency,
} from '../recurrence';

/**
 * Recorrências.
 *
 * O que estes testes protegem, por ordem de importância:
 * 1. **Não duplicar.** Abrir a aplicação duas vezes no mesmo dia não pode criar
 *    duas vezes a renda. É a propriedade que o gerador tem de garantir.
 * 2. **Não derivar.** Um pagamento no dia 31 tem de voltar ao 31 depois de passar
 *    por fevereiro. O erro clássico é o dia "escorregar" para 28 para sempre.
 * 3. **Parar.** Uma série com fim não pode gerar depois do fim.
 */
describe('próxima ocorrência', () => {
  it('avança uma semana, e N semanas com intervalo', () => {
    expect(nextOccurrence({ from: '2026-10-01', frequency: 'weekly' })).toBe('2026-10-08');
    expect(nextOccurrence({ from: '2026-10-01', frequency: 'weekly', interval: 2 })).toBe(
      '2026-10-15',
    );
  });

  it('avança um mês mantendo o dia', () => {
    expect(nextOccurrence({ from: '2026-01-15', frequency: 'monthly' })).toBe('2026-02-15');
    expect(nextOccurrence({ from: '2026-01-15', frequency: 'monthly', interval: 3 })).toBe(
      '2026-04-15',
    );
  });

  it('avança um trimestre', () => {
    expect(nextOccurrence({ from: '2026-01-10', frequency: 'quarterly' })).toBe('2026-04-10');
  });

  /*
   * Havia aqui o teste «avança um ano na frequência anual». Foi **removido** com a
   * frequência: `nextOccurrence` já não aceita `yearly` (o tipo deixou de o
   * admitir), por isso não havia regra nenhuma a proteger — o teste verificava
   * apenas a aritmética de um valor que já não existe. O que protege a decisão é
   * o teste de `toRecurrenceFrequency`, mais abaixo: um `YEARLY` gravado na base
   * falha alto em vez de ser tratado como mensal.
   */

  it('cai no último dia quando o mês é mais curto', () => {
    // 31 de janeiro + 1 mês: fevereiro de 2026 não tem 31 dias.
    expect(nextOccurrence({ from: '2026-01-31', frequency: 'monthly', dayOfMonth: 31 })).toBe(
      '2026-02-28',
    );
  });

  it('volta ao dia original depois de um mês curto — sem deriva', () => {
    /*
     * Este é o teste que interessa. Se o dia alvo fosse recalculado a partir da
     * data já ajustada, a série ficava presa no 28: 31 → 28 → 28 → 28. O dia alvo
     * tem de vir sempre do dia contratado, não do anterior.
     */
    const february = nextOccurrence({ from: '2026-01-31', frequency: 'monthly', dayOfMonth: 31 });

    expect(february).toBe('2026-02-28');
    expect(nextOccurrence({ from: february, frequency: 'monthly', dayOfMonth: 31 })).toBe(
      '2026-03-31',
    );
  });

  it('trata fevereiro bissexto', () => {
    expect(nextOccurrence({ from: '2028-01-31', frequency: 'monthly', dayOfMonth: 31 })).toBe(
      '2028-02-29',
    );
  });

  it('um trimestre no dia 31 cai no último dia do mês de destino', () => {
    expect(nextOccurrence({ from: '2026-01-31', frequency: 'quarterly', dayOfMonth: 31 })).toBe(
      '2026-04-30',
    );
  });

  it('atravessa a passagem de ano', () => {
    expect(nextOccurrence({ from: '2026-12-15', frequency: 'monthly' })).toBe('2027-01-15');
    expect(nextOccurrence({ from: '2026-12-28', frequency: 'weekly' })).toBe('2027-01-04');
  });
});

describe('ocorrências em atraso', () => {
  it('gera todas as que faltam até hoje, inclusive', () => {
    const result = dueOccurrences({
      nextRunDate: '2026-10-01',
      frequency: 'monthly',
      today: '2026-12-15',
    });

    expect(result.dates).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    expect(result.nextRunDate).toBe('2027-01-01');
  });

  it('é idempotente: correr outra vez no mesmo dia não gera nada', () => {
    const first = dueOccurrences({
      nextRunDate: '2026-10-01',
      frequency: 'monthly',
      today: '2026-12-15',
    });

    const second = dueOccurrences({
      nextRunDate: first.nextRunDate,
      frequency: 'monthly',
      today: '2026-12-15',
    });

    expect(second.dates).toEqual([]);
    expect(second.nextRunDate).toBe(first.nextRunDate);
  });

  it('não gera nada quando a próxima data é no futuro', () => {
    const result = dueOccurrences({
      nextRunDate: '2027-01-01',
      frequency: 'monthly',
      today: '2026-12-15',
    });

    expect(result.dates).toEqual([]);
    expect(result.nextRunDate).toBe('2027-01-01');
  });

  it('para no fim da série', () => {
    const result = dueOccurrences({
      nextRunDate: '2026-10-01',
      frequency: 'monthly',
      endDate: '2026-11-30',
      today: '2027-06-01',
    });

    expect(result.dates).toEqual(['2026-10-01', '2026-11-01']);
    expect(result.nextRunDate).toBe('2026-12-01');
  });

  it('gera o dia de hoje quando é hoje', () => {
    const result = dueOccurrences({
      nextRunDate: '2026-10-05',
      frequency: 'monthly',
      dayOfMonth: 5,
      today: '2026-10-05',
    });

    expect(result.dates).toEqual(['2026-10-05']);
  });

  it('trunca uma série longa em vez de inundar a conta', () => {
    const result = dueOccurrences({
      nextRunDate: '2020-01-01',
      frequency: 'monthly',
      today: '2026-12-31',
      limit: 12,
    });

    expect(result.dates).toHaveLength(12);
    expect(result.truncated).toBe(true);
    expect(result.nextRunDate).toBe('2021-01-01');
  });

  it('uma série parada não entra em ciclo', () => {
    // O dia 31 com `dayOfMonth: 31` num mês que não o tem nunca fica "antes" da
    // data anterior, por isso a série avança sempre. Este teste fixa a garantia.
    const result = dueOccurrences({
      nextRunDate: '2026-01-31',
      frequency: 'monthly',
      dayOfMonth: 31,
      today: '2026-05-31',
    });

    expect(result.dates).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('sem dayOfMonth, o dia alvo vem da data original e não da já ajustada', () => {
    /*
     * A coluna `dayOfMonth` é nullable e o caminho por omissão era o defeituoso:
     * o dia alvo era lido do cursor, e o cursor já vinha ajustado de fevereiro.
     * A série ficava presa no 28 para sempre (31/01 → 28/02 → **28/03**).
     * O dia alvo tem de ser resolvido uma vez, a partir da data de partida.
     */
    const result = dueOccurrences({
      nextRunDate: '2026-01-31',
      frequency: 'monthly',
      today: '2026-05-31',
    });

    expect(result.dates).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('sem dayOfMonth, um trimestre também não deriva do dia 31', () => {
    const result = dueOccurrences({
      nextRunDate: '2026-01-31',
      frequency: 'quarterly',
      today: '2026-10-31',
    });

    expect(result.dates).toEqual(['2026-01-31', '2026-04-30', '2026-07-31', '2026-10-31']);
  });
});

describe('frequência por extenso', () => {
  it('descreve as frequências em português', () => {
    expect(describeFrequency({ frequency: 'weekly' })).toBe('todas as semanas');
    expect(describeFrequency({ frequency: 'weekly', interval: 2 })).toBe('a cada 2 semanas');
    expect(describeFrequency({ frequency: 'monthly' })).toBe('todos os meses');
    expect(describeFrequency({ frequency: 'monthly', dayOfMonth: 5 })).toBe(
      'todos os meses, dia 5',
    );
    expect(describeFrequency({ frequency: 'quarterly', interval: 2 })).toBe('a cada 2 trimestres');
  });
});

/**
 * Conversão da frequência gravada.
 *
 * Quatro sítios (o gerador, a lista, a previsão do painel e o esforço do objetivo)
 * liam o enum da base e tinham cada um a sua cauda `else`. Um `YEARLY` caía lá e
 * virava **mensal em silêncio** — o gerador criava doze ocorrências por ano. Com
 * um conversor só, o valor desconhecido falha alto em vez de ser adivinhado.
 */
describe('conversão da frequência gravada', () => {
  it('traduz o enum da base para o tipo do motor', () => {
    expect(toRecurrenceFrequency('WEEKLY')).toBe('weekly');
    expect(toRecurrenceFrequency('MONTHLY')).toBe('monthly');
    expect(toRecurrenceFrequency('QUARTERLY')).toBe('quarterly');
  });

  it('recusa uma frequência que o motor não sabe cumprir, em vez de a assumir mensal', () => {
    expect(() => toRecurrenceFrequency('YEARLY')).toThrow(RangeError);
    expect(() => toRecurrenceFrequency('FORTNIGHTLY')).toThrow(RangeError);
  });
});

/**
 * Dia gravado na criação da série.
 *
 * É esta a memória que faltava: sem `dayOfMonth`, o motor reconstrói o dia alvo a
 * partir da última data gerada e, depois de passar por fevereiro, o 31 perde-se
 * para sempre (31/01 → 28/02 → 28/03). O dia tem de ficar registado na criação.
 */
describe('dia do mês a gravar numa série', () => {
  it('guarda o dia indicado pelo utilizador', () => {
    expect(
      seriesDayOfMonth({ frequency: 'monthly', startDate: '2026-01-05', dayOfMonth: 20 }),
    ).toBe(20);
  });

  it('sem dia indicado, grava o dia da data de início', () => {
    expect(seriesDayOfMonth({ frequency: 'monthly', startDate: '2026-01-31' })).toBe(31);
    expect(seriesDayOfMonth({ frequency: 'quarterly', startDate: '2026-11-04' })).toBe(4);
  });

  it('numa série semanal o dia do mês não faz parte da regra', () => {
    expect(seriesDayOfMonth({ frequency: 'weekly', startDate: '2026-01-31' })).toBeNull();
  });

  it('o dia gravado recupera o 31 mesmo com a próxima data já em fevereiro', () => {
    // O caso que o motor sozinho não resolve: a `nextRunDate` já está em 28/02.
    // Com o dia gravado, a ocorrência seguinte volta ao 31 — era exatamente isto
    // que se perdia quando a coluna ficava nula.
    const result = dueOccurrences({
      nextRunDate: '2026-02-28',
      frequency: 'monthly',
      dayOfMonth: seriesDayOfMonth({ frequency: 'monthly', startDate: '2026-01-31' }) ?? undefined,
      today: '2026-05-31',
    });

    expect(result.dates).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });
});
