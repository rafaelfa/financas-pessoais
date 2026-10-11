'use client';

import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  EllipsisVertical,
  ListFilter,
  Pencil,
  Trash,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  describeRuleAction,
  describeRuleConditions,
  isRuleActionImplemented,
  RuleConditionList,
} from '@/components/rule-conditions';
import { RuleDialog } from '@/components/rule-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AccountView } from '@/server/accounts';
import type { CardView } from '@/server/cards';
import type { CategoryView } from '@/server/categories';
import type { RuleView } from '@/server/rules';
import { deleteRule, setRuleEnabled, updateRule } from '@/server/rules-actions';
import { cn } from '@/lib/utils';

/**
 * Lista de regras, por ordem de prioridade.
 *
 * A ordem **é** a regra de decisão: a primeira que corresponder ganha. Por isso
 * a lista mostra a ordem com um número, permite subir e descer, e explica que a
 * primeira vence — sem isso, duas regras que correspondem ao mesmo lançamento
 * seriam uma lotaria invisível.
 *
 * Regras inválidas (sem condições) ou com uma ação ainda não implementada não se
 * escondem: ficam na lista com o problema escrito, porque uma regra que existe
 * mas não pode ser usada é uma coisa que o utilizador tem de conseguir ver.
 */

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const ICON_TOUCH = 'min-h-11 min-w-11 sm:min-h-7 sm:min-w-7';

/** Nome legível de cada natureza. */
const KIND_LABELS: Readonly<Record<string, string>> = {
  expense: 'Gasto',
  income: 'Ganho',
};

