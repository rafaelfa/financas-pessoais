import { z } from 'zod';

import { isoDateSchema } from '../primitives';

/**
 * Primitivas do domínio financeiro.
 *
 * Os erros são escritos em português de Portugal e em linguagem de utilizador:
 * vão aparecer na interface, junto ao campo que falhou, e não num log.
 */

/** Data de calendário, sem hora. Validada como data real (fevereiro não tem 30). */
export const calendarDateSchema = isoDateSchema;

/** Dia do mês em que o período começa. Acima de 28 haveria meses sem esse dia. */
export const monthStartDaySchema = z
  .number()
  .int('O dia de início do mês tem de ser um número inteiro.')
  .min(1, 'O dia de início do mês tem de estar entre 1 e 28.')
  .max(28, 'O dia de início do mês tem de estar entre 1 e 28.');

/** Percentagem, usada em limiares de alerta. */
export const percentageSchema = z
  .number()
  .min(0, 'A percentagem não pode ser negativa.')
  .max(100, 'A percentagem não pode ser superior a 100.');

/** Montante em cêntimos inteiros, com sinal. */
export const centsSchema = z
  .int('O valor tem de ser um número inteiro de cêntimos.')
  .min(-999_999_999_99, 'Valor acima do limite suportado.')
  .max(999_999_999_99, 'Valor acima do limite suportado.');

/** Montante em cêntimos estritamente positivo (magnitude de um movimento). */
export const positiveCentsSchema = centsSchema.positive('O valor tem de ser maior que zero.');

/** Montante em cêntimos que pode ser zero (saldos, valores de bens). */
export const nonNegativeCentsSchema = centsSchema.min(0, 'O valor não pode ser negativo.');

/** Cor em hexadecimal, para categorias e etiquetas. */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Usa uma cor no formato #RRGGBB.');

/** Nome curto de utilizador: contas, categorias, objetivos. */
export const shortNameSchema = z
  .string()
  .trim()
  .min(1, 'Dá um nome.')
  .max(80, 'O nome não pode ter mais de 80 caracteres.');

/** Descrição livre de um lançamento. */
export const descriptionSchema = z
  .string()
  .trim()
  .max(280, 'A descrição não pode ter mais de 280 caracteres.');

/** Identificador de um registo existente. */
export const entityIdSchema = z.string().trim().min(1, 'Falta o identificador.');
