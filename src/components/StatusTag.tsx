import { OperationalStatus } from '../types/erp';

interface StatusTagProps {
  status: OperationalStatus;
}

export function StatusTag({ status }: StatusTagProps) {
  switch (status) {
    case OperationalStatus.NOMINAL:
      return (
        <span className="inline-flex items-center rounded px-2 py-1 font-mono text-[11px] font-medium tracking-tight whitespace-nowrap bg-[#ECFDF5] text-[#047857] border border-[#A7F3D0] dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
          NOMINAL
        </span>
      );
    case OperationalStatus.NEAR_TOLERANCE:
      return (
        <span className="inline-flex items-center rounded px-2 py-1 font-mono text-[11px] font-medium tracking-tight whitespace-nowrap bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
          NEAR-TOL
        </span>
      );
    case OperationalStatus.CRITICAL:
      return (
        <span className="inline-flex items-center rounded px-2 py-1 font-mono text-[11px] font-semibold tracking-tight whitespace-nowrap bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] dark:bg-red-950/70 dark:text-red-300 dark:border-red-700">
          CRITICAL
        </span>
      );
    case OperationalStatus.HALTED:
      return (
        <span className="inline-flex items-center rounded px-2 py-1 font-mono text-[11px] font-semibold tracking-tight whitespace-nowrap bg-[#1E293B] text-white border border-[#0F172A] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600">
          HALTED
        </span>
      );
  }
}
