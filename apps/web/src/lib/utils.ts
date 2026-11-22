import { createCn } from 'cn/config';

/**
 * `cn` com a escala de texto do tema registada.
 *
 * O Tailwind gera `text-caption` a partir de `--text-caption`, mas o motor de
 * junção não a conhece: trata uma classe `text-*` desconhecida como **cor** e
 * descarta-a ao lado de `text-muted-foreground` (medido: a nav ficava a 16 px).
 *
 * Vale para todo o `src`: os 39 `components/ui/*` também importam `cn` daqui
 * desde a T90, por isso já ninguém compõe classes fora desta escala. Um tamanho
 * novo em `@theme inline` entra nesta lista — é o preço de a ter registada.
 */
export const cn = createCn({
  extend: { classGroups: { 'font-size': [{ text: ['caption'] }] } },
});
