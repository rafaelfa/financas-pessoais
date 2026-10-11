'use client';

import { FileUp, Info, Upload } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ImportLimitations } from '@/components/import-limitations';
import { previewImport } from '@/server/import-actions';
import type { ImportPreview } from '@/server/import';
import type { AccountView } from '@/server/accounts';

/**
 * Escolha da origem (ficheiro ou texto colado) e da conta de destino.
 *
 * O conteúdo é lido **no browser** (`File.text()` ou o que estiver na textarea) e
 * enviado ao servidor, que devolve o que *seria* criado. Duas coisas têm de ficar
 * claras nesta fase, e por isso estão escritas aqui e não num rodapé: nada é
 * gravado enquanto não se confirmar, e há três limitações do parser que produzem
 * números errados com ar de certos.
 *
 * As duas origens dão no **mesmo** percurso a jusante: daqui sai sempre uma
 * `ImportPreview` pela mesma callback, e a pré-visualização e a confirmação nunca
 * souberam de onde o texto veio. A única coisa que muda é como o texto chega
 * aqui.
 *
 * Ao colar, o formato **não** é adivinhado em silêncio: um extrato colado não
 * traz nome de ficheiro, por isso é o utilizador que diz se é OFX ou CSV, e a
 * resposta é obrigatória antes de se tentar ler. (No ficheiro mantém-se a
 * deteção automática: ali há um nome e um conteúdo que o parser reconhece.)
 */

/** Limite de tamanho do conteúdo, o mesmo do schema do servidor. */
const MAX_CONTENT_BYTES = 8_000_000;

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-8';

/** Formato, como o utilizador o declara para um ficheiro. */
type FormatChoice = 'auto' | 'ofx' | 'csv';

/** Formato declarado para texto colado: sem deteção automática. */
type PastedFormat = 'ofx' | 'csv';

/** De onde vem o extrato. */
type SourceMode = 'file' | 'text';

