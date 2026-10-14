/**
 * Schemas de domínio: a fronteira de validação de tudo o que entra no sistema.
 *
 * Cada formulário e cada ação de servidor valida por aqui, com a mesma
 * definição. As mensagens de erro estão em português de Portugal e são escritas
 * para aparecer junto ao campo, não num registo técnico.
 */
export * from './primitives';
export * from './accounts';
export * from './categories';
export * from './transactions';
export * from './planning';
export * from './import';
export * from './receivable-payable';
