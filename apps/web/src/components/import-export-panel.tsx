'use client';

import { Download, FileDown, ShieldCheck } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { exportBackupJson, exportTransactionsCsv } from '@/server/export-actions';
import type { AccountView } from '@/server/accounts';

/**
 * Exportação.
 *
 * Duas saídas com propósitos diferentes, e o ecrã di-lo:
 * - o **CSV de lançamentos** usa exatamente o cabeçalho que o importador
 *   reconhece, por isso exportar e voltar a importar não duplica nada (o `Id`
 *   viaja como `fitId`);
 * - o **backup JSON** é a cópia de segurança completa, para não depender de
 *   ninguém — inclui todas as áreas da aplicação, não só os movimentos.
 *
 * Os filtros são opcionais: sem eles, o CSV leva tudo.
 */

/** Valor sentinela: o Radix Select reserva a string vazia. */
const ALL_ACCOUNTS = '__todas__';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

export function ImportExportPanel({ accounts }: { readonly accounts: readonly AccountView[] }) {
  const [pending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  function download(filename: string, content: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportCsv() {
    setError(null);

    startTransition(async () => {
      const result = await exportTransactionsCsv({
        accountId: accountId === '' ? undefined : accountId,
        from: from === '' ? undefined : from,
        to: to === '' ? undefined : to,
      });

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      // O BOM é o que faz o Excel em Portugal ler os acentos corretamente.
      const csv = result.data.content.startsWith('\uFEFF')
        ? result.data.content
        : `\uFEFF${result.data.content}`;

      download(result.data.filename, csv, 'text/csv;charset=utf-8');
      toast.success(`Exportei «${result.data.filename}».`);
    });
  }

  function exportBackup() {
    setError(null);

    startTransition(async () => {
      const result = await exportBackupJson();

      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      download(result.data.filename, result.data.content, 'application/json;charset=utf-8');
      toast.success(`Exportei «${result.data.filename}».`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exportar</CardTitle>
        <CardDescription>
          O CSV abre no Excel e volta a entrar pela importação, sem duplicar nada. O backup JSON é a
          cópia completa dos teus dados.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <section aria-labelledby="exportar-csv" className="space-y-3">
          <h3 id="exportar-csv" className="text-sm font-medium">
            Lançamentos em CSV
          </h3>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="exportar-conta">Conta</Label>
              <Select
                value={accountId === '' ? ALL_ACCOUNTS : accountId}
                onValueChange={(next) => setAccountId(next === ALL_ACCOUNTS ? '' : next)}
              >
                <SelectTrigger id="exportar-conta" className={`w-full ${TOUCH}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_ACCOUNTS}>Todas as contas</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Field data-invalid={error !== null && from !== '' && to !== '' && from > to}>
              <FieldLabel htmlFor="exportar-de">De</FieldLabel>
              <Input
                id="exportar-de"
                type="date"
                value={from}
                className={TOUCH}
                onChange={(event) => setFrom(event.target.value)}
              />
              <FieldError id="exportar-de-erro">
                {from !== '' && to !== '' && from > to
                  ? 'A data inicial é posterior à final.'
                  : undefined}
              </FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="exportar-ate">Até</FieldLabel>
              <Input
                id="exportar-ate"
                type="date"
                value={to}
                min={from === '' ? undefined : from}
                className={TOUCH}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
          </div>

          <FieldDescription>
            Sem filtros, o ficheiro leva todos os lançamentos. As datas são inclusivas.
          </FieldDescription>

          <Button
            type="button"
            variant="outline"
            className={TOUCH}
            disabled={pending || (from !== '' && to !== '' && from > to)}
            onClick={exportCsv}
          >
            <Download className="size-3.5" aria-hidden />
            {pending ? 'A exportar…' : 'Exportar lançamentos (CSV)'}
          </Button>
        </section>

        <section aria-labelledby="exportar-backup" className="space-y-3 border-t pt-5">
          <h3 id="exportar-backup" className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-muted-foreground" aria-hidden />
            Cópia de segurança completa
          </h3>

          <p className="text-sm text-muted-foreground">
            Um ficheiro JSON com contas, categorias, etiquetas, movimentos, cartões, faturas,
            objetivos, orçamentos, recorrências, regras, bens e passivos. Os montantes ficam em
            cêntimos inteiros e as datas em <span className="font-numeric">AAAA-MM-DD</span>.
          </p>

          <Button
            type="button"
            variant="outline"
            className={TOUCH}
            disabled={pending}
            onClick={exportBackup}
          >
            <FileDown className="size-3.5" aria-hidden />
            {pending ? 'A preparar…' : 'Descarregar backup (JSON)'}
          </Button>
        </section>

        {error === null ? null : (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
