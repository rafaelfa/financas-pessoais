import { DEFAULT_CURRENCY, formatCurrency, formatDate } from '@repo/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

/**
 * Scaffold status page.
 *
 * This is intentionally not a product feature — it only proves that the
 * monorepo wiring works: `@repo/shared` utilities render, the Tailwind +
 * shadcn/ui theme is applied and the mode toggle switches light/dark.
 */
const PACKAGES = [
  {
    name: '@repo/web',
    stack: 'Next.js · App Router · Tailwind CSS · shadcn/ui',
    detail: 'Esta aplicação. Rotas de API em `src/app/api`.',
  },
  {
    name: '@repo/db',
    stack: 'Prisma · PostgreSQL',
    detail: 'Schema vazio — apenas a datasource `postgresql` declarada.',
  },
  {
    name: '@repo/shared',
    stack: 'Zod · tipos · utilitários',
    detail: 'Schemas de validação compartilhados e helpers de formatação.',
  },
] as const;

export default function HomePage() {
  const sampleAmountInCents = 123_456;

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Finanças Pessoais</h1>
          <Badge variant="secondary">setup</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Monorepo configurado. Nenhuma funcionalidade de produto foi implementada ainda.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PACKAGES.map((pkg) => (
          <Card key={pkg.name}>
            <CardHeader>
              <CardTitle className="text-base">{pkg.name}</CardTitle>
              <CardDescription>{pkg.stack}</CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">{pkg.detail}</CardContent>
          </Card>
        ))}
      </div>

      <Separator className="my-8" />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">@repo/shared em uso</CardTitle>
            <CardDescription>
              Valores formatados pelos utilitários do pacote compartilhado.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">formatCurrency</span>
              <span className="font-medium">
                {formatCurrency(sampleAmountInCents, DEFAULT_CURRENCY)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">formatDate</span>
              <span className="font-medium">{formatDate(new Date())}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tema claro / escuro</CardTitle>
            <CardDescription>
              Controlado por <code className="text-xs">next-themes</code> via classe{' '}
              <code className="text-xs">.dark</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Use o botão no topo da página para alternar entre claro, escuro e sistema. A preferência
            é persistida no <code>localStorage</code>.
          </CardContent>
        </Card>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Verificação rápida: <code className="rounded bg-muted px-1.5 py-0.5">GET /api/health</code>
      </p>
    </main>
  );
}
