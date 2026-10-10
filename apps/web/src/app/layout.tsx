import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { ModeToggle } from '@/components/mode-toggle';
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
  title: 'Finanças Pessoais',
  description: 'Monorepo de finanças pessoais — Next.js, Prisma e PostgreSQL.',
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
          <TooltipProvider>
            <div className="flex min-h-svh flex-col">
              <header className="border-b">
                <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-3">
                  <span className="text-sm font-medium">Finanças Pessoais</span>
                  <ModeToggle />
                </div>
              </header>
              <div className="flex-1">{children}</div>
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
