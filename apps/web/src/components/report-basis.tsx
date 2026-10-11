import { cn } from '@/lib/utils';

/**
 * Regime de contabilização.
 *
 * Esta é a peça que evita o ecrã parecer contradizer-se: os mesmos movimentos dão
 * dois números diferentes em caixa e em competência, e a diferença é
 * “quando paguei” contra “quando gastei”. Por isso o regime não é só um botão —
 * vem com a frase que o explica, escrita no ecrã, ao lado dos números.
 */

/** Regime, como o servidor o chama. */
export type ReportBasis = 'cash' | 'accrual';

/** Nome legível de cada regime. */
export const REPORT_BASIS_LABELS: Readonly<Record<ReportBasis, string>> = {
  cash: 'Caixa',
  accrual: 'Competência',
};

/** O que cada regime significa, em linguagem de utilizador. */
export const REPORT_BASIS_HINTS: Readonly<Record<ReportBasis, string>> = {
  cash: 'Quando o dinheiro se moveu.',
  accrual: 'Quando gastaste, mesmo sem pagar.',
};

/** Frase que acompanha os números do regime escolhido. */
export const REPORT_BASIS_SUMMARIES: Readonly<Record<ReportBasis, string>> = {
  cash: 'Estás a ver em caixa: contam os movimentos já pagos ou recebidos — quando o dinheiro se moveu.',
  accrual:
    'Estás a ver em competência: contam os movimentos quando gastaste ou ganhaste, mesmo que ainda não estejam pagos.',
};

/**
 * A razão da diferença entre os dois regimes.
 *
 * Sem esta frase, quem alterna entre caixa e competência vê dois totais
 * diferentes para o mesmo mês e conclui que um dos dois está errado.
 */
export const REPORT_BASIS_DIFFERENCE =
  'Os dois regimes dão números diferentes por causa das compras a crédito: em competência contam no dia da compra, em caixa só quando pagas a fatura do cartão.';

/** Converte o parâmetro do URL no regime do servidor. */
export function basisFromParam(value: string | undefined): ReportBasis {
  return value === 'competencia' ? 'accrual' : 'cash';
}

/** Converte o regime do servidor no parâmetro legível do URL. */
export function basisToParam(basis: ReportBasis): string {
  return basis === 'accrual' ? 'competencia' : 'caixa';
}

/**
 * Percentagem com uma casa decimal, em português.
 *
 * Uma casa e não duas: nos relatórios, “23,4%” lê-se e “23,42%” só ocupa espaço.
 */
export function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

/** Escolha do regime, como grupo de opções exclusivas. */
export function ReportBasisSwitch({
  value,
  onChange,
}: {
  readonly value: ReportBasis;
  readonly onChange: (basis: ReportBasis) => void;
}) {
  const options: readonly ReportBasis[] = ['cash', 'accrual'];

  return (
    <div className="space-y-1">
      <span id="relatorio-regime" className="text-sm font-medium">
        Regime
      </span>
      <div role="radiogroup" aria-labelledby="relatorio-regime" className="flex flex-wrap gap-2">
        {options.map((basis) => (
          <button
            key={basis}
            type="button"
            role="radio"
            aria-checked={value === basis}
            onClick={() => onChange(basis)}
            className={cn(
              'inline-flex min-h-11 flex-1 flex-col items-start justify-center rounded-lg border px-3 py-1.5 text-left text-sm font-medium transition-colors sm:min-h-8 sm:flex-row sm:items-center sm:justify-center sm:py-0',
              value === basis
                ? 'border-transparent bg-primary text-primary-foreground'
                : 'border-border bg-background hover:bg-muted',
            )}
          >
            <span>{REPORT_BASIS_LABELS[basis]}</span>
            <span
              className={cn(
                'text-xs font-normal',
                value === basis ? 'text-primary-foreground/80' : 'text-muted-foreground',
              )}
            >
              {REPORT_BASIS_HINTS[basis]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
