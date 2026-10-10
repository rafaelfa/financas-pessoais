'use client';

import { Search, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Widgets de filtro reutilizáveis.
 *
 * Todos funcionam **sem estado próprio de navegação**: recebem o valor atual e
 * avisam o que mudou. Quem os usa é que decide como isso chega ao URL — assim o
 * mesmo widget serve o extrato de transações hoje e os relatórios depois, sem
 * saber nada de `searchParams`.
 *
 * As datas são tratadas como **datas de calendário** (`YYYY-MM-DD`) e nunca como
 * instantes: somar meses com `Date` local daria o dia errado em fusos negativos.
 */

/** Atalhos de período oferecidos no seletor. */
export const SIMPLE_PERIOD_PRESETS = [
  'this-month',
  'last-month',
  'last-3-months',
  'this-year',
] as const;

/** Período escolhido: um atalho, tudo ou um intervalo escrito à mão. */
export type PeriodPreset = (typeof SIMPLE_PERIOD_PRESETS)[number] | 'all' | 'custom';

/** Rótulos em português de Portugal, pela ordem em que aparecem. */
export const PERIOD_PRESET_LABELS: Readonly<Record<PeriodPreset, string>> = {
  'this-month': 'Este mês',
  'last-month': 'Mês passado',
  'last-3-months': 'Últimos 3 meses',
  'this-year': 'Este ano',
  all: 'Tudo, sem limite de datas',
  custom: 'Datas à minha escolha',
};

/** Intervalo inclusivo de datas de calendário. */
export interface DateRange {
  readonly from?: string;
  readonly to?: string;
}

/** Valor sentinela para "sem filtro" — o Radix Select não aceita `undefined`. */
const ANY_OPTION = '__qualquer__';

/** Alvo de toque: 44 px em telemóvel, denso a partir de `sm`. */
const TOUCH = 'min-h-11 sm:min-h-0';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

/** Chave `YYYY-MM` de uma data de calendário. */
function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

/** Quantos dias tem o mês `YYYY-MM`. */
function daysInMonth(month: string): number {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  // Dia 0 do mês seguinte é o último dia deste mês, em UTC.
  return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

/** Desloca uma chave `YYYY-MM` em `delta` meses. */
function shiftMonth(month: string, delta: number): string {
  const shifted = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1 + delta, 1),
  );
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}`;
}

/** Intervalo de datas de um atalho. `custom` e `all` não têm intervalo próprio. */
export function presetRange(preset: PeriodPreset, today: string): DateRange {
  const month = monthKeyOf(today);

  switch (preset) {
    case 'this-month':
      return { from: `${month}-01`, to: `${month}-${pad2(daysInMonth(month))}` };
    case 'last-month': {
      const previous = shiftMonth(month, -1);
      return { from: `${previous}-01`, to: `${previous}-${pad2(daysInMonth(previous))}` };
    }
    case 'last-3-months':
      return { from: `${shiftMonth(month, -2)}-01`, to: today };
    case 'this-year': {
      const year = month.slice(0, 4);
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    case 'all':
    case 'custom':
      return {};
  }
}

/** Descobre que atalho corresponde às datas atuais, se algum. */
export function detectPeriodPreset(
  from: string | undefined,
  to: string | undefined,
  today: string,
): PeriodPreset {
  if (from === undefined && to === undefined) {
    return 'all';
  }

  for (const preset of SIMPLE_PERIOD_PRESETS) {
    const range = presetRange(preset, today);
    if (range.from === from && range.to === to) {
      return preset;
    }
  }

  return 'custom';
}

/** Uma opção de qualquer filtro de lista. */
export interface FilterOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Seletor de período: atalhos e, quando nenhum serve, duas datas.
 *
 * O intervalo personalizado é um subcomponente com `key` derivada das datas
 * atuais: quando o URL muda por fora (por exemplo em "limpar filtros"), o
 * componente é remontado e os campos voltam a refletir a verdade.
 */
export function PeriodFilter({
  from,
  to,
  today,
  onPresetChange,
  onRangeChange,
}: {
  readonly from?: string;
  readonly to?: string;
  readonly today: string;
  readonly onPresetChange: (preset: PeriodPreset) => void;
  readonly onRangeChange: (range: DateRange) => void;
}) {
  const preset = detectPeriodPreset(from, to, today);

  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="space-y-1">
        <Label htmlFor="filtro-periodo">Período</Label>
        <Select
          value={preset}
          onValueChange={(next) => {
            if (next === 'custom') {
              onPresetChange('custom');
              return;
            }

            onPresetChange(next as PeriodPreset);
          }}
        >
          <SelectTrigger id="filtro-periodo" className={`w-full ${TOUCH}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIMPLE_PERIOD_PRESETS.map((value) => (
              <SelectItem key={value} value={value}>
                {PERIOD_PRESET_LABELS[value]}
              </SelectItem>
            ))}
            <SelectItem value="all">{PERIOD_PRESET_LABELS.all}</SelectItem>
            <SelectItem value="custom">{PERIOD_PRESET_LABELS.custom}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {preset === 'custom' ? (
        <CustomRangeFilter
          key={`${from ?? ''}|${to ?? ''}`}
          from={from}
          to={to}
          onRangeChange={onRangeChange}
        />
      ) : null}
    </div>
  );
}

