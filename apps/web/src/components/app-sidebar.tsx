'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { SignOutButton } from '@/components/sign-out-button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar';
import { NAV_SECTIONS } from '@/lib/nav';

/** Marca um destino como ativo. A raiz só é ativa exatamente em `/`. */
function isActiveRoute(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          >
            €
          </span>
          <span className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Finanças Pessoais</span>
            <span className="text-xs text-muted-foreground">As tuas contas, num sítio só</span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  /*
                   * `aria-current="page"` é o que diz ao leitor de ecrã onde
                   * está: o destaque da barra lateral é cor e fundo, e a cor
                   * sozinha não é informação para quem não a vê (WCAG 1.4.1).
                   * O menu de baixo, no telemóvel, já o fazia.
                   */
                  const active = isActiveRoute(pathname, item.href);

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link href={item.href} aria-current={active ? 'page' : undefined}>
                          <item.icon aria-hidden />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        {/*
          Terminar a sessão fica no fundo, onde se procura: fora do percurso de
          trabalho diário, mas sempre à vista.
        */}
        <SidebarMenu>
          <SignOutButton />
        </SidebarMenu>
        <p className="px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Moeda: EUR
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
