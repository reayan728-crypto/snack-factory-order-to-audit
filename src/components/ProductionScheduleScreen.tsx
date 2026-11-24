import { useState } from 'react';
import {
  BatchPriority,
  ProductionLine,
  ShiftCode,
  WorkOrder,
} from '../types/erp';
import { NumericStepper } from './NumericStepper';

interface ProductionScheduleScreenProps {
  workOrders: WorkOrder[];
  lines: ProductionLine[];
  onUpdateWorkOrder: (
    id: string,
    patch: Partial<Pick<WorkOrder, 'assignedLineId' | 'priority' | 'targetQty'>>
  ) => void;
  onOpenNewWorkOrder: () => void;
}

const PRIORITY_STYLE: Record<BatchPriority, string> = {
  [BatchPriority.EXPEDITE]:
    'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5] dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
  [BatchPriority.STANDARD]:
    'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  [BatchPriority.HOLD]:
    'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
};

export function ProductionScheduleScreen({
  workOrders,
  lines,
  onUpdateWorkOrder,
  onOpenNewWorkOrder,
}: ProductionScheduleScreenProps) {
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | BatchPriority>('ALL');
  const [lineFilter, setLineFilter] = useState<string>('ALL');

  const filteredOrders = workOrders.filter((wo) => {
    if (priorityFilter !== 'ALL' && wo.priority !== priorityFilter) return false;
    if (lineFilter !== 'ALL' && wo.assignedLineId !== lineFilter) return false;
    return true;
  });

  const expediteCount = workOrders.filter((w) => w.priority === BatchPriority.EXPEDITE).length;
  const totalScheduledUnits = workOrders.reduce((sum, w) => sum + w.targetQty, 0);

  return (
    <div className="space-y-4">
      <div className="rounded border border-[#CBD5E1] bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 dark:bg-[#1E293B] dark:border-[#334155]">
        <div>
          <h1 className="font-display text-[17px] font-semibold text-[#0F172A] dark:text-white">
            Production Schedule & Batch Routing
          </h1>
          <p className="text-[12px] text-[#64748B] dark:text-slate-400">
            Re-assign work orders across machining cells, adjust target lot sizes, or elevate priority queues.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="font-mono text-[12px] text-[#334155] dark:text-slate-300 tabular-nums">
            <span className="text-[#64748B] dark:text-slate-400">Total Planned:</span>{' '}
            <span className="font-semibold text-[#0F172A] dark:text-white">
              {totalScheduledUnits.toLocaleString()} units
            </span>
            <span className="mx-2 text-[#CBD5E1] dark:text-slate-600">|</span>
            <span className="text-[#64748B] dark:text-slate-400">Expedite:</span>{' '}
            <span className="font-semibold text-[#DC2626] dark:text-red-400">
              {expediteCount} lots
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenNewWorkOrder}
            className="px-3.5 py-2 rounded bg-[#1E293B] hover:bg-[#0F172A] text-white text-[12px] font-medium whitespace-nowrap dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
          >
            Dispatch Batch
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center rounded border border-[#CBD5E1] bg-white p-0.5 dark:border-[#334155] dark:bg-[#1E293B]">
          {(['ALL', BatchPriority.EXPEDITE, BatchPriority.STANDARD, BatchPriority.HOLD] as const).map(
            (p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-[3px] text-[12px] font-medium whitespace-nowrap transition-colors ${
                  priorityFilter === p
                    ? 'bg-[#1E293B] text-white dark:bg-[#2563EB]'
                    : 'text-[#475569] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {p === 'ALL' ? 'All Priorities' : p}
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="schedule-line-filter"
            className="text-[12px] font-medium text-[#475569] dark:text-slate-300"
          >
            Assigned Line:
          </label>
          <select
            id="schedule-line-filter"
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            className="h-8 px-2.5 rounded border border-[#CBD5E1] bg-white font-mono text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#1E293B] dark:border-[#334155] dark:text-slate-100"
          >
            <option value="ALL">ALL LINES</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.id} ({l.stationCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dispatch Queue Table */}
      <div className="rounded border border-[#CBD5E1] bg-white overflow-hidden dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]">
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Work Order / Batch
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Part Specification
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Line Assignment
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Shift · Due
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Priority
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  Completed
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  Target Qty Setpoint
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Material
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {filteredOrders.map((wo) => (
                <tr
                  key={wo.id}
                  className="h-12 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors"
                >
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="font-mono text-[12px] font-semibold text-[#0F172A] dark:text-white">
                      {wo.id}
                    </div>
                    <div className="font-mono text-[11px] text-[#2563EB] dark:text-blue-400">
                      {wo.batchCode}
                    </div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <div className="text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
                      {wo.partName}
                    </div>
                    <div className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                      {wo.partSku}
                    </div>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <select
                      aria-label={`Assign line for ${wo.id}`}
                      value={wo.assignedLineId}
                      onChange={(e) =>
                        onUpdateWorkOrder(wo.id, { assignedLineId: e.target.value })
                      }
                      className="h-8 px-2 rounded border border-[#CBD5E1] bg-white font-mono text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#0F172A] dark:border-[#334155] dark:text-slate-100"
                    >
                      {lines.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.id} · {l.stationCode}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap font-mono text-[12px] text-[#334155] dark:text-slate-300 tabular-nums">
                    <span>{wo.shift === ShiftCode.ALL ? 'SHIFT-A' : wo.shift}</span>
                    <span className="mx-1 text-[#94A3B8]">·</span>
                    <span>{wo.dueTime}</span>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <select
                      aria-label={`Set priority for ${wo.id}`}
                      value={wo.priority}
                      onChange={(e) =>
                        onUpdateWorkOrder(wo.id, {
                          priority: e.target.value as BatchPriority,
                        })
                      }
                      className={`h-7 px-2 rounded font-mono text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#2563EB] ${PRIORITY_STYLE[wo.priority]}`}
                    >
                      <option value={BatchPriority.EXPEDITE}>EXPEDITE</option>
                      <option value={BatchPriority.STANDARD}>STANDARD</option>
                      <option value={BatchPriority.HOLD}>HOLD</option>
                    </select>
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] text-[#0F172A] dark:text-slate-200 tabular-nums">
                    {wo.completedQty}
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap text-right">
                    <NumericStepper
                      compact
                      value={wo.targetQty}
                      step={20}
                      min={20}
                      max={5000}
                      ariaLabel={`Target quantity for ${wo.id}`}
                      onChange={(next) =>
                        onUpdateWorkOrder(wo.id, { targetQty: next })
                      }
                    />
                  </td>
                  <td className="py-2 px-3 whitespace-nowrap">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
                        wo.materialStatus === 'STAGED'
                          ? 'bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300'
                          : wo.materialStatus === 'PARTIAL'
                            ? 'bg-[#FFFBEB] text-[#B45309] dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-[#F1F5F9] text-[#475569] dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {wo.materialStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Line Allocation Gantt Matrix */}
      <div className="rounded border border-[#CBD5E1] bg-white p-4 dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[14px] font-semibold text-[#0F172A] dark:text-white">
            Multi-Line Batch Allocation Timeline
          </h2>
          <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
            Live sync with queue assignments
          </span>
        </div>

        <div className="space-y-2 overflow-x-auto">
          <div className="min-w-[760px] space-y-2">
            {lines.map((line) => {
              const lineOrders = filteredOrders.filter(
                (w) => w.assignedLineId === line.id
              );
              return (
                <div key={line.id} className="flex items-center gap-3">
                  <div className="w-36 shrink-0 font-mono text-[11px]">
                    <div className="font-semibold text-[#0F172A] dark:text-white">
                      {line.id}
                    </div>
                    <div className="text-[#64748B] dark:text-slate-400">
                      {line.stationCode}
                    </div>
                  </div>
                  <div className="relative flex-1 h-8 rounded bg-[#F8FAFC] border border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]">
                    {lineOrders.map((wo) => {
                      const leftPct = (wo.startHour / 12) * 100;
                      const widthPct = Math.min(
                        100 - leftPct,
                        (wo.durationHours / 12) * 100
                      );
                      const bgClass =
                        wo.priority === BatchPriority.EXPEDITE
                          ? 'bg-[#2563EB] text-white'
                          : wo.priority === BatchPriority.HOLD
                            ? 'bg-[#F59E0B] text-[#0F172A]'
                            : 'bg-[#1E293B] text-white dark:bg-slate-600';

                      return (
                        <div
                          key={wo.id}
                          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          className={`absolute top-1 bottom-1 rounded-[2px] px-2 flex items-center justify-between font-mono text-[10px] font-medium overflow-hidden ${bgClass}`}
                        >
                          <span className="truncate">
                            {wo.batchCode} ({wo.targetQty}u)
                          </span>
                          <span className="ml-1 shrink-0">{wo.priority}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