/** Duas datas de calendário, confirmadas ao sair do campo ou com `Enter`. */
function CustomRangeFilter({
  from,
  to,
  onRangeChange,
}: {
  readonly from?: string;
  readonly to?: string;
  readonly onRangeChange: (range: DateRange) => void;
}) {
  const [draftFrom, setDraftFrom] = useState(from ?? '');
  const [draftTo, setDraftTo] = useState(to ?? '');

  function commit() {
    const next: DateRange = {
      from: draftFrom === '' ? undefined : draftFrom,
      to: draftTo === '' ? undefined : draftTo,
    };

    if (next.from !== from || next.to !== to) {
      onRangeChange(next);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="filtro-de">De</Label>
        <Input
          id="filtro-de"
          type="date"
          value={draftFrom}
          max={draftTo === '' ? undefined : draftTo}
          className={TOUCH}
          onChange={(event) => setDraftFrom(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="filtro-ate">Até</Label>
        <Input
          id="filtro-ate"
          type="date"
          value={draftTo}
          min={draftFrom === '' ? undefined : draftFrom}
          className={TOUCH}
          onChange={(event) => setDraftTo(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
      </div>
    </div>
  );
}

/** Filtro de lista com uma opção "todas" que limpa o parâmetro. */
export function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  allLabel = 'Todas',
}: {
  readonly id: string;
  readonly label: string;
  readonly value?: string;
  readonly options: readonly FilterOption[];
  readonly onChange: (value: string | undefined) => void;
  readonly allLabel?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value ?? ANY_OPTION}
        onValueChange={(next) => onChange(next === ANY_OPTION ? undefined : next)}
      >
        <SelectTrigger id={id} className={`w-full ${TOUCH}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_OPTION}>{allLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Procura por texto. Só navega quando o utilizador confirma. */
export function SearchFilter({
  id,
  label,
  defaultValue,
  placeholder,
  onSubmit,
}: {
  readonly id: string;
  readonly label: string;
  readonly defaultValue?: string;
  readonly placeholder?: string;
  readonly onSubmit: (value: string | undefined) => void;
}) {
  const [value, setValue] = useState(defaultValue ?? '');

  return (
    <form
      className="space-y-1"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = value.trim();
        onSubmit(trimmed === '' ? undefined : trimmed);
      }}
    >
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          type="search"
          value={value}
          placeholder={placeholder}
          className={TOUCH}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button type="submit" variant="outline" className={TOUCH}>
          <Search className="size-4" aria-hidden />
          Procurar
        </Button>
        {value === '' ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Limpar a procura"
            className="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
            onClick={() => {
              setValue('');
              onSubmit(undefined);
            }}
          >
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>
    </form>
  );
}

/** Um filtro ativo, com a forma de o remover. */
export interface FilterChip {
  readonly key: string;
  readonly label: string;
  readonly onRemove: () => void;
}

/**
 * Filtros ativos, sempre visíveis.
 *
 * Sem isto, um filtro esquecido faz o utilizador concluir que "não há
 * movimentos" quando na verdade estão escondidos.
 */
export function FilterChips({
  chips,
  onClear,
}: {
  readonly chips: readonly FilterChip[];
  readonly onClear: () => void;
}) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">Filtros ativos:</span>

      {chips.map((chip) => (
        <Button
          key={chip.key}
          type="button"
          variant="secondary"
          size="sm"
          className={TOUCH}
          aria-label={`Remover o filtro ${chip.label}`}
          onClick={chip.onRemove}
        >
          {chip.label}
          <X className="size-3" aria-hidden />
        </Button>
      ))}

      <Button type="button" variant="ghost" size="sm" className={TOUCH} onClick={onClear}>
        Limpar tudo
      </Button>
    </div>
  );
}
