/**
 * Importação e exportação de extratos.
 *
 * Tudo o que é puro vive aqui: os parsers (`ofx.ts`, `csv.ts`), a conversão de
 * valores para cêntimos (`cents.ts`), a decisão de estados e duplicados
 * (`preview.ts`) e as peças comuns (`issue.ts`). A camada de servidor
 * (`apps/web/src/server/import-actions.ts`) só acrescenta o que precisa de base
 * de dados: ler o que já existe na conta e gravar o que foi escolhido.
 *
 * Essa separação é o que permite testar a importação — a parte que pode
 * estragar todos os saldos — sem base de dados e com as amostras reais em
 * `docs/spec/samples/`.
 */
export * from './issue';
export * from './cents';
export * from './digest';
export * from './ofx';
export * from './csv';
export * from './preview';
export * from './revert';
