import { TriangleAlert } from 'lucide-react';

/**
 * O que a importação **não** consegue adivinhar.
 *
 * Escrito em texto normal — não em letra pequena — e junto ao escolher do
 * ficheiro, porque estas três limitações produzem números errados com ar de
 * certos: uma truncagem a meio de um valor cria um movimento de 0,13 €, e o
 * ficheiro não tem como o detetar. Um ecrã que esconde isto dá ao utilizador uma
 * confiança que o parser não merece.
 */

/** Aviso de que nada foi gravado, para reutilizar antes e depois do ficheiro. */
export const NOTHING_SAVED_NOTICE =
  'A pré-visualização não grava nada: podes fechar o ecrã a qualquer momento sem deixar rasto. Os movimentos só entram na conta quando confirmares.';

export function ImportLimitations() {
  return (
    <section
      aria-labelledby="importar-limitacoes"
      className="space-y-2 rounded-xl border border-warning/40 bg-muted/30 p-4"
    >
      <h2 id="importar-limitacoes" className="flex items-center gap-2 text-sm font-medium">
        <TriangleAlert className="size-4 text-warning-foreground" aria-hidden />O que esta
        importação não consegue adivinhar
      </h2>

      <ul className="space-y-2 text-sm">
        <li>
          <strong>Um valor cortado a meio é lido como um valor pequeno.</strong> Se o ficheiro
          trouxer «-13» em vez de «-130,00», entra como −0,13 €. O ficheiro não tem como detetar
          isto — confere os valores na pré-visualização antes de confirmar.
        </li>
        <li>
          <strong>«1.250» é lido como mil duzentos e cinquenta</strong>, porque o ponto é tratado
          como separador de milhares (dialeto português). Num extrato que use o ponto como separador
          decimal, o valor fica mil vezes maior.
        </li>
        <li>
          <strong>O encoding não é convertido.</strong> Um extrato em Windows-1252 entra com os
          acentos estragados («Alimentaç?o»), embora os valores fiquem corretos. Converter bytes sem
          saber a codificação original inventaria caracteres, por isso não o fazemos.
        </li>
      </ul>
    </section>
  );
}
