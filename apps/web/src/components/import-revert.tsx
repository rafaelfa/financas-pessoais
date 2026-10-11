'use client';

import { RotateCcw } from 'lucide-react';
import { useState, useSyncExternalStore, useTransition } from 'react';
import { toast } from 'sonner';

import { Amount } from '@/components/amount';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { revertImport } from '@/server/import-actions';
import type { ImportedTransactionRef } from '@/server/import-actions';

/**
 * Desfazer uma importação confirmada.
 *
 * **Onde vivem os identificadores.** A reversão precisa de saber exatamente o que
 * a importação escreveu, para só apagar o que continua igual. Esse recibo fica
 * guardado **neste browser** (`localStorage`, os últimos três lotes): sobrevive a
 * um recarregamento da página e não sobrevive a outro dispositivo — e é isso que
 * o ecrã diz, em vez de prometer uma rede que não existe.
 *
 * **O que nunca acontece.** Nem um movimento de outra importação, nem de outra
 * conta, nem de outro utilizador; nem um que tenha sido alterado depois (valor,
 * data, descrição, categoria, estado) ou ligado a uma fatura, objetivo,
 * transferência ou recorrência. Quem decide é a função pura `planRevert`, no
 * servidor — a interface mostra o resultado, incluindo o motivo de cada movimento
 * que ficou de pé.
 *
 * O `localStorage` é lido com `useSyncExternalStore` e não num efeito: é a forma
 * correta de sincronizar com um sistema externo, não provoca divergência de
 * hidratação (o servidor vê uma lista vazia) e ganha sincronização entre
 * separadores de graça.
 */

/** Recibo de uma importação, tal como fica guardado no browser. */
export interface ImportReceipt {
  /** Identificador do recibo: o instante da importação. */
  readonly id: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly importedAt: string;
  readonly expected: readonly ImportedTransactionRef[];
}

/** Chave do `localStorage`. */
const STORAGE_KEY = 'financas-pessoais:importacoes';

/** Quantos recibos se guardam. Acima disto, o mais antigo sai. */
const MAX_RECEIPTS = 3;

const EMPTY: readonly ImportReceipt[] = [];

let snapshot: readonly ImportReceipt[] = EMPTY;
let snapshotRaw: string | null = null;
const listeners = new Set<() => void>();

function parseReceipts(raw: string | null): ImportReceipt[] {
  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter(isReceipt).slice(0, MAX_RECEIPTS) : [];
  } catch {
    return [];
  }
}

function isReceipt(value: unknown): value is ImportReceipt {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<ImportReceipt>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.accountId === 'string' &&
    typeof candidate.accountName === 'string' &&
    typeof candidate.importedAt === 'string' &&
    Array.isArray(candidate.expected)
  );
}

function readRaw(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Modo privado ou armazenamento bloqueado: sem recibos, e a importação
    // continua a funcionar.
    return null;
  }
}

/** Instantâneo estável: só muda quando o `localStorage` muda. */
function getSnapshot(): readonly ImportReceipt[] {
  const raw = readRaw();

  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshot = parseReceipts(raw);
  }

  return snapshot;
}

/** No servidor não há `localStorage`: a lista é vazia e o HTML não mente. */
function getServerSnapshot(): readonly ImportReceipt[] {
  return EMPTY;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', listener);
  }

  return () => {
    listeners.delete(listener);

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', listener);
    }
  };
}

function write(receipts: readonly ImportReceipt[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    // Sem armazenamento, a oferta não sobrevive ao recarregamento.
  }

  snapshotRaw = null;

  for (const listener of listeners) {
    listener();
  }
}

