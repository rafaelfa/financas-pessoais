'use client';

import { FileUp, Info, Upload } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { ImportLimitations } from '@/components/import-limitations';
import { previewImport } from '@/server/import-actions';
import type { ImportPreview } from '@/server/import';
import type { AccountView } from '@/server/accounts';

/**
 * Escolha do ficheiro e da conta de destino.
 *
 * O conteúdo é lido **no browser** (`File.text()`) e enviado ao servidor, que
 * devolve o que *seria* criado. Duas coisas têm de ficar claras nesta fase, e por
 * isso estão escritas aqui e não num rodapé: nada é gravado enquanto não se
 * confirmar, e há três limitações do parser que produzem números errados com ar
 * de certos.
 */

/** Limite de tamanho do conteúdo, o mesmo do schema do servidor. */
const MAX_CONTENT_BYTES = 8_000_000;

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

type FormatChoice = 'auto' | 'ofx' | 'csv';

export function ImportFilePicker({
  accounts,
  onPreview,
}: {
  readonly accounts: readonly AccountView[];
  readonly onPreview: (preview: ImportPreview) => void;
}) {
  const activeAccounts = accounts.filter((account) => !account.archived);
  const [pending, startTransition] = useTransition();
  const [accountId, setAccountId] = useState(
    () => (activeAccounts.find((account) => account.isPrimary) ?? activeAccounts[0])?.id ?? '',
  );
  const [format, setFormat] = useState<FormatChoice>('auto');
  const [file, setFile] = useState<File | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const tooLarge = file !== null && file.size > MAX_CONTENT_BYTES;
  const canSubmit = accountId !== '' && file !== null && !tooLarge;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const selected = file;

    if (selected === null) {
      setFormError('Escolhe um ficheiro OFX ou CSV.');
      return;
    }

    startTransition(async () => {
      // Lido no browser: o ficheiro nunca vai para o servidor como anexo.
      const content = await selected.text();

      const result = await previewImport({
        accountId,
        content,
        format: format === 'auto' ? undefined : format,
      });

      if (!result.ok) {
        setFormError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }

      onPreview(result.data);
    });
  }

  if (activeAccounts.length === 0) {
    return (
      <Alert>
        <Info aria-hidden />
        <AlertTitle>Precisas de uma conta para importar</AlertTitle>
        <AlertDescription>
          Um extrato pertence sempre a uma conta. Cria a conta de destino primeiro — depois volta
          aqui e escolhe o ficheiro.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar um extrato</CardTitle>
        <CardDescription>
          Aceita OFX (1.x e 2.x) e CSV. Lemos o ficheiro no teu browser e mostramos linha a linha o
          que seria criado — antes de gravar seja o que for.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        <Alert>
          <Info aria-hidden />
          <AlertTitle>Nada é gravado até confirmares</AlertTitle>
          <AlertDescription>
            Esta pré-visualização só lê. Os movimentos entram na conta quando passares à confirmação
            e escolheres o que importar.
          </AlertDescription>
        </Alert>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="importar-conta">Conta de destino</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger
                  id="importar-conta"
                  aria-required
                  className={`w-full ${TOUCH}`}
                  aria-invalid={errorFor('accountId') !== undefined}
                  aria-describedby={
                    errorFor('accountId') === undefined ? undefined : 'importar-conta-erro'
                  }
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="importar-conta-erro">{errorFor('accountId')}</FieldError>
            </div>

            <div className="space-y-1">
              <Label htmlFor="importar-formato">Formato</Label>
              <Select
                value={format}
                onValueChange={(next) =>
                  setFormat(next === 'ofx' || next === 'csv' ? next : 'auto')
                }
              >
                <SelectTrigger id="importar-formato" className={`w-full ${TOUCH}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Detetar pelo ficheiro</SelectItem>
                  <SelectItem value="ofx">OFX</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Em automático, o formato sai do conteúdo: um OFX escolhido como CSV continuaria a
                ser lido como OFX.
              </p>
            </div>
          </div>

          <Field data-invalid={tooLarge}>
            <FieldLabel htmlFor="importar-ficheiro">Ficheiro</FieldLabel>
            <Input
              id="importar-ficheiro"
              type="file"
              accept=".ofx,.csv,.txt,text/csv,application/x-ofx"
              className={TOUCH}
              aria-invalid={tooLarge}
              aria-describedby={tooLarge ? 'importar-ficheiro-erro' : undefined}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setFormError(null);
              }}
            />
            <FieldDescription>
              {file === null
                ? 'Escolhe o ficheiro que o teu banco exportou.'
                : `${file.name} — ${formatBytes(file.size)}.`}
            </FieldDescription>
            <FieldError id="importar-ficheiro-erro">
              {tooLarge
                ? `O ficheiro tem ${formatBytes(file?.size ?? 0)} e o limite é ${formatBytes(MAX_CONTENT_BYTES)}. Divide o extrato por períodos.`
                : undefined}
            </FieldError>
          </Field>

          <ImportLimitations />

          {formError === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" className={TOUCH} disabled={pending || !canSubmit}>
              <Upload className="size-3.5" aria-hidden />
              {pending ? 'A ler o ficheiro…' : 'Pré-visualizar'}
            </Button>
          </div>
        </form>

        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileUp className="size-4 shrink-0" aria-hidden />A importação nunca cria contas nem
          categorias: só grava movimentos na conta que escolheres.
        </p>
      </CardContent>
    </Card>
  );
}

/** Tamanho de ficheiro legível. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} kB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
