import { AppSidebar } from '@/components/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { MobileNav } from '@/components/mobile-nav';
import { ModeToggle } from '@/components/mode-toggle';
import { SignOutButton } from '@/components/sign-out-button';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';

/**
 * Estrutura da aplicação autenticada: barra lateral em ecrã grande, navegação
 * inferior em telemóvel, paleta de comandos e notificações.
 *
 * O espaço inferior em telemóvel (`pb-24`) existe para que a navegação fixa
 * nunca tape o último elemento de uma lista.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
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
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 !h-5" />
          <span className="text-sm font-medium md:hidden">Finanças Pessoais</span>
          <div className="ml-auto flex items-center gap-2">
            <CommandPalette />
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
