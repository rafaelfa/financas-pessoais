/**
 * Layout das páginas de autenticação.
 *
 * Fica fora do shell da aplicação: quem ainda não entrou não deve ver a
 * navegação, porque não tem nada para lá fazer.
 */
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-10">
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
    </div>
  );
}
