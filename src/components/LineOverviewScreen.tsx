import { AlertTriangle, ArrowUpRight, SlidersHorizontal } from 'lucide-react';
import {
  OperationalStatus,
  ProductionLine,
  VarianceRecord,
  VarianceResolution,
} from '../types/erp';
import { StatusTag } from './StatusTag';

interface LineOverviewScreenProps {
  lines: ProductionLine[];
  variances: VarianceRecord[];
  onInspectLine: (line: ProductionLine) => void;
  onOpenTelemetry: (lineId: string) => void;
  onEmergencyStop: (lineId: string) => void;
  onAcknowledgeCritical: (lineId: string) => void;
  onNavigateSchedule: () => void;
}

function Sparkline({
  values,
  strokeColor,
}: {
  values: number[];
  strokeColor: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 84;
  const height = 24;

  const points = values
    .map((val, idx) => {
      const x = (idx / (values.length - 1)) * width;
      const y = height - ((val - min) / span) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

const SHIFT_HOURS = ['06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00'];

export function LineOverviewScreen({
  lines,
  variances,
  onInspectLine,
  onOpenTelemetry,
  onEmergencyStop,
  onAcknowledgeCritical,
  onNavigateSchedule,
}: LineOverviewScreenProps) {
  const criticalLines = lines.filter(
    (line) => line.status === OperationalStatus.CRITICAL
  );
  const openVariances = variances.filter(
    (v) => v.resolution === VarianceResolution.OPEN
  );

  const totalActual = lines.reduce((sum, l) => sum + l.actualUnits, 0);
  const totalTarget = lines.reduce((sum, l) => sum + l.targetUnits, 0);
  const avgOee =
    lines.length > 0
      ? lines.reduce((sum, l) => sum + l.oeePct, 0) / lines.length
      : 0;
  const throughputRate = Math.round(totalActual * 0.52);
  const completionPct =
    totalTarget > 0 ? ((totalActual / totalTarget) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-4">
      {criticalLines.map((crit) => (
        <section
          key={crit.id}
          aria-label={`Critical variance alert on ${crit.stationCode}`}
          className="rounded border-2 border-[#DC2626] bg-[#FEF2F2] px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 dark:bg-red-950/40 dark:border-red-500"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-[#991B1B] dark:text-red-200">
                <span>
                  {crit.stationCode} · {crit.name}
                </span>
                <span className="font-mono text-[11px] font-semibold px-1.5 py-0.5 rounded bg-[#DC2626] text-white">
                  OUT OF SPEC
                </span>
              </div>
              <p className="text-[12px] text-[#7F1D1D] dark:text-red-200/90">
                Batch <span className="font-mono font-medium">{crit.activeBatchId}</span> ({crit.partSku})
                exceeded tolerance ceiling — Thermal:{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {crit.spindleTempC.toFixed(1)} °C
                </span>{' '}
                (limit {crit.maxThermalCeilingC.toFixed(1)} °C) · Tolerance Delta:{' '}
                <span className="font-mono font-semibold tabular-nums">
                  +{crit.toleranceDeltaPct.toFixed(2)}%
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onOpenTelemetry(crit.id)}
              className="px-3 py-1.5 rounded border border-[#FCA5A5] bg-white text-[#991B1B] hover:bg-red-50 text-[12px] font-medium whitespace-nowrap transition-colors dark:bg-[#1E293B] dark:border-red-700 dark:text-red-200 dark:hover:bg-red-950/60"
            >
              Inspect Telemetry
            </button>
            <button
              type="button"
              onClick={() => onAcknowledgeCritical(crit.id)}
              className="px-3 py-1.5 rounded border border-[#CBD5E1] bg-white text-[#334155] hover:bg-[#F1F5F9] text-[12px] font-medium whitespace-nowrap transition-colors dark:bg-[#1E293B] dark:border-[#334155] dark:text-slate-200"
            >
              Acknowledge
            </button>
            <button
              type="button"
              onClick={() => onEmergencyStop(crit.id)}
              className="px-3.5 py-1.5 rounded bg-[#DC2626] hover:bg-[#B91C1C] text-white text-[12px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EF4444]"
            >
              Emergency Stop
            </button>
          </div>
        </section>
      ))}

      {/* Production Telemetry Cards */}
      <section aria-label="Plant Key Telemetry" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded border border-[#E2E8F0] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
              Active Throughput
            </span>
            <span className="font-mono text-[11px] font-medium text-[#047857] dark:text-emerald-400 tabular-nums">
              +3.4% vs shift plan
            </span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[22px] font-semibold leading-none text-[#0F172A] dark:text-white tabular-nums">
                {throughputRate.toLocaleString()}
                <span className="ml-1 text-[12px] font-normal text-[#64748B] dark:text-slate-400">
                  u/hr
                </span>
              </div>
              <div className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
                {totalActual.toLocaleString()} / {totalTarget.toLocaleString()} units ({completionPct}%)
              </div>
            </div>
            <Sparkline values={[1310, 1345, 1360, 1390, 1412, 1440, 1465, throughputRate]} strokeColor="#2563EB" />
          </div>
        </div>

        <div className="rounded border border-[#E2E8F0] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
              Plant Mean OEE
            </span>
            <span className="font-mono text-[11px] font-medium text-[#047857] dark:text-emerald-400 tabular-nums">
              +1.1% · Target 92.0%
            </span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[22px] font-semibold leading-none text-[#0F172A] dark:text-white tabular-nums">
                {avgOee.toFixed(1)}%
              </div>
              <div className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
                {lines.filter((l) => l.status !== OperationalStatus.HALTED).length} / {lines.length} stations active
              </div>
            </div>
            <Sparkline values={[91.4, 92.0, 92.8, 93.1, 92.9, 93.5, 93.8, avgOee]} strokeColor="#047857" />
          </div>
        </div>

        <div className="rounded border border-[#E2E8F0] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
              First-Pass Yield
            </span>
            <span className="font-mono text-[11px] font-medium text-[#B45309] dark:text-amber-400 tabular-nums">
              -0.18% · 36 rechecks
            </span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[22px] font-semibold leading-none text-[#0F172A] dark:text-white tabular-nums">
                98.74%
              </div>
              <div className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
                Cpk 1.62 · ISO-2768-mK
              </div>
            </div>
            <Sparkline values={[99.1, 99.0, 98.95, 98.9, 98.82, 98.78, 98.76, 98.74]} strokeColor="#D97706" />
          </div>
        </div>

        <div className="rounded border border-[#E2E8F0] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
              Open Variances
            </span>
            <span
              className={`font-mono text-[11px] font-medium tabular-nums ${
                openVariances.length > 0
                  ? 'text-[#DC2626] dark:text-red-400'
                  : 'text-[#047857] dark:text-emerald-400'
              }`}
            >
              {openVariances.length > 0 ? 'Action required' : 'All cleared'}
            </span>
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="font-mono text-[22px] font-semibold leading-none text-[#0F172A] dark:text-white tabular-nums">
                {openVariances.length}
                <span className="ml-1.5 text-[12px] font-normal text-[#64748B] dark:text-slate-400">
                  unacknowledged
                </span>
              </div>
              <div className="mt-1.5 text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
                {criticalLines.length} critical line{criticalLines.length === 1 ? '' : 's'}
              </div>
            </div>
            <Sparkline
              values={[1, 1, 2, 1, 2, 3, 2, openVariances.length]}
              strokeColor={openVariances.length > 0 ? '#DC2626' : '#047857'}
            />
          </div>
        </div>
      </section>

      {/* High-Density Production Line Table */}
      <section
        aria-label="Active Production Lines"
        className="rounded border border-[#CBD5E1] bg-white overflow-hidden dark:bg-[#1E293B] dark:border-[#334155]"
      >
        <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between gap-4 dark:border-[#334155]">
          <div>
            <h1 className="font-display text-[15px] font-semibold text-[#0F172A] dark:text-white">
              Production Line Execution Matrix
            </h1>
            <p className="text-[12px] text-[#64748B] dark:text-slate-400">
              Select any line row to adjust setpoints, inspect spindle loads, or manage active batch routing.
            </p>
          </div>
          <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400 whitespace-nowrap tabular-nums">
            Showing {lines.length} stations
          </span>
        </div>

        {lines.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[13px] font-medium text-[#334155] dark:text-slate-300">
              No workstations match the active shift or search filters.
            </p>
            <p className="mt-1 text-[12px] text-[#64748B] dark:text-slate-400">
              Clear your search query or select All Shifts in the toolbar above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]">
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                    Station / Line
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                    Batch · Part SKU
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                    Operator
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right whitespace-nowrap">
                    Actual / Target
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right whitespace-nowrap">
                    Cycle (s)
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right whitespace-nowrap">
                    Thermal (°C)
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right whitespace-nowrap">
                    Tolerance Δ
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right whitespace-nowrap">
                    OEE
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 whitespace-nowrap">
                    Status
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                {lines.map((line) => {
                  const absDelta = Math.abs(line.toleranceDeltaPct);
                  const isOverLimit = absDelta > line.toleranceLimitPct;
                  const isNearLimit = !isOverLimit && absDelta >= line.toleranceLimitPct * 0.8;
                  const pctComplete = Math.min(
                    100,
                    Math.round((line.actualUnits / Math.max(1, line.targetUnits)) * 100)
                  );

                  return (
                    <tr
                      key={line.id}
                      onClick={() => onInspectLine(line)}
                      className="h-10 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
                    >
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[12px] font-semibold text-[#0F172A] dark:text-white">
                            {line.stationCode}
                          </span>
                          <span className="text-[12px] text-[#475569] dark:text-slate-300 truncate max-w-[190px]">
                            {line.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-[12px]">
                          <span className="font-mono font-medium text-[#2563EB] dark:text-blue-400">
                            {line.activeBatchId}
                          </span>
                          <span className="text-[#94A3B8]" aria-hidden="true">
                            ·
                          </span>
                          <span className="font-mono text-[11px] text-[#475569] dark:text-slate-300">
                            {line.partSku}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[12px] text-[#334155] dark:text-slate-300">
                        {line.operator}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] tabular-nums">
                        <span className="font-semibold text-[#0F172A] dark:text-white">
                          {line.actualUnits}
                        </span>
                        <span className="text-[#64748B] dark:text-slate-400">
                          {' '}
                          / {line.targetUnits}
                        </span>
                        <span className="ml-1.5 text-[11px] text-[#64748B] dark:text-slate-400">
                          ({pctComplete}%)
                        </span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] text-[#0F172A] dark:text-slate-200 tabular-nums">
                        {line.cycleTimeSec.toFixed(1)}
                      </td>
                      <td
                        className={`py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] tabular-nums ${
                          line.spindleTempC > line.maxThermalCeilingC
                            ? 'bg-[#FEF2F2] text-[#DC2626] font-semibold dark:bg-red-950/60 dark:text-red-300'
                            : 'text-[#0F172A] dark:text-slate-200'
                        }`}
                      >
                        {line.spindleTempC.toFixed(1)}
                      </td>
                      <td
                        className={`py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] tabular-nums ${
                          isOverLimit
                            ? 'bg-[#FEF2F2] text-[#DC2626] font-semibold dark:bg-red-950/60 dark:text-red-300'
                            : isNearLimit
                              ? 'bg-[#FFFBEB] text-[#B45309] font-medium dark:bg-amber-950/40 dark:text-amber-300'
                              : 'text-[#047857] dark:text-emerald-400'
                        }`}
                      >
                        {line.toleranceDeltaPct >= 0 ? '+' : ''}
                        {line.toleranceDeltaPct.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] font-medium text-[#0F172A] dark:text-slate-200 tabular-nums">
                        {line.oeePct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <StatusTag status={line.status} />
                      </td>
                      <td
                        className="py-2 px-3 whitespace-nowrap text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onInspectLine(line)}
                            title={`Adjust setpoints for ${line.stationCode}`}
                            className="px-2 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[11px] font-medium text-[#334155] inline-flex items-center gap-1 whitespace-nowrap dark:bg-[#0F172A] dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <SlidersHorizontal className="w-3 h-3" />
                            <span>Setpoint</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenTelemetry(line.id)}
                            title={`Open full telemetry for ${line.stationCode}`}
                            className="px-2 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[11px] font-medium text-[#2563EB] inline-flex items-center gap-1 whitespace-nowrap dark:bg-[#0F172A] dark:border-[#334155] dark:text-blue-400 dark:hover:bg-slate-800"
                          >
                            <span>Telemetry</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Multi-Stream Shift Gantt Timeline */}
      <section
        aria-label="Shift Production Gantt Timeline"
        className="rounded border border-[#CBD5E1] bg-white overflow-hidden dark:bg-[#1E293B] dark:border-[#334155]"
      >
        <div className="px-4 py-2.5 border-b border-[#E2E8F0] flex items-center justify-between gap-4 dark:border-[#334155]">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-[14px] font-semibold text-[#0F172A] dark:text-white">
              Active Shift Gantt Horizon
            </h2>
            <span className="text-[12px] text-[#64748B] dark:text-slate-400">
              06:00 – 18:00 · 12-hour dispatch window
            </span>
          </div>
          <button
            type="button"
            onClick={onNavigateSchedule}
            className="px-2.5 py-1 rounded border border-[#CBD5E1] text-[12px] font-medium text-[#334155] hover:bg-[#F1F5F9] whitespace-nowrap dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Open Full Schedule
          </button>
        </div>

        <div className="p-3 overflow-x-auto">
          <div className="min-w-[780px]">
            {/* Hour grid header */}
            <div className="grid grid-cols-12 border-b border-[#E2E8F0] pb-1.5 mb-2 pl-44 dark:border-[#334155]">
              {SHIFT_HOURS.slice(0, 6).map((hr) => (
                <div
                  key={hr}
                  className="col-span-2 font-mono text-[10px] font-semibold text-[#64748B] dark:text-slate-400"
                >
                  {hr}
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              {lines.map((line) => {
                const leftPct = (line.ganttStartHour / 12) * 100;
                const widthPct = Math.min(
                  100 - leftPct,
                  (line.ganttDurationHours / 12) * 100
                );
                const progressPct = Math.min(
                  100,
                  Math.round((line.actualUnits / Math.max(1, line.targetUnits)) * 100)
                );

                const barColor =
                  line.status === OperationalStatus.CRITICAL
                    ? 'bg-[#DC2626] text-white'
                    : line.status === OperationalStatus.NEAR_TOLERANCE
                      ? 'bg-[#D97706] text-white'
                      : line.status === OperationalStatus.HALTED
                        ? 'bg-[#475569] text-slate-200'
                        : 'bg-[#1E293B] text-white dark:bg-[#2563EB]';

                return (
                  <div
                    key={line.id}
                    className="flex items-center h-8 border-b border-[#F1F5F9] last:border-b-0 dark:border-slate-800"
                  >
                    <div className="w-44 shrink-0 pr-3 flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold text-[#0F172A] dark:text-slate-200">
                        {line.stationCode}
                      </span>
                      <span className="font-mono text-[10px] text-[#64748B] dark:text-slate-400">
                        {line.shift}
                      </span>
                    </div>
                    <div className="relative flex-1 h-6 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[3px] dark:bg-[#0F172A] dark:border-[#334155]">
                      <button
                        type="button"
                        onClick={() => onInspectLine(line)}
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                        }}
                        className={`absolute top-0.5 bottom-0.5 rounded-[2px] px-2 flex items-center justify-between text-[11px] font-mono overflow-hidden hover:opacity-90 transition-opacity ${barColor}`}
                      >
                        <span className="truncate font-medium">
                          {line.activeBatchId} · {line.partSku}
                        </span>
                        <span className="ml-2 shrink-0 tabular-nums opacity-90">
                          {progressPct}%
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
