import { Download, FileUp } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata: Metadata = { title: 'Importar' };

export default function ImportarPage() {
  return (
    <>
      <PageHeader
        title="Importar e exportar"
        description="Traz os extratos que já tens e leva os teus dados quando quiseres. Nada fica preso aqui."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importar um extrato</CardTitle>
            <CardDescription>
              Ficheiros OFX (1.x ou 2.x) e CSV do teu banco. Antes de gravar nada, mostramos linha a
              linha o que vai entrar e o que já existe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={FileUp}
              title="Arrasta o ficheiro para aqui"
              description="A leitura de OFX 1.x em formato SGML — o que os bancos portugueses costumam exportar — já foi validada com extratos de teste. A deduplicação usa o identificador único de cada movimento."
              action={
                <Button size="sm" variant="outline">
                  Escolher ficheiro
                </Button>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exportar</CardTitle>
            <CardDescription>
              Qualquer vista filtrada pode sair em CSV, Excel ou PDF. Há também uma cópia completa
              em JSON, para restauro.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled>
              <Download className="size-4" />
              CSV
            </Button>
            <Button size="sm" variant="outline" disabled>
              <Download className="size-4" />
              Excel
            </Button>
            <Button size="sm" variant="outline" disabled>
              <Download className="size-4" />
              PDF
            </Button>
            <Button size="sm" variant="outline" disabled>
              <Download className="size-4" />
              Cópia de segurança
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              A exportação fica disponível quando houver dados para exportar.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
