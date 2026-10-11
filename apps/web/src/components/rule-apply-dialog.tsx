'use client';

import { Info, ListFilter, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { applyRules } from '@/server/rules-actions';

/**
 * Pré-visualização e aplicação das regras.
 *
 * Este diálogo existe por causa de uma regra de produto: **nada se aplica sem
 * primeiro se ver o que mudaria**. A pré-visualização é calculada no servidor
 * (`previewRules`) e não altera nada; o botão de aplicar só aparece quando há
 * mesmo algo a fazer, e só depois de a lista estar à frente.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

/** Uma transação que uma regra iria categorizar. */
export interface RulePreviewMatch {
  readonly transactionId: string;
  readonly transactionDate: string;
  readonly transactionDescription: string;
  readonly transactionAmountInCents: number;
  readonly ruleName: string;
  readonly categoryName: string;
  readonly reason: string;
}

/** O que `previewRules()` devolve: a contagem e o que seria feito. */
export interface RulePreview {
  readonly uncategorizedCount: number;
  readonly matches: readonly RulePreviewMatch[];
}

export function RuleApplyDialog({ preview }: { readonly preview: RulePreview | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(true);

  function close() {
    setOpen(false);
    // O diálogo abre por URL (`?prever=1`), para a pré-visualização ser
    // calculada no servidor. Fechar é voltar ao URL limpo.
    router.replace('/regras');
  }

  function apply() {
    startTransition(async () => {
      const result = await applyRules();

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const applied = result.data.applied;

      toast.success(
        applied === 0
          ? 'Nada foi alterado.'
          : applied === 1
            ? '1 lançamento categorizado.'
            : `${applied} lançamentos categorizados.`,
        {
          description:
            applied === 0
              ? 'Entre a pré-visualização e a aplicação, nada ficou por categorizar.'
              : 'Podes voltar a pré-visualizar para confirmar.',
        },
      );

      setOpen(false);
      router.replace('/regras');
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          close();
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pré-visualização: aplicar regras</DialogTitle>
          <DialogDescription>
            Nada foi alterado ainda. Isto é o que <strong>seria</strong> feito se aplicasses agora.
          </DialogDescription>
        </DialogHeader>

        {preview === null ? (
          <div className="space-y-4">
            <p role="alert" className="text-sm text-destructive">
              Não consegui calcular a pré-visualização. Tenta outra vez daqui a pouco.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" className={TOUCH} onClick={close}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={preview.uncategorizedCount > 0 ? 'secondary' : 'outline'}>
                {preview.uncategorizedCount === 1
                  ? '1 lançamento sem categoria'
                  : `${preview.uncategorizedCount} lançamentos sem categoria`}
              </Badge>
              <Badge variant={preview.matches.length > 0 ? 'secondary' : 'outline'}>
                {preview.matches.length === 1
                  ? '1 seria categorizado'
                  : `${preview.matches.length} seriam categorizados`}
              </Badge>
            </div>

            {preview.matches.length === 0 ? (
              <Alert>
                <Info aria-hidden />
                <AlertTitle>Nenhuma regra corresponde a estes lançamentos</AlertTitle>
                <AlertDescription>
                  Só se aplicam regras ativas e com pelo menos uma condição, e só a lançamentos de
                  gasto ou ganho que ainda não tenham categoria e não estejam ignorados. Se
                  esperavas que alguma regra pegasse, confirma a condição e a ordem de prioridade.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Alert>
                  <TriangleAlert aria-hidden />
                  <AlertTitle>Só a primeira regra que corresponder é usada</AlertTitle>
                  <AlertDescription>
                    A lista está por ordem de prioridade. Um lançamento só recebe uma categoria, e
                    vem da primeira regra que o apanhar.
                  </AlertDescription>
                </Alert>

                <div className="max-h-80 overflow-y-auto rounded-lg border">
                  <Table>
                    <TableCaption className="sr-only">
                      Lançamentos que seriam categorizados e por que regra
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Data</TableHead>
                        <TableHead>Lançamento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Regra</TableHead>
                        <TableHead>Categoria</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.matches.map((match) => (
                        <TableRow key={match.transactionId}>
                          <TableCell className="font-numeric text-muted-foreground tabular-nums">
                            {formatDay(match.transactionDate)}
                          </TableCell>
                          <TableCell className="max-w-[16rem] whitespace-normal">
                            <span className="block truncate">
                              {match.transactionDescription.trim() === ''
                                ? 'Sem descrição'
                                : match.transactionDescription}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {match.reason}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Amount
                              amountInCents={match.transactionAmountInCents}
                              withSign
                              className="whitespace-nowrap"
                            />
                          </TableCell>
                          <TableCell>{match.ruleName}</TableCell>
                          <TableCell>{match.categoryName}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className={TOUCH}
                disabled={pending}
                onClick={close}
              >
                Cancelar
              </Button>
              {preview.matches.length === 0 ? null : (
                <Button type="button" className={TOUCH} disabled={pending} onClick={apply}>
                  <ListFilter className="size-3.5" aria-hidden />
                  {pending
                    ? 'A aplicar…'
                    : preview.matches.length === 1
                      ? 'Aplicar a 1 lançamento'
                      : `Aplicar a ${preview.matches.length} lançamentos`}
                </Button>
              )}
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
