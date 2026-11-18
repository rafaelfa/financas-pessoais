import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classificar } from './qa-e2e.mjs';

/**
 * A classificação do resultado do Playwright é a única coisa que distingue «a
 * suíte falhou» de «alguém parou a corrida» — e é ela que decide se os artefactos
 * são guardados. Sem estes testes, trocar um ramo ou mexer no conjunto dos
 * códigos interrompidos não fazia o CI ficar vermelho, e este ficheiro existe
 * exatamente porque um artefacto sem prova já nos deixou a adivinhar (T65).
 */

describe('classificar o resultado do Playwright', () => {
  it('SIGINT (Ctrl+C em POSIX) é interrupção, não falha', () => {
    assert.equal(classificar({ status: null, signal: 'SIGINT' }), 'interrompido');
  });

  it('SIGTERM (OOM, kill) é interrupção', () => {
    assert.equal(classificar({ status: null, signal: 'SIGTERM' }), 'interrompido');
  });

  it('0xC000013A (Ctrl+C no Windows) é interrupção', () => {
    assert.equal(classificar({ status: 3221225786, signal: null }), 'interrompido');
  });

  it('o código convencional 130 é interrupção', () => {
    assert.equal(classificar({ status: 130, signal: null }), 'interrompido');
  });

  it('código 1 é uma suíte vermelha', () => {
    assert.equal(classificar({ status: 1, signal: null }), 'falhou');
  });

  it('código 0 é uma suíte verde', () => {
    assert.equal(classificar({ status: 0, signal: null }), 'ok');
  });

  it('erro de arranque do CLI não é falha de teste', () => {
    assert.equal(
      classificar({ status: null, signal: null, error: new Error('ENOENT') }),
      'arranque',
    );
  });

  it('sem status, sem sinal e sem erro conta como falha', () => {
    assert.equal(classificar({ status: null, signal: null, error: null }), 'falhou');
  });
});
