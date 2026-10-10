import { ArrowLeftRight } from 'lucide-react';
import type { Metadata } from 'next';

import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const metadata: Metadata = { title: 'Transações' };

export default function TransacoesPage() {
  return (
    <>
      <PageHeader
        title="Transações"
        description="Todos os movimentos, com filtros por período, conta, categoria e estado."
        actions={<Button size="sm">Novo lançamento</Button>}
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                <TableHead className="hidden md:table-cell">Conta</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={5} className="p-6">
                  <EmptyState
                    icon={ArrowLeftRight}
                    title="Ainda não há movimentos"
                    description="Regista o primeiro lançamento — ou importa um extrato em OFX/CSV — e a lista aparece aqui, ordenada por data."
                    action={<Button size="sm">Registar o primeiro lançamento</Button>}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