/** Recibos do browser, sincronizados entre separadores. */
export function useImportReceipts(): readonly ImportReceipt[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Guarda o recibo de uma importação, à frente dos que já existem. */
export function saveImportReceipt(receipt: ImportReceipt): void {
  const next = [receipt, ...getSnapshot().filter((item) => item.id !== receipt.id)].slice(
    0,
    MAX_RECEIPTS,
  );

  write(next);
}

/** Esquece um recibo — depois de desfeito, ou quando já não existe nada dele. */
export function forgetImportReceipt(id: string): void {
  write(getSnapshot().filter((item) => item.id !== id));
}

export function ImportReceiptsPanel() {
  const receipts = useImportReceipts();

  if (receipts.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="importacoes-recentes" className="space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <h2 id="importacoes-recentes" className="font-heading text-base font-medium">
          Importações recentes
        </h2>
        <p className="text-sm text-muted-foreground">
          Podes desfazer uma importação enquanto os movimentos dela não tiverem sido alterados. A
          lista fica guardada neste browser — noutro dispositivo não aparece.
        </p>
      </div>

      <ul className="space-y-3">
        {receipts.map((receipt) => (
          <li key={receipt.id}>
            <ReceiptRow receipt={receipt} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReceiptRow({ receipt }: { readonly receipt: ImportReceipt }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<{
    deleted: number;
    skipped: readonly { reason: string }[];
    missingCount: number;
  } | null>(null);

  const range = dateRangeOf(receipt.expected);
  const totalInCents = receipt.expected.reduce((total, row) => total + row.amountInCents, 0);

  function confirmRevert() {
    startTransition(async () => {
      const result = await revertImport({
        accountId: receipt.accountId,
        expected: receipt.expected,
      });

      if (!result.ok) {
        toast.error(result.error);
        setOpen(false);
        return;
      }

      const { deleted, skipped, missing } = result.data;
      setOutcome({ deleted, skipped, missingCount: missing.length });
      setOpen(false);

      /*
       * Nunca anunciar sucesso quando não se apagou nada: «já não existem» é
       * informação, «0 apagados» com ar de sucesso seria ruído.
       */
      if (deleted > 0) {
        toast.success(deleted === 1 ? '1 movimento apagado.' : `${deleted} movimentos apagados.`);
      } else if (missing.length > 0) {
        toast.info('Estes movimentos já não existem: a importação já tinha sido desfeita.');
      } else {
        toast.info('Nada foi apagado: os movimentos foram alterados depois da importação.');
      }

      // Sem nada para desfazer (apagados ou já inexistentes), o recibo sai da lista.
      if (deleted > 0 || missing.length === receipt.expected.length) {
        forgetImportReceipt(receipt.id);
      }
    });
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {receipt.expected.length === 1
              ? '1 movimento'
              : `${receipt.expected.length} movimentos`}{' '}
            em «{receipt.accountName}»
          </p>
          <p className="text-xs text-muted-foreground">
            Importada a {formatDateTime(receipt.importedAt)}
            {range === null ? null : ` · ${formatDay(range.from)} a ${formatDay(range.to)}`} ·{' '}
            <Amount amountInCents={totalInCents} withSign tone="neutral" className="text-xs" />
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 sm:min-h-8"
          disabled={pending}
          onClick={() => {
            setOutcome(null);
            setOpen(true);
          }}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Desfazer importação
        </Button>
      </div>

      {outcome === null ? null : (
        <div className="space-y-1 text-sm">
          {outcome.deleted > 0 ? (
            <p className="text-muted-foreground">
              {outcome.deleted === 1
                ? '1 movimento foi apagado.'
                : `${outcome.deleted} movimentos foram apagados.`}
            </p>
          ) : null}

          {outcome.missingCount > 0 ? (
            <p className="text-muted-foreground">
              {outcome.missingCount === 1
                ? '1 movimento já não existia.'
                : `${outcome.missingCount} movimentos já não existiam.`}
            </p>
          ) : null}

          {outcome.skipped.length === 0 ? null : (
            <div className="space-y-1">
              <p className="font-medium">
                {outcome.skipped.length === 1
                  ? '1 movimento não foi apagado:'
                  : `${outcome.skipped.length} movimentos não foram apagados:`}
              </p>
              <ul className="space-y-0.5 text-muted-foreground">
                {outcome.skipped.map((skip, index) => (
                  <li key={`${skip.reason}-${index}`}>{skip.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {outcome.deleted === 0 ? (
            <p className="text-muted-foreground">
              Se quiseres corrigir estes movimentos, faz-lo no extrato — assim vês exatamente o que
              estás a alterar.
            </p>
          ) : null}
        </div>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <RotateCcw aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Desfazer esta importação?</AlertDialogTitle>
            <AlertDialogDescription>
              Vão ser apagados até{' '}
              <strong>
                {receipt.expected.length === 1
                  ? '1 movimento'
                  : `${receipt.expected.length} movimentos`}
              </strong>{' '}
              da conta «{receipt.accountName}»
              {range === null ? null : (
                <>
                  , entre {formatDay(range.from)} e {formatDay(range.to)}
                </>
              )}
              . Os movimentos que já foram alterados — ou que estão ligados a faturas, objetivos,
              transferências ou recorrências — <strong>não</strong> são apagados, e dizemos porquê
              no fim. Não há forma de recuperar o que for apagado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmRevert();
              }}
            >
              {pending ? 'A desfazer…' : 'Apagar os movimentos importados'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Limites do intervalo de datas do recibo. */
function dateRangeOf(
  expected: readonly ImportedTransactionRef[],
): { from: string; to: string } | null {
  if (expected.length === 0) {
    return null;
  }

  const dates = expected.map((row) => row.date).sort();

  return { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' };
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  if (date === '') {
    return '—';
  }

  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Data e hora da importação, para o recibo se identificar. */
function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'data desconhecida';
  }

  return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
