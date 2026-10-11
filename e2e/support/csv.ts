import { deslocarDias } from './ui';

/**
 * Extrato CSV de amostra, gerado em memória.
 *
 * Reproduz o dialecto que o projeto fixou como contrato (o mesmo de
 * `docs/spec/samples/extrato-csv-pt.csv`): separador `;`, datas `dd/mm/aaaa`,
 * decimais com vírgula, milhares com ponto e uma descrição entre aspas com `;`
 * lá dentro.
 *
 * As datas são relativas a hoje para o extrato cair sempre no período corrente —
 * um ficheiro com datas fixas envelheceria e o percurso do orçamento deixaria de
 * o ver. As descrições levam a etiqueta da corrida para não colidirem com dados
 * de outra execução.
 */

export interface ExtratoCsv {
  readonly nome: string;
  /** Cabeçalho + linhas, já com CRLF (o que um Excel português escreve). */
  readonly conteudo: string;
  readonly descricoes: readonly string[];
  /** Soma dos valores, em cêntimos: o efeito esperado no saldo da conta. */
  readonly efeitoNoSaldo: number;
}

/** Data `YYYY-MM-DD` → `DD/MM/AAAA`. */
function dataPortuguesa(iso: string): string {
  const [ano = '', mes = '', dia = ''] = iso.split('-');

  return `${dia}/${mes}/${ano}`;
}

export function extratoCsvDeAmostra(hoje: string, etiqueta: string): ExtratoCsv {
  const vencimento = `E2E vencimento ${etiqueta}`;
  const renda = `E2E renda ${etiqueta}`;
  const supermercado = `E2E compra; supermercado ${etiqueta}`;
  const transferencia = `E2E transferência ${etiqueta}`;
  const seguro = `E2E seguro ${etiqueta}`;
  const levantamento = `E2E levantamento ${etiqueta}`;

  const linhas: readonly string[] = [
    `${dataPortuguesa(deslocarDias(hoje, -6))};"${supermercado}";-64,37;3.735,63`,
    `${dataPortuguesa(deslocarDias(hoje, -5))};${renda};-850,00;3.800,00`,
    `${dataPortuguesa(deslocarDias(hoje, -4))};${vencimento};2.150,00;4.650,00`,
    `${dataPortuguesa(deslocarDias(hoje, -3))};${transferencia};1.200,00;4.935,63`,
    `${dataPortuguesa(deslocarDias(hoje, -2))};${seguro};-312,45;4.623,18`,
    `${dataPortuguesa(deslocarDias(hoje, -1))};${levantamento};-50,00;4.573,18`,
  ];

  return {
    nome: `extrato-e2e-${etiqueta}.csv`,
    conteudo: `Data;Descrição;Valor;Saldo\r\n${linhas.join('\r\n')}\r\n`,
    descricoes: [vencimento, renda, supermercado, transferencia, seguro, levantamento],
    // 2 150,00 - 850,00 - 64,37 + 1 200,00 - 312,45 - 50,00 = 2 073,18
    efeitoNoSaldo: 215_000 - 85_000 - 6_437 + 120_000 - 31_245 - 5_000,
  };
}
