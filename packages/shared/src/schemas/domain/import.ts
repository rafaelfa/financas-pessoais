import { z } from 'zod';

import { calendarDateSchema, centsSchema, entityIdSchema } from './primitives';

/**
 * Schemas da importação e da exportação de extratos.
 *
 * A validação fica toda aqui, como no resto do domínio: a camada de servidor não
 * inventa regras e a interface mostra as mesmas mensagens que o servidor aplica.
 *
 * Duas regras que estes schemas fixam e que não podem ser negociadas a jusante:
 * - o valor é sempre **cêntimos inteiros** (`centsSchema`), nunca um decimal;
 * - a importação **nunca** cria contas nem categorias — só aceita referências que
 *   já existem e que a ação confirma serem do utilizador.
 */

/** Formato do ficheiro. `ofx` cobre OFX 1.x SGML e 2.x XML. */
export const importFormatSchema = z.enum(['ofx', 'csv']);

/** Estado de uma linha na pré-visualização. */
export const importRowStatusSchema = z.enum(['new', 'duplicate', 'suspicious']);

/**
 * `z.coerce.number()` porque o conteúdo chega de um `FormData` (texto) e de uma
 * Server Action (número): as duas formas descrevem a mesma coisa.
 */
const coercedCentsSchema = z.coerce.number().pipe(centsSchema);

/** Uma linha interpretada, tal como a pré-visualização a devolve. */
export const importRowSchema = z.object({
  index: z.number().int().min(0),
  date: calendarDateSchema.nullable(),
  description: z.string().trim().max(280),
  amountInCents: coercedCentsSchema.nullable(),
  fitId: z.string().trim().max(80).nullable(),
  status: importRowStatusSchema,
  reason: z.string().trim().max(280).nullable(),
  selected: z.boolean(),
  suggestedCategoryId: entityIdSchema.nullable(),
  suggestedCategoryName: z.string().trim().max(80).nullable(),
  sourceLine: z.number().int().min(1),
});

/**
 * Linha enviada pelo cliente para gravar.
 *
 * Os campos que descrevem o ficheiro (`status`, `reason`, `sourceLine`) **não**
 * são aceites: o cliente diz *o que* gravar, não *em que estado está*. Só a
 * data, o valor, a descrição, o `fitId` e a categoria escolhida atravessam.
 */
export const importRowInputSchema = z.object({
  date: calendarDateSchema.nullable(),
  description: z.string().trim().max(280),
  amountInCents: coercedCentsSchema.nullable(),
  fitId: z.string().trim().max(80).nullish(),
  categoryId: entityIdSchema.nullish(),
});

/** Limite de linhas por importação. Acima disto, o extrato é dividido. */
export const MAX_IMPORT_ROWS = 2_000;

export const confirmImportSchema = z.object({
  accountId: entityIdSchema,
  rows: z
    .array(importRowInputSchema)
    .min(1, 'Não escolheste nenhuma linha para importar.')
    .max(MAX_IMPORT_ROWS, `Uma importação não pode passar de ${MAX_IMPORT_ROWS} linhas.`),
});

/**
 * Pedido de reversão de uma importação confirmada.
 *
 * Leva os identificadores que a importação criou **e o que ela escreveu** em cada
 * um: a reversão só apaga o movimento que continua exatamente igual ao que foi
 * gravado. Não existe uma variante «apagar tudo o que veio de importações desta
 * conta» — seria a versão de dano máximo, e apagaria importações antigas que
 * ninguém pediu para desfazer.
 *
 * A descrição chega como **impressão digital** (`sha256` em hexadecimal) e não
 * como texto: este pedido nasce de um recibo guardado no browser, e o browser não
 * deve ter lá descrições de extratos. O servidor calcula a impressão digital do
 * valor que está na base e compara as duas.
 */
export const revertImportSchema = z.object({
  accountId: entityIdSchema,
  expected: z
    .array(
      z.object({
        transactionId: entityIdSchema,
        fitId: z.string().trim().max(80).nullish(),
        date: calendarDateSchema,
        amountInCents: centsSchema,
        descriptionDigest: z
          .string()
          .trim()
          .regex(/^[0-9a-f]{64}$/, 'Impressão digital da descrição inválida.'),
        categoryId: entityIdSchema.nullish(),
      }),
    )
    .min(1, 'Não há nada para desfazer.')
    .max(MAX_IMPORT_ROWS, `Uma reversão não pode passar de ${MAX_IMPORT_ROWS} movimentos.`),
});

/**
 * Pedido de pré-visualização.
 *
 * O `format` é opcional: quando não vem, é detetado a partir do conteúdo — quem
 * escolhe "CSV" para um ficheiro OFX não deve receber uma pré-visualização vazia,
 * porque o ficheiro sabe o que é.
 */
export const previewImportSchema = z.object({
  accountId: entityIdSchema,
  content: z
    .string()
    .min(1, 'Escolhe um ficheiro ou cola o extrato.')
    .max(8_000_000, 'O ficheiro é demasiado grande.'),
  format: importFormatSchema.optional(),
});

export const exportTransactionsSchema = z
  .object({
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
    accountId: entityIdSchema.optional(),
  })
  .optional();

export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;
export type PreviewImportInput = z.infer<typeof previewImportSchema>;
export type ExportTransactionsInput = z.infer<typeof exportTransactionsSchema>;
export type RevertImportInput = z.infer<typeof revertImportSchema>;

/*
 * `ImportFormat`, `ImportRowStatus` e `ImportRowInput` **não** são reexportados
 * como tipos daqui: já existem em `src/import/` (`preview.ts` e `csv.ts`), e os
 * dois barris (`./schemas` e `./import`) colidiriam em `src/index.ts`. Os nomes
 * do esquema e os do parser continuam a ser os mesmos valores — o literal do
 * enum —, e é `satisfies` em `preview.ts` que garante que não divergem.
 */
