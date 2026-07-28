'use client';

import { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, subDays, startOfDay, endOfDay, isSameDay } from 'date-fns';
import type { DateRange } from 'react-day-picker';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SimpleRange {
  from: Date;
  to: Date;
}

const PRESETS: { label: string; getRange: () => SimpleRange }[] = [
  { label: 'Today', getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  {
    label: 'Last 7 days',
    getRange: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }),
  },
  {
    label: 'Last 30 days',
    getRange: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }),
  },
  {
    label: 'Last 90 days',
    getRange: () => ({ from: startOfDay(subDays(new Date(), 89)), to: endOfDay(new Date()) }),
  },
  {
    label: 'This month',
    getRange: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: 'Last month',
    getRange: () => {
      const prev = subMonths(new Date(), 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    },
  },
];

function matchesPreset(range: SimpleRange, preset: { getRange: () => SimpleRange }) {
  const p = preset.getRange();
  return isSameDay(range.from, p.from) && isSameDay(range.to, p.to);
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: SimpleRange;
  onChange: (range: SimpleRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({ from: value.from, to: value.to });

  const activePreset = PRESETS.find((p) => matchesPreset(value, p));
  const label = activePreset
    ? activePreset.label
    : `${format(value.from, 'dd MMM yyyy')} – ${format(value.to, 'dd MMM yyyy')}`;

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const range = preset.getRange();
    setDraft(range);
    onChange(range);
    setOpen(false);
  }

  function applyDraft() {
    if (draft?.from) {
      onChange({ from: startOfDay(draft.from), to: endOfDay(draft.to ?? draft.from) });
      setOpen(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft({ from: value.from, to: value.to });
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-lg border-border/70 bg-card px-3 text-xs font-medium shadow-sm hover:bg-accent/60"
        >
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          <span>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <div className="flex shrink-0 flex-col gap-0.5 border-b border-border/60 p-2 sm:border-b-0 sm:border-r sm:p-3">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-accent',
                  matchesPreset(value, preset) ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              defaultMonth={draft?.from}
              selected={draft}
              onSelect={setDraft}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
              <p className="text-xs text-muted-foreground">
                {draft?.from ? format(draft.from, 'dd MMM yyyy') : 'Start date'}
                {' – '}
                {draft?.to ? format(draft.to, 'dd MMM yyyy') : draft?.from ? format(draft.from, 'dd MMM yyyy') : 'End date'}
              </p>
              <Button size="sm" className="h-8 px-4 text-xs" onClick={applyDraft} disabled={!draft?.from}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
