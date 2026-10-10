import { AppShell } from '@/components/app-shell';
import { requireUser } from '@/server/session';

/**
 * Layout da aplicação autenticada.
 *
 * A guarda de sessão está aqui, e não em cada página: assim é impossível
 * acrescentar um ecrã novo e esquecer-se de o proteger.
 */
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireUser();

  return <AppShell>{children}</AppShell>;
}
