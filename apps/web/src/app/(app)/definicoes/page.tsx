import type { Metadata } from 'next';

import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const metadata: Metadata = { title: 'Definições' };

const MONTH_START_OPTIONS = [1, 5, 10, 15, 20, 25];

export default function DefinicoesPage() {
  return (
    <>
      <PageHeader
        title="Definições"
        description="Como a aplicação conta o teu dinheiro: moeda, início do mês e regime de contabilização."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Período mensal</CardTitle>
            <CardDescription>
              Se recebes a meio do mês, podes começar o teu mês nesse dia. Todos os totais e
              orçamentos passam a seguir esse calendário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="inicio-mes">O mês começa no dia</Label>
            <Select defaultValue="1">
              <SelectTrigger id="inicio-mes" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_START_OPTIONS.map((day) => (
                  <SelectItem key={day} value={String(day)}>
                    Dia {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Moeda</CardTitle>
            <CardDescription>
              Os valores são guardados em cêntimos inteiros e apresentados em euros, no formato
              português.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="font-medium">Euro (EUR)</span> · 1 234,56 €
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Regime de contabilização</CardTitle>
            <CardDescription>
              Em <span className="font-medium">caixa</span>, uma compra no cartão só conta quando a
              fatura é paga. Em <span className="font-medium">competência</span>, conta no dia da
              compra. Podes ver os dois no painel — os orçamentos usam competência.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Guardar preferências fica disponível quando a aplicação estiver ligada à conta.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
