'use client';

import { filterDescriptionSuggestions, type DescriptionUsage } from '@repo/shared';

import { useEffect, useRef, useState } from 'react';

import { Combobox, ComboboxInput, ComboboxItem, ComboboxList } from '@/components/ui/combobox';

/**
 * Campo de descrição com sugestões do histórico.
 *
 * A lista **sugere**, não restringe: o texto escrito vale sempre, mesmo que não
 * esteja em lado nenhum da lista. As sugestões chegam prontas do servidor (uma
 * consulta em `/transacoes`), por isso aqui não há `fetch` — só o filtro pelo
 * que está escrito, que vive no `shared` para poder ser testado.
 *
 * O `trigger` do combobox fica desligado: o campo vive dentro de um `<form>`, e
 * um botão a mais ao lado do texto só servia para alguém lhe chamar
 * «submeter». A lista abre ao escrever e com a seta para baixo.
 */
export function DescriptionCombobox({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  invalid = false,
  describedBy,
  className,
}: {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly suggestions: readonly DescriptionUsage[];
  readonly placeholder?: string;
  readonly invalid?: boolean;
  readonly describedBy?: string;
  readonly className?: string;
}) {
  const [aberta, setAberta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const ponteiroEmBaixo = useRef(false);
  const descricoes = suggestions.map((entry) => entry.description);
  const filtradas = filterDescriptionSuggestions(suggestions, value).map(
    (entry) => entry.description,
  );
  /*
   * «Aberta» não é o mesmo que «com lista no ecrã»: ao escrever algo que não
   * corresponde a nada, o combobox fica aberto mas não desenha lista. Se o
   * listener do Escape olhasse só para `aberta`, o primeiro Escape era
   * engolido por uma lista invisível e o diálogo só fechava ao segundo.
   */
  const listaVisivel = aberta && filtradas.length > 0;

  /*
   * A lista fecha **depois** do clique, nunca a meio dele.
   *
   * O base-ui pede para fechar no `pointerdown` de fora; se atendermos, a lista
   * desaparece entre o press e o release, o botão que estava debaixo do dedo
   * sobe e o clique cai no vazio — o «Lançar» deixava de gravar. Por isso os
   * fechos por ponteiro/foco são ignorados aqui e o fecho acontece no `click`
   * que já foi entregue ao alvo (ou no Escape, ou ao escolher uma sugestão).
   */
  // Enquanto o ponteiro está em baixo, nenhum fecho é atendido: mudar a altura
  // do formulário entre o `pointerdown` e o `pointerup` move o alvo do clique.
  useEffect(() => {
    const down = () => {
      ponteiroEmBaixo.current = true;
    };
    const up = () => {
      ponteiroEmBaixo.current = false;
    };

    // `pointerup` no `window`: se o release cair fora da página, o documento
    // não o vê. `pointercancel` conta como fim — sem isto a flag ficava `true`
    // e a lista deixava de fechar até ao clique seguinte.
    document.addEventListener('pointerdown', down, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);

    return () => {
      document.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
    };
  }, []);

  /*
   * `Escape` com a lista aberta: interceptado **no `window`, em captura**.
   *
   * O `DismissableLayer` do Radix ouve o `keydown` em captura no documento
   * (`{ capture: true }`), e o `onKeyDown` do React corre depois disso: um
   * `preventDefault` num handler do input chegava tarde e o diálogo fechava
   * também. Em captura no `window` chega-se primeiro, e só enquanto a lista
   * está aberta — com a lista fechada o Escape segue para o diálogo.
   */
  useEffect(() => {
    if (!listaVisivel) {
      return;
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setAberta(false);
    }

    window.addEventListener('keydown', onEscape, true);

    return () => window.removeEventListener('keydown', onEscape, true);
  }, [listaVisivel]);

  useEffect(() => {
    if (!aberta) {
      return;
    }

    function onDocumentClick(event: MouseEvent) {
      const alvo = event.target;

      if (alvo instanceof Node && raiz.current?.contains(alvo) === true) {
        return;
      }

      setAberta(false);
    }

    document.addEventListener('click', onDocumentClick);

    return () => document.removeEventListener('click', onDocumentClick);
  }, [aberta]);

  return (
    <div ref={raiz}>
      <Combobox
        open={aberta}
        onOpenChange={(open) => {
          if (open) {
            setAberta(true);
            return;
          }

          // Fecho pedido a meio de um clique: ignorado (o `click` que já foi
          // entregue ao alvo fecha a lista a seguir).
          if (ponteiroEmBaixo.current) {
            return;
          }

          setAberta(false);
        }}
        items={descricoes}
        filteredItems={filtradas}
        inputValue={value}
        onInputValueChange={(next) => onChange(next)}
        onValueChange={(next) => {
          if (typeof next === 'string') {
            onChange(next);
            setAberta(false);
          }
        }}
      >
        <ComboboxInput
          id={id}
          placeholder={placeholder}
          autoComplete="off"
          showTrigger={false}
          className={className}
          aria-invalid={invalid}
          aria-describedby={describedBy}
        />
        {/*
        A lista entra **no fluxo**, não por cima: com `position: absolute` ela
        tapava o botão «Lançar» do lançamento rápido (um clique no botão
        escolhia uma sugestão e o lançamento não era gravado) e, com o
        `overflow-hidden` do cartão, ficava cortada. No fluxo, empurra o que vem
        abaixo: não tapa nenhum controlo, não é cortada, e o axe não tem que
        reclamar de foco em região com scroll. O `Popup` do base-ui resolveria o
        posicionamento, mas com o input fora dele o `FloatingFocusManager` fica
        modal e a página inteira passa a `aria-hidden`.
      */}
        {!aberta || filtradas.length === 0 ? null : (
          <div
            data-slot="combobox-content"
            className="mt-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <ComboboxList className="max-h-56">
              {filtradas.map((descricao) => (
                <ComboboxItem key={descricao} value={descricao}>
                  {descricao}
                </ComboboxItem>
              ))}
            </ComboboxList>
          </div>
        )}
      </Combobox>
    </div>
  );
}
