'use client';

import { evaluateAmountExpression, formatCurrency, isCalculation } from '@repo/shared';
import { useId, useState } from 'react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Formata cêntimos como número pt-PT, sem símbolo de moeda. */
function formatDecimalInput(amountInCents: number): string {
  return new Intl.NumberFormat('pt-PT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountInCents / 100);
}

export interface MoneyInputProps {
  /** Valor atual em cêntimos. `null` significa vazio. */
  readonly valueInCents: number | null;
  /** Notificado a cada valor válido (durante a escrita, quando é um número simples). */
  readonly onValueChange?: (amountInCents: number | null) => void;
  /** Notificado quando o utilizador confirma com Enter ou sai do campo. */
  readonly onCommit?: (amountInCents: number) => void;
  readonly id?: string;
  readonly name?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly autoFocus?: boolean;
  readonly className?: string;
  readonly 'aria-label'?: string;
}

/**
 * Campo de valor monetário.
 *
 * O componente mais usado de toda a aplicação — quem lança despesas faz isto
 * dezenas de vezes por mês, muitas vezes no telemóvel. Por isso:
 * - aceita `12,5`, `12.5` e `1 234,56`;
 * - resolve contas escritas no próprio campo (`12,50 + 3,20`), com um analisador
 *   próprio e **sem `eval`**;
 * - normaliza para o formato português ao sair do campo;
 * - `Enter` confirma, `Esc` repõe o último valor válido;
 * - uma expressão inválida mostra erro e **nunca** apaga o valor anterior.
 */
export function MoneyInput({
  valueInCents,
  onValueChange,
  onCommit,
  id,
  name,
  placeholder = '0,00',
  disabled,
  autoFocus,
  className,
  'aria-label': ariaLabel,
}: MoneyInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-erro`;

  const [text, setText] = useState(() =>
    valueInCents === null ? '' : formatDecimalInput(valueInCents),
  );
  const [error, setError] = useState<string | null>(null);

  const parsed = text.trim() === '' ? null : evaluateAmountExpression(text);
  const showsCalculation = isCalculation(text) && parsed !== null;

  function handleChange(next: string) {
    setText(next);

    // Durante a escrita só propagamos números simples: uma conta a meio
    // (`12,50 +`) não é um valor, e propagá-la faria o formulário oscilar.
    if (!isCalculation(next)) {
      const value = next.trim() === '' ? null : evaluateAmountExpression(next);
      setError(value === null && next.trim() !== '' ? 'Valor inválido.' : null);
      onValueChange?.(value);
    }
  }

  function commit() {
    if (text.trim() === '') {
      setError(null);
      onValueChange?.(null);
      return;
    }

    const value = evaluateAmountExpression(text);

    if (value === null) {
      // Nunca apagar o valor anterior por causa de uma expressão inválida.
      setError('Não consegui ler este valor. Podes escrever, por exemplo, 12,50 ou 12,50 + 3,20.');
      return;
    }

    setError(null);
    setText(formatDecimalInput(value));
    onValueChange?.(value);
    onCommit?.(value);
  }

  function cancel() {
    setError(null);
    setText(valueInCents === null ? '' : formatDecimalInput(valueInCents));
  }

  return (
    <div className={cn('space-y-1', className)}>
      <Input
        id={inputId}
        name={name}
        value={text}
        disabled={disabled}
        autoFocus={autoFocus}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
        className="font-numeric text-right tabular-nums"
        onChange={(event) => handleChange(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            cancel();
          }
        }}
      />

      {error !== null ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {error === null && showsCalculation && parsed !== null ? (
        <p className="text-xs text-muted-foreground">
          = <span className="tabular-nums">{formatCurrency(parsed, 'EUR')}</span>
        </p>
      ) : null}
    </div>
  );
}
