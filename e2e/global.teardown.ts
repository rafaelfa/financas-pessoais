import { apagarUtilizadoresDeTeste, contarUtilizadoresDeTeste } from './support/db';

/**
 * Limpeza da corrida.
 *
 * Apaga **todos** os utilizadores `e2e-*` — o partilhado, o do percurso de
 * registo e qualquer um que um teste tenha criado — e confirma que não ficou
 * nenhum. Se sobrar lixo, a corrida falha: um teste que deixa dados na base do
 * cliente não é um teste verde, é um teste que mente.
 */
export default async function globalTeardown(): Promise<void> {
  const apagados = await apagarUtilizadoresDeTeste();
  const restantes = await contarUtilizadoresDeTeste();

  console.log(
    `[e2e] limpeza: ${apagados} utilizador(es) de teste apagado(s); ${restantes} restante(s).`,
  );

  if (restantes > 0) {
    throw new Error(
      `Ficaram ${restantes} utilizador(es) e2e-* na base de dados: apaga-os à mão e investiga a limpeza.`,
    );
  }
}
