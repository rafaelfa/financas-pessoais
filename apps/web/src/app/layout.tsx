import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

import { PwaRegister } from '@/components/pwa-register';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import './globals.css';

// Inter Variable exposta como `--font-inter`; o `@theme inline` de globals.css
// faz `--font-sans`/`--font-heading` apontarem para esta variável.
const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Finanças Pessoais',
    template: '%s · Finanças Pessoais',
  },
  description: 'Contas, orçamento e objetivos num só sítio, sem ligar ao banco.',
  applicationName: 'Finanças Pessoais',
  /**
   * iOS: o `manifest` sozinho não basta. O Safari só arranca em `standalone` e só
   * usa o ícone próprio se estas meta tags e o `apple-touch-icon` existirem no
   * `<head>` — e é no telemóvel que a aplicação é usada a maior parte das vezes.
   */
  appleWebApp: {
    capable: true,
    title: 'Finanças Pessoais',
    statusBarStyle: 'default',
  },
  icons: {
    // O iOS escolhe o tamanho mais próximo; os três cobrem iPhone e iPad.
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      { url: '/icons/apple-touch-icon-167.png', sizes: '167x167', type: 'image/png' },
      { url: '/icons/apple-touch-icon-152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
};

/**
 * `themeColor` acompanha o tema claro e escuro para que a barra do navegador no
 * telemóvel não fique branca sobre uma aplicação escura (Fase 7: PWA).
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcf9' },
    { media: '(prefers-color-scheme: dark)', color: '#0f141a' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT" suppressHydrationWarning className={cn('font-sans', inter.variable)}>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>

        {/*
          Registo do service worker para a aplicação instalável. É um componente
          cliente que devolve `null` enquanto não há nada a mostrar: corre depois
          do primeiro render e não bloqueia nada.
        */}
        <PwaRegister />
      </body>
    </html>
  );
}
