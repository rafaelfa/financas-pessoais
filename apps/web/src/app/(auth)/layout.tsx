import { Toaster } from '@/components/ui/sonner';

/**
 * Layout das páginas de autenticação.
 *
 * Fica fora do shell da aplicação: quem ainda não entrou não deve ver a
 * navegação, porque não tem nada para lá fazer.
 *
 * É um `<main>` — o marco de conteúdo principal. Sem ele, quem navega por
 * marcos num leitor de ecrã não encontra nada nesta página (WCAG 1.3.1); como o
 * ecrã tem três ou quatro controlos, não precisa do atalho «saltar para o
 * conteúdo» que o shell autenticado tem.
 *
 * **O `Toaster` tem de estar aqui.** Estas duas páginas comunicam todos os seus
 * erros por `toast.error` — palavra-passe errada, e-mail já existente —, e o
 * `Toaster` só existia no shell autenticado: quem falhava a entrada via o botão
 * voltar a ficar disponível e **nada** aparecer. Era o defeito I14, e é a razão
 * pela qual uma auditoria automática não o apanha: não há elemento nenhum no DOM
 * para analisar, o aviso simplesmente nunca é montado.
 */
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground"
          >
            €
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Finanças Pessoais</span>
            <span className="text-xs text-muted-foreground">As tuas contas, num sítio só</span>
          </span>
        </div>
        {children}
      </div>
      {/*
        Sem `richColors` aqui de propósito: as páginas de autenticação só emitem
        erros, e o vermelho é o aspeto por omissão. A posição é a mesma do shell
        para o aviso não saltar de sítio quando a sessão começa.
      */}
      <Toaster position="top-right" />
    </main>
  );
}
