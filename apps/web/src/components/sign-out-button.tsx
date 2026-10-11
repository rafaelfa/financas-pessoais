'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { signOut } from '@/lib/auth-client';

/**
 * Terminar a sessão.
 *
 * **Porque é que isto existe.** Faltava. O `signOut` estava exportado no cliente
 * de autenticação e não era usado em lado nenhum: a aplicação criava sessões de
 * trinta dias e não oferecia forma de as terminar. Num computador emprestado, a
 * única saída era apagar as cookies à mão — e uma aplicação de finanças pessoais
 * que não se sabe fechar é um problema, não uma limitação estética.
 *
 * **O que faz depois.** Volta ao ecrã de entrada e força a revalidação da árvore
 * de servidor (`router.refresh()`): sem isso, os Server Components podiam
 * continuar a servir a página em cache do utilizador que acabou de sair, e o
 * ecrã de entrada aparecia por cima de dados que já deviam estar fora do alcance.
 *
 * O estado de espera (`aTerminar`) impede o segundo clique enquanto o pedido
 * está em curso: sem ele, um duplo clique dispara dois `signOut` e o segundo
 * falha com um erro que o utilizador não tem como compreender.
 */
export function SignOutButton({ variant = 'sidebar' }: { variant?: 'sidebar' | 'header' }) {
  const router = useRouter();
  const [aTerminar, setATerminar] = useState(false);

  async function terminarSessao() {
    if (aTerminar) {
      return;
    }

    setATerminar(true);

    const { error } = await signOut();

    if (error) {
      setATerminar(false);
      toast.error(error.message ?? 'Não consegui terminar a sessão. Tenta outra vez.');
      return;
    }

    toast.success('Sessão terminada.');
    router.push('/entrar');
    router.refresh();
  }

  if (variant === 'header') {
    return (
      <button
        type="button"
        onClick={terminarSessao}
        disabled={aTerminar}
        aria-label="Terminar sessão"
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 md:hidden"
      >
        <LogOut aria-hidden className="size-4" />
      </button>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        onClick={terminarSessao}
        disabled={aTerminar}
        tooltip="Terminar sessão"
      >
        <LogOut aria-hidden />
        <span>{aTerminar ? 'A terminar…' : 'Terminar sessão'}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
