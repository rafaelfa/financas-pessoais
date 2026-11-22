'use client';

import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { AppSidebar } from '@/components/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { MobileNav } from '@/components/mobile-nav';
import { ModeToggle } from '@/components/mode-toggle';
import { PrivacyToggle } from '@/components/privacy-mode';
import { SignOutButton } from '@/components/sign-out-button';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import {
  ACCOUNT_SECTION_ITEMS,
  ACCOUNT_SECTION_ROUTES,
  isActiveRoute,
  matchesAnyRoute,
  TRANSACTION_MENU_ITEMS,
  TRANSACTION_MENU_ROUTES,
} from '@/lib/nav';
import { cn } from '@/lib/utils';

/**
 * Estrutura da aplicação autenticada: barra lateral em ecrã grande, navegação
 * inferior em telemóvel, paleta de comandos e notificações.
 *
 * O espaço inferior em telemóvel (`pb-24`) existe para que a navegação fixa
 * nunca tape o último elemento de uma lista.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mostrarSecoesDeContas = matchesAnyRoute(pathname, ACCOUNT_SECTION_ROUTES);
  const mostrarMenuDoExtrato = matchesAnyRoute(pathname, TRANSACTION_MENU_ROUTES);

  return (
    <SidebarProvider>
      {/*
        Saltar para o conteúdo (WCAG 2.4.1): a barra lateral tem dezenas de links,
        e sem este atalho quem navega por teclado ou leitor de ecrã tem de os
        atravessar todos em cada página. Fica fora do ecrã — não com
        `display:none`, que o tiraria da ordem de tabulação — e aparece quando
        recebe foco.
      */}
      <a
        href="#conteudo-principal"
        className="absolute top-3 left-3 z-50 -translate-y-16 rounded-lg bg-background px-4 py-2 text-sm font-medium shadow-md ring-1 ring-foreground/20 transition-transform focus:translate-y-0"
      >
        Saltar para o conteúdo
      </a>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border-subtle bg-background/80 px-2 backdrop-blur sm:px-4 md:px-6">
          {/*
            Piso de toque a 44×44 (T93): em telemóvel os seis controlos do
            cabeçalho crescem com `min-w-11`/`min-h-11` — e para caberem a 320 o
            cabeçalho reduz o `px` e o grupo da direita o `gap`. O ícone em si
            não muda de tamanho.
          */}
          <SidebarTrigger className="max-sm:min-h-11 max-sm:min-w-11" />
          <Separator orientation="vertical" className="mr-1 !h-5" />
          {/*
            A 320 px o cabeçalho não cabe: com o bloco da direita (menu «Mais»,
            busca, tema e saída) o último botão chegava a 341,3 e a página
            ganhava scroll horizontal. Abaixo de 360 o nome da aplicação sai do
            cabeçalho — a marca continua na barra lateral e o título da página
            diz onde se está — e volta a aparecer antes de `md`, onde sempre
            esteve.
          */}
          {/*
            T93: com os seis controlos a 44 px o nome não cabe inteiro a 360.
            O `min-w-0` deixa a caixa ceder; o corte vive num `<span>` **interior**
            porque `min-[360px]:not-sr-only` (T88) repõe `white-space: normal` e
            `overflow: visible` na caixa de fora — um `truncate` ali seria anulado
            e o nome pintava-se em duas linhas por baixo do «Mais».
          */}
          <span className="sr-only min-w-0 text-sm font-medium min-[360px]:not-sr-only md:hidden">
            <span className="block truncate">Finanças Pessoais</span>
          </span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {/*
              Recorrências, Regras, Categorias e Importar saíram da barra
              lateral (D7). O menu vive aqui, no cabeçalho, e aparece também nas
              páginas deles: quem entra por um favorito tem de poder ir ao
              vizinho sem voltar atrás. `<details>` nativo — teclado e rato, sem
              estado a sincronizar.
            */}
            {!mostrarMenuDoExtrato ? null : (
              /*
                `key={pathname}`: o `<details>` vive no layout, e o layout não
                remonta entre rotas irmãs. O `open` é estado do DOM, não do
                React — sem a chave, escolher «Regras» deixava o menu aberto por
                cima da página nova.
              */
              <details key={pathname} className="relative">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium text-muted-foreground transition-colors select-none hover:bg-muted hover:text-foreground max-sm:min-w-11 max-sm:justify-center max-sm:px-0 sm:min-h-9 [&::-webkit-details-marker]:hidden">
                  <Ellipsis className="size-4" aria-hidden />
                  {/*
                    Abaixo de `sm` (640 px) o grupo do cabeçalho não cabe com o
                    rótulo. Fica o ícone, com o texto em `sr-only` — o nome
                    acessível não se perde — e o rótulo volta a partir de `sm`.
                  */}
                  <span className="sr-only sm:not-sr-only">Mais</span>
                </summary>
                {/*
                  Ancorado à direita do `<details>` a partir de `sm`. Abaixo
                  disso o gatilho está a 136 px do bordo e um painel de 208 px
                  sairia pela esquerda (x = −34): passa a crescer para a direita
                  do gatilho, com 16 px de margem no bordo do ecrã.
                */}
                <nav aria-label="Ferramentas do extrato">
                  <ul className="absolute right-0 z-50 mt-1 w-52 rounded-lg border bg-popover p-1 shadow-md max-sm:right-auto max-sm:left-0">
                    {TRANSACTION_MENU_ITEMS.map((item) => {
                      const ativo = isActiveRoute(pathname, item.href);

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={ativo ? 'page' : undefined}
                            className={cn(
                              'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted sm:min-h-8',
                              ativo ? 'font-medium text-foreground' : 'text-popover-foreground',
                            )}
                          >
                            <item.icon className="size-4" aria-hidden />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </details>
            )}
            <CommandPalette />
            <PrivacyToggle />
            <ModeToggle />
            {/*
              Em telemóvel a barra lateral está escondida, por isso a saída tem de
              existir também aqui — senão o mesmo ecrã teria a funcionalidade numa
              largura e não na outra.
            */}
            <SignOutButton variant="header" />
          </div>
        </header>
        {/*
          `tabIndex={-1}` é o que faz o atalho funcionar em todos os browsers: sem
          um alvo focável, o foco ficava no próprio link e a leitura continuava na
          navegação. O `main` é o destino e o marco de conteúdo principal.
        */}
        {/*
          Secções de contas: a própria Contas, Cartões e Consolidação. Fica
          acima do conteúdo e aparece nas **três** páginas — em Cartões e
          Consolidação não havia como voltar sem a paleta.
        */}
        {!mostrarSecoesDeContas ? null : (
          <nav aria-label="Secções de contas" className="border-b px-4 pt-3 md:px-6">
            <ul className="flex flex-wrap gap-1">
              {ACCOUNT_SECTION_ITEMS.map((item) => {
                const ativo = isActiveRoute(pathname, item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={ativo ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-2 rounded-t-lg border-b-2 px-3 text-sm font-medium transition-colors sm:min-h-9',
                        ativo
                          ? 'border-primary text-foreground'
                          : 'border-transparent text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <item.icon className="size-4" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}

        <main
          id="conteudo-principal"
          tabIndex={-1}
          className="flex-1 px-4 pt-6 pb-24 md:px-6 md:pb-10"
        >
          {children}
        </main>
      </SidebarInset>
      <MobileNav />
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
