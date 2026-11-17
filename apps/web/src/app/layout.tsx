import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';

import { PrivacyProvider } from '@/components/privacy-mode';
import { PwaRegister } from '@/components/pwa-register';
import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PRIVACY_COOKIE, PRIVACY_STORAGE_KEY } from '@/lib/privacy-preference';
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

/**
 * Aplica a preferência antes da primeira pintura.
 *
 * O servidor já serve a página com o estado do cookie, por isso este script só
 * tem trabalho quando os dois discordam — com cookies apagados e a preferência
 * viva no `localStorage`. A regra de `globals.css` esconde os montantes que
 * ainda vierem visíveis, até a hidratação os trocar pela máscara.
 */
const PRIVACY_SCRIPT = `(function(){try{var v=window.localStorage.getItem('${PRIVACY_STORAGE_KEY}');if(v==='ativa'||v==='inativa'){document.documentElement.setAttribute('data-privacidade',v);}}catch(e){}})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const hidden = (await cookies()).get(PRIVACY_COOKIE)?.value === 'ativa';

  return (
    <html
      lang="pt-PT"
      suppressHydrationWarning
      data-privacidade={hidden ? 'ativa' : 'inativa'}
      className={cn('font-sans', inter.variable)}
    >
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: PRIVACY_SCRIPT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PrivacyProvider hidden={hidden}>
            <TooltipProvider>{children}</TooltipProvider>
          </PrivacyProvider>
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
