import { mkdirSync, writeFileSync } from 'node:fs';

import { request } from '@playwright/test';

import {
  CATEGORIAS_APROVISIONADAS,
  CONTA_PRINCIPAL,
  CREDENCIAIS_DO_UTILIZADOR,
  ESTADO_DE_SESSAO,
  NOME_DE_TESTE,
  PALAVRA_PASSE,
  emailDeTeste,
} from './support/dados';
import { apagarUtilizadoresDeTeste, lerAprovisionamento } from './support/db';

/**
 * Preparação da corrida.
 *
 * **Limpa primeiro, cria depois.** Os utilizadores `e2e-*` de uma corrida
 * anterior que tenha rebentado a meio são apagados aqui; é isso que garante que
 * a base fica como estava mesmo quando o processo morre sem correr o teardown.
 *
 * O utilizador partilhado é criado pelas **rotas de autenticação a sério**
 * (`/api/auth/sign-up/email` e `/api/auth/sign-in/email`), como o `smoke.mjs`,
 * e não por escrita direta na base: o que se quer provar é o contrato HTTP.
 * O percurso de **registo pela interface** tem um spec próprio (`10-registar`).
 *
 * Corre depois de o `webServer` estar disponível: no Playwright os plugins
 * (onde vive o `webServer`) são tarefas de *setup* que precedem o `globalSetup`.
 */
export default async function globalSetup(): Promise<void> {
  mkdirSync('e2e/.auth', { recursive: true });
  mkdirSync('e2e/.results', { recursive: true });

  const removidos = await apagarUtilizadoresDeTeste();

  if (removidos > 0) {
    console.log(`[e2e] ${removidos} utilizador(es) de teste de uma corrida anterior apagado(s).`);
  }

  const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
  const email = emailDeTeste('principal');
  const contexto = await request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL },
  });

  try {
    const registo = await contexto.post('/api/auth/sign-up/email', {
      data: { email, password: PALAVRA_PASSE, name: NOME_DE_TESTE },
    });

    if (!registo.ok()) {
      throw new Error(
        `O registo do utilizador de teste devolveu ${registo.status()}: ${await registo.text()}`,
      );
    }

    // O registo não cria sessão de propósito (`autoSignIn` desligado): entrar é
    // um passo explícito, também aqui.
    const entrada = await contexto.post('/api/auth/sign-in/email', {
      data: { email, password: PALAVRA_PASSE },
    });

    if (!entrada.ok()) {
      throw new Error(`A entrada do utilizador de teste devolveu ${entrada.status()}.`);
    }

    await contexto.storageState({ path: ESTADO_DE_SESSAO });
  } finally {
    await contexto.dispose();
  }

  const medido = await lerAprovisionamento(email);

  console.log(
    `[e2e] utilizador de teste ${email}: ${medido.categorias} categorias, ${medido.contas} conta(s).`,
  );

  /*
   * O aprovisionamento é pré-condição de todos os percursos: sem a carteira e o
   * catálogo, os ecrãs aparecem vazios e nove specs falhariam com mensagens
   * confusas. Falhar aqui, com o número medido, é a mensagem útil.
   */
  if (medido.categorias !== CATEGORIAS_APROVISIONADAS || medido.contas < 1) {
    throw new Error(
      `O aprovisionamento do utilizador novo está errado: ${medido.categorias} categorias (esperava ${CATEGORIAS_APROVISIONADAS}) e ${medido.contas} conta(s).`,
    );
  }

  if (medido.contaPrincipal !== CONTA_PRINCIPAL) {
    throw new Error(
      `A primeira conta devia chamar-se «${CONTA_PRINCIPAL}» e chama-se «${medido.contaPrincipal}».`,
    );
  }

  writeFileSync(
    CREDENCIAIS_DO_UTILIZADOR,
    `${JSON.stringify(
      { email, palavraPasse: PALAVRA_PASSE, criadoEm: new Date().toISOString() },
      null,
      2,
    )}\n`,
  );
}