export function ImportFilePicker({
  accounts,
  onPreview,
}: {
  readonly accounts: readonly AccountView[];
  readonly onPreview: (preview: ImportPreview) => void;
}) {
  const activeAccounts = accounts.filter((account) => !account.archived);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<SourceMode>('file');
  const [accountId, setAccountId] = useState(
    () => (activeAccounts.find((account) => account.isPrimary) ?? activeAccounts[0])?.id ?? '',
  );
  const [format, setFormat] = useState<FormatChoice>('auto');
  const [pastedFormat, setPastedFormat] = useState<PastedFormat | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formatMissing, setFormatMissing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const formatTrigger = useRef<HTMLButtonElement>(null);
  const isFirstMode = useRef(true);

  /*
   * Foco gerido ao alternar: quem muda de aba pelo teclado aterra no controlo que
   * a aba acabou de mostrar, em vez de ter de o procurar com `Tab`. O primeiro
   * render é ignorado para o ecrã não roubar o foco a quem chega à página.
   */
  useEffect(() => {
    if (isFirstMode.current) {
      isFirstMode.current = false;
      return;
    }

    if (mode === 'text') {
      textarea.current?.focus();
    } else {
      fileInput.current?.focus();
    }
  }, [mode]);

  function errorFor(field: string): string | undefined {
    return fieldErrors[field]?.[0];
  }

  const tooLargeFile = file !== null && file.size > MAX_CONTENT_BYTES;
  const tooLargeText = text.length > MAX_CONTENT_BYTES;
  const hasSource =
    mode === 'file' ? file !== null && !tooLargeFile : text.trim() !== '' && !tooLargeText;
  const canSubmit = accountId !== '' && hasSource;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    // Capturado antes do `await`: o ficheiro escolhido não pode mudar a meio.
    const selectedFile = file;

    if (mode === 'file') {
      if (selectedFile === null) {
        setFormError('Escolhe um ficheiro OFX ou CSV.');
        return;
      }
    } else {
      if (text.trim() === '') {
        setFormError('Cola o extrato antes de pré-visualizar.');
        return;
      }

      /*
       * O formato é obrigatório no caminho do texto colado. Um extrato colado não
       * traz nome de ficheiro, e o servidor detetava-o sozinho a partir do
       * conteúdo: uma escolha errada aparecia como uma pré-visualização vazia, com
       * o motivo escondido nos «problemas de leitura». Aqui não se adivinha —
       * pede-se, e diz-se o que falta no campo que o resolve, com `aria-invalid` e
       * a mensagem ligada por `aria-describedby`.
       */
      if (pastedFormat === '') {
        setFormatMissing(true);
        formatTrigger.current?.focus();
        return;
      }
    }

    const declared =
      mode === 'file'
        ? format === 'auto'
          ? undefined
          : format
        : pastedFormat === ''
          ? undefined
          : pastedFormat;

    startTransition(async () => {
      // Lido no browser: o ficheiro nunca vai para o servidor como anexo.
      const content = mode === 'file' && selectedFile !== null ? await selectedFile.text() : text;

      const result = await previewImport({ accountId, content, format: declared });

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
          Aceita OFX (1.x e 2.x) e CSV. Podes dar-nos o ficheiro do banco ou colar o extrato. Lemos
          tudo no teu browser e mostramos linha a linha o que seria criado — antes de gravar seja o
          que for.
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

          <Tabs
            value={mode}
            onValueChange={(next) => {
              setMode(next === 'text' ? 'text' : 'file');
              setFormError(null);
            }}
            className="gap-3"
          >
            <TabsList
              aria-label="Como dás o extrato"
              className="min-h-11 w-full sm:min-h-8 sm:w-fit"
            >
              <TabsTrigger value="file">Ficheiro</TabsTrigger>
              <TabsTrigger value="text">Colar texto</TabsTrigger>
            </TabsList>

            {/*
              O painel não entra na ordem de tabulação (`tabIndex={-1}`): o Radix
              dá-lhe `tabIndex={0}` por omissão mas a moldura não desenha foco
              visível, o que criava uma paragem de teclado sem indicador. Quem
              lá precisa de entrar tem, dentro, o campo de ficheiro ou a textarea.
            */}
            <TabsContent value="file" tabIndex={-1} className="space-y-4">
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

              <Field data-invalid={tooLargeFile}>
                <FieldLabel htmlFor="importar-ficheiro">Ficheiro</FieldLabel>
                <Input
                  id="importar-ficheiro"
                  ref={fileInput}
                  type="file"
                  accept=".ofx,.csv,.txt,text/csv,application/x-ofx"
                  className={TOUCH}
                  aria-invalid={tooLargeFile}
                  aria-describedby={tooLargeFile ? 'importar-ficheiro-erro' : undefined}
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
                  {tooLargeFile
                    ? `O ficheiro tem ${formatBytes(file?.size ?? 0)} e o limite é ${formatBytes(MAX_CONTENT_BYTES)}. Divide o extrato por períodos.`
                    : errorFor('content')}
                </FieldError>
              </Field>
            </TabsContent>

            <TabsContent value="text" tabIndex={-1} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="importar-formato-texto">Formato do que colaste</Label>
                <Select
                  value={pastedFormat}
                  onValueChange={(next) => {
                    setPastedFormat(next === 'ofx' || next === 'csv' ? next : '');
                    setFormatMissing(false);
                  }}
                >
                  <SelectTrigger
                    id="importar-formato-texto"
                    ref={formatTrigger}
                    aria-required
                    className={`w-full ${TOUCH}`}
                    aria-invalid={formatMissing}
                    aria-describedby={
                      formatMissing ? 'importar-formato-texto-erro' : 'importar-formato-texto-ajuda'
                    }
                  >
                    <SelectValue placeholder="Escolhe o formato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ofx">OFX (o mais comum nos bancos)</SelectItem>
                    <SelectItem value="csv">CSV (vírgulas ou ponto e vírgula)</SelectItem>
                  </SelectContent>
                </Select>
                <p id="importar-formato-texto-ajuda" className="text-sm text-muted-foreground">
                  Um extrato colado não traz nome de ficheiro, por isso diz-nos o que é: não
                  adivinhamos. Se te enganares, a pré-visualização avisa antes de gravar nada.
                </p>
                <FieldError id="importar-formato-texto-erro">
                  {formatMissing ? 'Diz-nos se o que colaste é OFX ou CSV.' : undefined}
                </FieldError>
              </div>

              <Field data-invalid={tooLargeText}>
                <FieldLabel htmlFor="importar-texto">Extrato colado</FieldLabel>
                <Textarea
                  id="importar-texto"
                  ref={textarea}
                  value={text}
                  rows={10}
                  spellCheck={false}
                  autoComplete="off"
                  className="font-numeric min-h-40 w-full text-xs"
                  aria-invalid={tooLargeText}
                  aria-describedby={
                    tooLargeText ? 'importar-texto-erro' : 'importar-texto-descricao'
                  }
                  placeholder={
                    'OFXHEADER:100\nDATA:OFXSGML\n<OFX><BANKMSGSRSV1>…\n\nou\n\nData;Descrição;Valor\n2026-09-30;Compra no supermercado;-12,50'
                  }
                  onChange={(event) => {
                    setText(event.target.value);
                    setFormError(null);
                  }}
                />
                <FieldDescription id="importar-texto-descricao">
                  {text.trim() === ''
                    ? 'Cola aqui o extrato tal como o copiaste do homebanking.'
                    : `Extrato colado — ${text.length.toLocaleString('pt-PT')} caracteres.`}
                </FieldDescription>
                <FieldError id="importar-texto-erro">
                  {tooLargeText
                    ? `O texto colado tem ${text.length.toLocaleString('pt-PT')} caracteres e o limite é ${MAX_CONTENT_BYTES.toLocaleString('pt-PT')}. Divide o extrato por períodos.`
                    : errorFor('content')}
                </FieldError>
              </Field>
            </TabsContent>
          </Tabs>

          <ImportLimitations />

          {formError === null ? null : (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" className={TOUCH} disabled={pending || !canSubmit}>
              <Upload className="size-3.5" aria-hidden />
              {pending
                ? mode === 'file'
                  ? 'A ler o ficheiro…'
                  : 'A ler o texto…'
                : 'Pré-visualizar'}
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
