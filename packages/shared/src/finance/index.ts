/**
 * Motor financeiro.
 *
 * Funções **puras** sobre dinheiro em cêntimos inteiros: recebem dados e
 * devolvem números, sem base de dados, sem React e sem relógio próprio — a data
 * de referência é sempre um parâmetro, para que os resultados sejam
 * reproduzíveis e testáveis.
 *
 * A Fase 1 do plano exige que este motor esteja correto **antes** de existir
 * qualquer ecrã: se a aritmética estiver errada, a interface só serve para
 * mostrar números errados com boa aparência.
 */
export * from './types';
export * from './catalog';
export * from './rows';
export * from './period';
export * from './recurrence';
export * from './forecast';
export * from './balance';
export * from './result';
export * from './budget';
export * from './invoice';
export * from './goal';
export * from './netWorth';
export * from './rules';
