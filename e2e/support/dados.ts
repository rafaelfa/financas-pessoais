/**
 * Dados dos testes ponta a ponta.
 *
 * Os utilizadores são criados com um e-mail único (`e2e-…@exemplo.pt`) e
 * apagados sempre no fim: no arranque (restos de uma corrida interrompida) e no
 * `globalTeardown`. O prefixo `e2e-` é o contrato entre os dois.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Palavra-passe dos utilizadores de teste. Não é um segredo: só existe em testes. */
export const PALAVRA_PASSE = 'palavra-de-teste-e2e-123';

/** Nome mostrado nos ecrãs. */
export const NOME_DE_TESTE = 'Teste E2E';

/** Quantas categorias o aprovisionamento cria (o mesmo número que o fumo verifica). */
export const CATEGORIAS_APROVISIONADAS = 29;

/** A carteira que o aprovisionamento cria para quem se regista. */
export const CONTA_PRINCIPAL = 'Carteira principal';

/** Categoria de topo usada no percurso do orçamento. */
export const CATEGORIA_ALIMENTACAO = 'Alimentação';

/** E-mail único por corrida e por etiqueta. */
export function emailDeTeste(etiqueta: string): string {
  const agora = Date.now().toString(36);
  const aleatorio = Math.random().toString(36).slice(2, 8);

  return `e2e-${etiqueta}-${agora}-${aleatorio}@exemplo.pt`;
}

/** Ficheiro de sessão guardado pelo `globalSetup` (o `storageState` dos testes). */
export const ESTADO_DE_SESSAO = 'e2e/.auth/utilizador.json';

/** Ficheiro com as credenciais do utilizador partilhado, escrito pelo `globalSetup`. */
export const CREDENCIAIS_DO_UTILIZADOR = 'e2e/.results/utilizador.json';

/** O utilizador partilhado da corrida. */
export interface CredenciaisDoUtilizador {
  readonly email: string;
  readonly palavraPasse: string;
  readonly criadoEm: string;
}

/** Lê as credenciais escritas pelo `globalSetup`. Falha alto se não existirem. */
export function lerCredenciais(): CredenciaisDoUtilizador {
  const caminho = resolve(process.cwd(), CREDENCIAIS_DO_UTILIZADOR);

  if (!existsSync(caminho)) {
    throw new Error(
      `Não encontrei ${CREDENCIAIS_DO_UTILIZADOR}: o globalSetup não correu ou falhou. Corre «pnpm test:e2e» do início.`,
    );
  }

  return JSON.parse(readFileSync(caminho, 'utf8')) as CredenciaisDoUtilizador;
}
