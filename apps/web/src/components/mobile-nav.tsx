'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { MOBILE_NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';

/**
 * Navegação inferior do telemóvel.
 *
 * `pb-[env(safe-area-inset-bottom)]` mantém os alvos acima da barra de gestos
 * do iPhone. Cada alvo tem pelo menos 44 px de altura, o mínimo exigido pela
 * WCAG 2.2 para movimentos de toque.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className="size-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
