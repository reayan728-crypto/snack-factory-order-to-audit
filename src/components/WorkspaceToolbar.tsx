import { Moon, Search, Sun } from 'lucide-react';
import { OperationalStatus, ShiftCode } from '../types/erp';

interface WorkspaceToolbarProps {
  selectedShift: ShiftCode;
  onShiftChange: (shift: ShiftCode) => void;
  statusFilter: 'ALL' | OperationalStatus;
  onStatusFilterChange: (status: 'ALL' | OperationalStatus) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  showStatusFilter?: boolean;
}

const SHIFT_OPTIONS: { value: ShiftCode; label: string }[] = [
  { value: ShiftCode.ALL, label: 'All Shifts' },
  { value: ShiftCode.SHIFT_A, label: 'Shift A · 06:00' },
  { value: ShiftCode.SHIFT_B, label: 'Shift B · 14:00' },
  { value: ShiftCode.SHIFT_C, label: 'Shift C · 22:00' },
];

const STATUS_OPTIONS: { value: 'ALL' | OperationalStatus; label: string }[] = [
  { value: 'ALL', label: 'All States' },
  { value: OperationalStatus.CRITICAL, label: 'Critical' },
  { value: OperationalStatus.NEAR_TOLERANCE, label: 'Near-Tol' },
  { value: OperationalStatus.NOMINAL, label: 'Nominal' },
  { value: OperationalStatus.HALTED, label: 'Halted' },
];

export function WorkspaceToolbar({
  selectedShift,
  onShiftChange,
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  isDark,
  onToggleTheme,
  showStatusFilter = true,
}: WorkspaceToolbarProps) {
  return (
    <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]">
      <div className="max-w-[1440px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Shift Filter"
            className="inline-flex items-center rounded border border-[#CBD5E1] bg-white p-0.5 dark:border-[#334155] dark:bg-[#1E293B]"
          >
            {SHIFT_OPTIONS.map((opt) => {
              const active = selectedShift === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onShiftChange(opt.value)}
                  className={`px-2.5 py-1 rounded-[3px] text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#1E293B] text-white dark:bg-[#2563EB] dark:text-white'
                      : 'text-[#475569] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {showStatusFilter && (
            <div
              role="group"
              aria-label="Operational Status Filter"
              className="inline-flex items-center rounded border border-[#CBD5E1] bg-white p-0.5 dark:border-[#334155] dark:bg-[#1E293B]"
            >
              {STATUS_OPTIONS.map((opt) => {
                const active = statusFilter === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onStatusFilterChange(opt.value)}
                    className={`px-2.5 py-1 rounded-[3px] text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-[#2563EB] text-white'
                        : 'text-[#475569] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search station, batch, or SKU..."
              aria-label="Search station, batch, or SKU"
              className="h-8 w-56 sm:w-64 pl-8 pr-3 rounded border border-[#CBD5E1] bg-white text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] dark:bg-[#1E293B] dark:border-[#334155] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light console theme' : 'Switch to dark console theme'}
            className="h-8 px-2.5 rounded border border-[#CBD5E1] bg-white text-[#334155] hover:bg-[#F1F5F9] inline-flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap shrink-0 transition-colors dark:bg-[#1E293B] dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'Day Mode' : 'Night Shift'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
