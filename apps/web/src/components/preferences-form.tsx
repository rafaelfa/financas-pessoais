'use client';

import { Target } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { savePreferences } from '@/server/preferences-actions';

/** Dias possíveis para o início do mês: 1 a 28, como o schema aceita. */
const DIAS = Array.from({ length: 28 }, (_, indice) => indice + 1);

const REGIMES = [
  {
    value: 'CASH',
    label: 'Caixa',
    description: 'Uma compra no cartão só conta quando a fatura é paga.',
  },
  {
    value: 'ACCRUAL',
    label: 'Competência',
    description: 'Uma compra no cartão conta no dia da compra.',
  },
] as const;

/**
 * Preferências que o motor financeiro lê.
 *
 * Não há modelo de preferências: são duas colunas do utilizador
 * (`monthStartDay`, `accountingBasis`) que o painel, os relatórios e a
 * exportação já leem. Esta é a única forma de as escrever.
 */
export function PreferencesForm({
  monthStartDay,
  accountingBasis,
}: {
  readonly monthStartDay: number;
  readonly accountingBasis: 'cash' | 'accrual';
}) {
  const [dia, setDia] = useState(String(monthStartDay));
  const [regime, setRegime] = useState<'cash' | 'accrual'>(accountingBasis);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const radios = useRef<Array<HTMLButtonElement | null>>([]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErro(null);

    startTransition(async () => {
      /*
       * O `catch` é **obrigatório** e vive aqui, à volta do `await`, não à volta
       * do `startTransition`. Se o POST abortar (rede, servidor em baixo), a
       * promessa da Server Action rejeita; o React acompanha a transição mas não
       * apanha a rejeição, e ela sobe como unhandled rejection — o error boundary
       * do segmento substituía o ecrã inteiro por «Algo falhou ao carregar este
       * ecrã». Aqui o erro fica na página e o formulário continua utilizável.
       *
       * **Só o `await` está dentro do `try`.** Se o `try` cobrisse também o
       * `setErro` e o `toast`, uma falha *deles* passava a ler-se «não consegui
       * ligar ao servidor» — a mentir sobre a causa, num ecrã que existe para
       * dizer o que ficou gravado.
       */
      let resultado: Awaited<ReturnType<typeof savePreferences>>;

      try {
        resultado = await savePreferences({
          monthStartDay: Number(dia),
          accountingBasis: regime === 'accrual' ? 'ACCRUAL' : 'CASH',
        });
      } catch {
        setErro(
          'Não consegui ligar ao servidor — as preferências não foram guardadas. Verifica a ligação e tenta outra vez.',
        );
        return;
      }

      if (!resultado.ok) {
        setErro(resultado.error);
        return;
      }

      /*
       * O `revalidatePath` da ação re-renderiza o segmento e pode desmontar
       * este formulário (o `loading.tsx` do grupo entra pelo meio): o estado
       * local da confirmação não sobrevive. O `Toaster` vive no `AppShell`,
       * fora do segmento revalidado, por isso é o aviso que fica.
       */
      toast.success('Preferências guardadas.');
    });
  }

  /** Padrão ARIA de `radiogroup`: setas escolhem e movem o foco (roving tabindex). */
  function onRadioKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, indice: number) {
    const passo =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;

    if (passo === 0) {
      return;
    }

    event.preventDefault();

    const proximo = (indice + passo + REGIMES.length) % REGIMES.length;

    setRegime(REGIMES[proximo]?.value === 'ACCRUAL' ? 'accrual' : 'cash');
    radios.current[proximo]?.focus();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período mensal</CardTitle>
          <CardDescription>
            Se recebes a meio do mês, podes começar o teu mês nesse dia. Todos os totais e
            orçamentos passam a seguir esse calendário — a partir do dia seguinte, sem esperar pelo
            próximo mês.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="inicio-mes">O mês começa no dia</FieldLabel>
            <Select value={dia} onValueChange={setDia}>
              <SelectTrigger id="inicio-mes" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIAS.map((opcao) => (
                  <SelectItem key={opcao} value={String(opcao)}>
                    Dia {opcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Do dia 1 ao dia 28, para existir em todos os meses.</FieldDescription>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Moeda</CardTitle>
          <CardDescription>
            Os valores são guardados em cêntimos inteiros e apresentados em euros, no formato
            português. O euro é fixo nesta aplicação — não é uma preferência.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            <span className="font-medium">Euro (EUR)</span> · 1 234,56 €
          </p>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Regime de contabilização</CardTitle>
          <CardDescription>
            Decide quando é que uma compra no cartão entra nas contas. As duas leituras ficam sempre
            disponíveis no painel; esta escolha muda a que vem à frente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            role="radiogroup"
            aria-labelledby="regime-rótulo"
            className="grid gap-2 sm:grid-cols-2"
          >
            <span id="regime-rótulo" className="sr-only">
              Regime de contabilização
            </span>
            {REGIMES.map((opcao, indice) => {
              const ativo = opcao.value === (regime === 'accrual' ? 'ACCRUAL' : 'CASH');

              return (
                <button
                  key={opcao.value}
                  ref={(elemento) => {
                    radios.current[indice] = elemento;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  tabIndex={ativo ? 0 : -1}
                  onKeyDown={(event) => onRadioKeyDown(event, indice)}
                  onClick={() => setRegime(opcao.value === 'ACCRUAL' ? 'accrual' : 'cash')}
                  className={cn(
                    'flex min-h-11 flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition-colors',
                    ativo
                      ? 'border-transparent bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted',
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Target className="size-4" aria-hidden />
                    {opcao.label}
                  </span>
                  <span className={cn('text-xs', ativo ? 'opacity-90' : 'text-muted-foreground')}>
                    {opcao.description}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button type="submit" className="min-h-11 sm:min-h-9" disabled={pending}>
              {pending ? 'A guardar…' : 'Guardar preferências'}
            </Button>
            {erro === null ? (
              <FieldDescription>
                Ficam guardadas na tua conta e valem para o painel, o património, o orçamento e os
                relatórios.
              </FieldDescription>
            ) : (
              <p role="alert" className="text-xs text-destructive">
                {erro}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
