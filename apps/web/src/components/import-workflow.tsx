'use client';

import { CircleCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';

import { ImportFilePicker } from '@/components/import-file-picker';
import { ImportPreviewPanel } from '@/components/import-preview';
import { ImportReceiptsPanel, saveImportReceipt } from '@/components/import-revert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AccountView } from '@/server/accounts';
import type { CategoryView } from '@/server/categories';
import type { ImportPreview } from '@/server/import';
import type { ConfirmImportResult } from '@/server/import-actions';

/**
 * O percurso da importação, em três estados: escolher → pré-visualizar →
 * confirmado.
 *
 * O estado vive aqui, num sítio só, para o ecrã nunca mostrar duas fases ao mesmo
 * tempo (uma pré-visualização por baixo de um resultado antigo é a forma mais
 * fácil de importar duas vezes o mesmo ficheiro por engano).
 *
 * Depois de confirmar, fica o **recibo** do que foi criado — guardado no browser —
 * e é ele que alimenta a oferta de desfazer. A oferta sobrevive a um
 * recarregamento da página; quando o recibo não existe, a interface não oferece
 * nada, em vez de oferecer um apagar validado por adivinhação.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function ImportWorkflow({
  accounts,
  categories,
}: {
  readonly accounts: readonly AccountView[];
  readonly categories: readonly CategoryView[];
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ConfirmImportResult | null>(null);

  function handleConfirmed(confirmed: ConfirmImportResult) {
    const conta = preview;

    /*
     * Guarda-se o recibo do que foi criado — o conteúdo exato por linha — porque
     * é ele que permite desfazer sem adivinhar. Sem recibo, a oferta de desfazer
     * simplesmente não aparece: uma limitação honesta em vez de um apagar
     * validado por uma heurística.
     */
    if (conta !== null && confirmed.imported.length > 0) {
      const importedAt = new Date().toISOString();

      saveImportReceipt({
        id: importedAt,
        accountId: conta.accountId,
        accountName: conta.accountName,
        importedAt,
        expected: confirmed.imported,
      });
    }

    setPreview(null);
    setResult(confirmed);

    toast.success(
      confirmed.created === 1
        ? '1 movimento importado.'
        : `${confirmed.created} movimentos importados.`,
    );
  }

  return (
    <div className="space-y-5">
      {result !== null ? (
        <ImportResult result={result} onReset={() => setResult(null)} />
      ) : preview !== null ? (
        <ImportPreviewPanel
          preview={preview}
          categories={categories}
          onConfirmed={handleConfirmed}
          onCancel={() => setPreview(null)}
        />
      ) : (
        <ImportFilePicker
          accounts={accounts}
          onPreview={(next) => {
            setPreview(next);
            toast.success(
              next.rows.length === 1
                ? 'Li 1 linha do ficheiro.'
                : `Li ${next.rows.length} linhas do ficheiro.`,
            );
          }}
        />
      )}

      <ImportReceiptsPanel />
    </div>
  );
}

/** Fim do percurso: o que entrou, o que ficou de fora e o que fazer a seguir. */
function ImportResult({
  result,
  onReset,
}: {
  readonly result: ConfirmImportResult;
  readonly onReset: () => void;
}) {
  const { created, alreadyExists, skippedRows } = result;
  const nothingLeftBehind = alreadyExists === 0 && skippedRows.length === 0;

  /*
   * Os motivos vêm do servidor em português e agrupam-se por texto: num extrato
   * com 200 linhas, repetir «Sem data» 40 vezes não informa ninguém.
   */
  const reasons = new Map<string, number>();

  for (const row of skippedRows) {
    reasons.set(row.reason, (reasons.get(row.reason) ?? 0) + 1);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importação concluída</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="flex items-start gap-2 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-income" aria-hidden />
          <span>
            <strong>
              {created === 1 ? '1 movimento importado' : `${created} movimentos importados`}
            </strong>
            {nothingLeftBehind ? '. Nenhuma linha foi deixada de fora.' : '.'}
          </span>
        </p>

        {alreadyExists === 0 ? null : (
          <p className="text-sm text-muted-foreground">
            {alreadyExists === 1
              ? '1 linha já existia na conta (o mesmo identificador do banco) e não foi criada outra vez.'
              : `${alreadyExists} linhas já existiam na conta (o mesmo identificador do banco) e não foram criadas outra vez.`}
          </p>
        )}

        {reasons.size === 0 ? null : (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {skippedRows.length === 1
                ? '1 linha não foi importada:'
                : `${skippedRows.length} linhas não foram importadas:`}
            </p>
            <ul className="space-y-0.5">
              {[...reasons].map(([reason, count]) => (
                <li key={reason}>
                  {count === 1 ? '1 linha' : `${count} linhas`} — {reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className={TOUCH}>
            <Link href="/transacoes">Ver os lançamentos</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className={TOUCH}>
            <Link href="/contas">Ver o saldo das contas</Link>
          </Button>
          <Button type="button" size="sm" className={TOUCH} onClick={onReset}>
            Importar outro ficheiro
          </Button>
        </div>

        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Enganaste-te nalguma linha? Podes desfazer esta importação na lista abaixo, enquanto os
          movimentos não tiverem sido alterados. Reimportar o mesmo ficheiro também não duplica
          nada: cada movimento guarda o identificador do banco (`fitId`).
        </p>
      </CardContent>
    </Card>
  );
}
