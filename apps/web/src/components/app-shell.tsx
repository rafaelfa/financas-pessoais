import { AppSidebar } from '@/components/app-sidebar';
import { CommandPalette } from '@/components/command-palette';
import { MobileNav } from '@/components/mobile-nav';
import { ModeToggle } from '@/components/mode-toggle';
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
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur md:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 !h-5" />
          <span className="text-sm font-medium md:hidden">Finanças Pessoais</span>
          <div className="ml-auto flex items-center gap-2">
            <CommandPalette />
            <ModeToggle />
          </div>
        </header>
        <main className="flex-1 px-4 pt-6 pb-24 md:px-6 md:pb-10">{children}</main>
      </SidebarInset>
      <MobileNav />
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  );
}