export function RuleList({
  rules,
  accounts,
  cards,
  categories,
}: {
  readonly rules: readonly RuleView[];
  readonly accounts: readonly AccountView[];
  readonly cards: readonly CardView[];
  readonly categories: readonly CategoryView[];
}) {
  const ordered = [...rules].sort((left, right) => left.priority - right.priority);
  const nextPriority =
    ordered.length === 0 ? 100 : Math.max(...ordered.map((rule) => rule.priority)) + 1;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A <strong>primeira regra que corresponder ganha</strong>. Usa as setas para mudar a ordem;
        em caso de prioridades iguais, a ordem da lista é a que foi gravada.
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14 text-right">Ordem</TableHead>
                <TableHead>Regra</TableHead>
                <TableHead>Condições</TableHead>
                <TableHead className="hidden md:table-cell">Categoria</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Aplicações</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {ordered.map((rule, index) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  position={index}
                  total={ordered.length}
                  ordered={ordered}
                  accounts={accounts}
                  cards={cards}
                  categories={categories}
                  nextPriority={nextPriority}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RuleRow({
  rule,
  position,
  total,
  ordered,
  accounts,
  cards,
  categories,
  nextPriority,
}: {
  readonly rule: RuleView;
  readonly position: number;
  readonly total: number;
  readonly ordered: readonly RuleView[];
  readonly accounts: readonly AccountView[];
  readonly cards: readonly CardView[];
  readonly categories: readonly CategoryView[];
  readonly nextPriority: number;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const implemented = isRuleActionImplemented(rule.action);
  const usable = rule.isValid && implemented;
  const conditions = describeRuleConditions({
    ...rule,
    cardName: cards.find((card) => card.id === rule.cardId)?.name ?? null,
  });

  function toggleEnabled(next: boolean) {
    startTransition(async () => {
      const result = await setRuleEnabled({ id: rule.id, enabled: next });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(next ? 'Regra ativada.' : 'Regra desativada.');
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const result = await deleteRule({ id: rule.id });

      if (!result.ok) {
        toast.error(result.error);
        setDeleteOpen(false);
        return;
      }

      toast.success('Regra eliminada.');
      setDeleteOpen(false);
    });
  }

  /**
   * Sobe ou desce a regra na ordem.
   *
   * Não basta trocar duas prioridades: se houver empates (duas regras com a
   * mesma prioridade), trocar os valores não muda nada de visível. Por isso a
   * lista nova é renumerada de 1 a N e só se gravam as regras cuja prioridade
   * mudou de facto.
   */
  function move(direction: -1 | 1) {
    const target = position + direction;

    if (target < 0 || target >= total) {
      return;
    }

    const next = [...ordered];
    const current = next[position];
    const neighbour = next[target];

    if (current === undefined || neighbour === undefined) {
      return;
    }

    next[position] = neighbour;
    next[target] = current;

    startTransition(async () => {
      for (const [index, item] of next.entries()) {
        const priority = index + 1;

        if (item.priority === priority) {
          continue;
        }

        const result = await updateRule({ id: item.id, priority });

        if (!result.ok) {
          toast.error(result.error);
          return;
        }
      }

      toast.success('Prioridade atualizada.');
    });
  }

  return (
    <TableRow data-invalid={!usable} className={cn(!usable && 'bg-destructive/5')}>
      <TableCell className="text-right">
        <span className="font-numeric text-muted-foreground tabular-nums">{position + 1}</span>
        <span className="sr-only">
          (prioridade {rule.priority}; a primeira regra que corresponder ganha)
        </span>
      </TableCell>

      <TableCell className="max-w-[18rem] whitespace-normal">
        <span className="block truncate font-medium">{rule.name}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-normal">
            {KIND_LABELS[rule.kind] ?? rule.kind}
          </Badge>
          {implemented ? null : (
            <Badge variant="destructive" className="font-normal">
              <CircleAlert className="size-3" aria-hidden />
              {describeRuleAction(rule.action)} — indisponível nesta fase
            </Badge>
          )}
        </span>
        {rule.lastAppliedAt === null ? null : (
          <span className="mt-0.5 block text-xs text-muted-foreground lg:hidden">
            Última aplicação: {formatTimestamp(rule.lastAppliedAt)}
          </span>
        )}
      </TableCell>

      <TableCell className="max-w-[22rem] whitespace-normal">
        <RuleConditionList
          conditions={conditions}
          emptyLabel="Sem condições — categorizaria tudo"
        />
        {rule.isValid ? null : (
          <span className="mt-1 block text-xs text-destructive">
            Esta regra não tem nenhuma condição, por isso não pode ser usada nem ativada. Edita-a
            para acrescentar pelo menos uma.
          </span>
        )}
        <span className="mt-0.5 block text-xs text-muted-foreground md:hidden">
          {rule.targetCategoryName === null ? (
            'Sem categoria de destino'
          ) : (
            <>Categoria: {rule.targetCategoryName}</>
          )}
        </span>
      </TableCell>

      <TableCell className="hidden md:table-cell">
        {rule.targetCategoryName === null ? (
          <span className="text-muted-foreground">Sem categoria</span>
        ) : (
          rule.targetCategoryName
        )}
      </TableCell>

      <TableCell className="hidden text-right lg:table-cell">
        <span className="text-muted-foreground">
          {rule.appliedCount === 0 ? 'nenhuma' : rule.appliedCount}
        </span>
      </TableCell>

      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Switch
              checked={rule.enabled}
              disabled={pending || !usable}
              aria-label={
                rule.enabled ? `Desativar a regra ${rule.name}` : `Ativar a regra ${rule.name}`
              }
              aria-describedby={usable ? undefined : `regra-inutil-${rule.id}`}
              onCheckedChange={toggleEnabled}
            />
            <Badge
              variant={rule.enabled ? 'secondary' : 'outline'}
              className="font-normal whitespace-nowrap"
            >
              {rule.enabled ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          {usable ? null : (
            <span id={`regra-inutil-${rule.id}`} className="text-xs text-muted-foreground">
              Não pode ser ativada enquanto o problema estiver por resolver.
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={ICON_TOUCH}
            disabled={pending || position === 0}
            aria-label={`Subir a regra ${rule.name} na prioridade`}
            onClick={() => move(-1)}
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={ICON_TOUCH}
            disabled={pending || position === total - 1}
            aria-label={`Descer a regra ${rule.name} na prioridade`}
            onClick={() => move(1)}
          >
            <ArrowDown className="size-4" aria-hidden />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className={ICON_TOUCH}
                aria-label={`Ações da regra ${rule.name}`}
              >
                <EllipsisVertical className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="size-4" aria-hidden />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!usable} onSelect={() => toggleEnabled(!rule.enabled)}>
                <ListFilter className="size-4" aria-hidden />
                {rule.enabled ? 'Desativar' : 'Ativar'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
                <Trash className="size-4" aria-hidden />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>

      <RuleDialog
        mode="edit"
        rule={rule}
        accounts={accounts}
        cards={cards}
        categories={categories}
        defaultPriority={nextPriority}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash aria-hidden />
            </AlertDialogMedia>
            <AlertDialogTitle>Eliminar «{rule.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra desaparece e deixa de ser usada. Nenhum lançamento é alterado: o que já foi
              categorizado por ela fica como está. Se só queres suspendê-la, usa «Desativar».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault();
                confirmDelete();
              }}
            >
              {pending ? 'A eliminar…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TableRow>
  );
}

/** Data de calendário em formato curto, sem deslocação de fuso. */
function formatDay(date: string): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'UTC', dateStyle: 'short' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/**
 * Instante formatado em português.
 *
 * `lastAppliedAt` é um instante (`DateTime`), não uma data de calendário — mas o
 * contrato não fixa o formato exato, por isso este formatador aceita os dois: uma
 * data `YYYY-MM-DD` é lida sem fuso (como todas as datas do domínio) e qualquer
 * outra coisa é lida como instante em Lisboa. Um valor ilegível mostra-se tal
 * como veio, em vez de rebentar o ecrã.
 */
function formatTimestamp(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDay(value);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'short',
  }).format(parsed);
}
