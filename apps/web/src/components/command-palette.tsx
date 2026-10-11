'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { ALL_NAV_ITEMS } from '@/lib/nav';

/**
 * Paleta de comandos (⌘K / Ctrl+K).
 *
 * Percorrer a aplicação sem largar o teclado é o atalho que mais se usa depois
 * de aprender. Também funciona como botão visível, para quem não conhece o
 * atalho.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" aria-hidden />
        {/*
          `sr-only` (e não `hidden`) porque `display: none` tira o texto do nome
          acessível: em telemóvel o botão ficava sem nome nenhum para um leitor de
          ecrã. Assim continua escondido à vista e continua a nomear o botão.
        */}
        <span className="sr-only sm:not-sr-only">Ir para…</span>
        <Kbd className="hidden sm:inline-flex" aria-hidden>
          ⌘K
        </Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Ir para"
        description="Procura um ecrã pelo nome ou pela descrição."
      >
        <CommandInput placeholder="Procurar um ecrã…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          <CommandGroup heading="Navegação">
            {ALL_NAV_ITEMS.map((item) => (
              <CommandItem
                key={item.href}
                value={`${item.label} ${item.description}`}
                onSelect={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
                <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
                  {item.description}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
