import { createCn } from 'cn/config';

/**
 * `cn` com a escala de texto do tema registada.
 *
 * O Tailwind gera `text-caption` a partir de `--text-caption`, mas o motor de
 * junção não a conhece: trata uma classe `text-*` desconhecida como **cor** e
 * descarta-a ao lado de `text-muted-foreground` (medido: a nav ficava a 16 px).
 *
 * Vale para quem importa `cn` daqui. **Os 39 `components/ui/*` importam `cn` de
 * `'cn'` e não têm a extensão** — lá a classe continua a desaparecer. Nenhum usa
 * `text-caption` hoje; o risco é o próximo (a T82/T83 escrevem no `ui/card.tsx`).
 * Um tamanho novo em `@theme inline` entra nesta lista.
 */
export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: ['caption'] }] } },
});
