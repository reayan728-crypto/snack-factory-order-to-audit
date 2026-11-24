import { Minus, Plus } from 'lucide-react';

interface NumericStepperProps {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
  ariaLabel: string;
  compact?: boolean;
}

export function NumericStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 99999,
  unit,
  decimals = 0,
  ariaLabel,
  compact = false,
}: NumericStepperProps) {
  const clampAndRound = (raw: number) => {
    const clamped = Math.min(max, Math.max(min, raw));
    const factor = Math.pow(10, decimals);
    return Math.round(clamped * factor) / factor;
  };

  return (
    <div
      className={`inline-flex items-center rounded border border-[#CBD5E1] bg-white dark:border-[#334155] dark:bg-[#0F172A] focus-within:ring-2 focus-within:ring-[#2563EB] focus-within:border-[#2563EB] transition-shadow ${
        compact ? 'h-8' : 'h-10'
      }`}
    >
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        onClick={() => onChange(clampAndRound(value - step))}
        disabled={value <= min}
        className={`flex items-center justify-center border-r border-[#CBD5E1] dark:border-[#334155] text-[#334155] dark:text-slate-300 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
          compact ? 'w-7 h-full' : 'w-9 h-full'
        }`}
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <div className="flex items-center px-2 gap-1">
        <input
          type="number"
          aria-label={ariaLabel}
          value={decimals > 0 ? value.toFixed(decimals) : value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const parsed = parseFloat(e.target.value);
            if (!Number.isNaN(parsed)) {
              onChange(clampAndRound(parsed));
            }
          }}
          className={`bg-transparent font-mono tabular-nums text-right text-[#0F172A] dark:text-slate-100 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            compact ? 'w-14 text-xs' : 'w-20 text-sm font-medium'
          }`}
        />
        {unit && (
          <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400 select-none">
            {unit}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        onClick={() => onChange(clampAndRound(value + step))}
        disabled={value >= max}
        className={`flex items-center justify-center border-l border-[#CBD5E1] dark:border-[#334155] text-[#334155] dark:text-slate-300 hover:bg-[#F1F5F9] dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
          compact ? 'w-7 h-full' : 'w-9 h-full'
        }`}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
