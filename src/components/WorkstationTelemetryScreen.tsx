import { useEffect, useState } from 'react';
import {
  CalibrationLogEntry,
  OperationalStatus,
  ProductionLine,
} from '../types/erp';
import { NumericStepper } from './NumericStepper';
import { StatusTag } from './StatusTag';

interface WorkstationTelemetryScreenProps {
  lines: ProductionLine[];
  selectedLineId: string;
  onSelectLineId: (id: string) => void;
  calibrationLogs: CalibrationLogEntry[];
  onApplyCalibration: (
    lineId: string,
    updates: {
      feedRateMmMin: number;
      maxThermalCeilingC: number;
      torqueTolerancePct: number;
    }
  ) => void;
  onToggleEmergencyStop: (lineId: string) => void;
}

function TelemetryChart({
  title,
  unit,
  series,
  ceilingValue,
  ceilingLabel,
  strokeColor,
}: {
  title: string;
  unit: string;
  series: number[];
  ceilingValue?: number;
  ceilingLabel?: string;
  strokeColor: string;
}) {
  const width = 520;
  const height = 160;
  const padX = 36;
  const padY = 18;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const combined = ceilingValue !== undefined ? [...series, ceilingValue] : series;
  const rawMin = Math.min(...combined);
  const rawMax = Math.max(...combined);
  const margin = (rawMax - rawMin || 10) * 0.15;
  const minVal = rawMin - margin;
  const maxVal = rawMax + margin;
  const range = maxVal - minVal || 1;

  const toY = (v: number) =>
    padY + plotH - ((v - minVal) / range) * plotH;

  const points = series
    .map((v, idx) => {
      const x = padX + (idx / Math.max(1, series.length - 1)) * plotW;
      const y = toY(v);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const ceilingY = ceilingValue !== undefined ? toY(ceilingValue) : null;

  return (
    <div className="rounded border border-[#CBD5E1] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
          {title}
        </span>
        <span className="font-mono text-[12px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
          Current: {series[series.length - 1]?.toFixed(1)} {unit}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40 overflow-visible"
        role="img"
        aria-label={`${title} telemetry trend`}
      >
        {[0, 0.5, 1].map((t) => {
          const y = padY + plotH * t;
          const labelVal = maxVal - range * t;
          return (
            <g key={t}>
              <line
                x1={padX}
                y1={y}
                x2={width - padX}
                y2={y}
                stroke="currentColor"
                className="text-[#E2E8F0] dark:text-[#334155]"
                strokeWidth="1"
              />
              <text
                x={padX - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#64748B] dark:fill-slate-400 font-mono text-[9px]"
              >
                {labelVal.toFixed(1)}
              </text>
            </g>
          );
        })}

        {ceilingY !== null && ceilingLabel && (
          <g>
            <line
              x1={padX}
              y1={ceilingY}
              x2={width - padX}
              y2={ceilingY}
              stroke="#DC2626"
              strokeWidth="1.25"
              strokeDasharray="4 3"
            />
            <text
              x={width - padX}
              y={ceilingY - 4}
              textAnchor="end"
              className="fill-[#DC2626] font-mono text-[9px] font-semibold"
            >
              {ceilingLabel}: {ceilingValue?.toFixed(1)} {unit}
            </text>
          </g>
        )}

        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {series.map((v, idx) => {
          const x = padX + (idx / Math.max(1, series.length - 1)) * plotW;
          const y = toY(v);
          return (
            <circle
              key={idx}
              cx={x}
              cy={y}
              r={idx === series.length - 1 ? 3.5 : 2}
              fill={
                ceilingValue !== undefined && v > ceilingValue
                  ? '#DC2626'
                  : strokeColor
              }
            />
          );
        })}
      </svg>
    </div>
  );
}

export function WorkstationTelemetryScreen({
  lines,
  selectedLineId,
  onSelectLineId,
  calibrationLogs,
  onApplyCalibration,
  onToggleEmergencyStop,
}: WorkstationTelemetryScreenProps) {
  const activeLine = lines.find((l) => l.id === selectedLineId) ?? lines[0];

  const [feedRate, setFeedRate] = useState(activeLine.feedRateMmMin);
  const [thermalCeiling, setThermalCeiling] = useState(
    activeLine.maxThermalCeilingC
  );
  const [torqueTol, setTorqueTol] = useState(activeLine.torqueTolerancePct);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  useEffect(() => {
    setFeedRate(activeLine.feedRateMmMin);
    setThermalCeiling(activeLine.maxThermalCeilingC);
    setTorqueTol(activeLine.torqueTolerancePct);
    setSavedNotice(null);
  }, [
    activeLine.id,
    activeLine.feedRateMmMin,
    activeLine.maxThermalCeilingC,
    activeLine.torqueTolerancePct,
  ]);

  const handleApply = () => {
    onApplyCalibration(activeLine.id, {
      feedRateMmMin: feedRate,
      maxThermalCeilingC: thermalCeiling,
      torqueTolerancePct: torqueTol,
    });
    setSavedNotice('Calibration committed to PLC controller.');
  };

  const handleResetNominal = () => {
    setFeedRate(activeLine.nominalFeedRateMmMin);
    setThermalCeiling(
      activeLine.stationCode === 'QC-06B' ? 24.0 : 68.0
    );
    setTorqueTol(activeLine.toleranceLimitPct);
    setSavedNotice('Inputs staged to nominal spec. Click Apply Calibration to commit.');
  };

  const isHalted = activeLine.status === OperationalStatus.HALTED;

  return (
    <div className="space-y-4">
      {/* Station Selector Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Select Workstation"
          className="flex flex-wrap items-center gap-1 rounded border border-[#CBD5E1] bg-white p-1 dark:bg-[#1E293B] dark:border-[#334155]"
        >
          {lines.map((line) => {
            const active = line.id === activeLine.id;
            return (
              <button
                key={line.id}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => onSelectLineId(line.id)}
                className={`px-3 py-1.5 rounded-[3px] font-mono text-[12px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#1E293B] text-white dark:bg-[#2563EB]'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {line.stationCode}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <StatusTag status={activeLine.status} />
          <button
            type="button"
            onClick={() => onToggleEmergencyStop(activeLine.id)}
            className={`px-3.5 py-1.5 rounded text-[12px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 ${
              isHalted
                ? 'bg-[#047857] hover:bg-[#065F46] text-white focus-visible:ring-emerald-500'
                : 'bg-[#DC2626] hover:bg-[#B91C1C] text-white focus-visible:ring-[#EF4444]'
            }`}
          >
            {isHalted ? 'Resume Station' : 'Emergency Stop'}
          </button>
        </div>
      </div>

      {/* Station Header & Instrumentation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded border border-[#E2E8F0] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
            Spindle / Die Thermal
          </div>
          <div
            className={`mt-1.5 font-mono text-[20px] font-semibold tabular-nums ${
              activeLine.spindleTempC > activeLine.maxThermalCeilingC
                ? 'text-[#DC2626] dark:text-red-400'
                : 'text-[#0F172A] dark:text-white'
            }`}
          >
            {activeLine.spindleTempC.toFixed(1)} °C
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#64748B] dark:text-slate-400">
            Ceiling: {activeLine.maxThermalCeilingC.toFixed(1)} °C
          </div>
        </div>

        <div className="rounded border border-[#E2E8F0] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
            Hydraulic Line Pressure
          </div>
          <div className="mt-1.5 font-mono text-[20px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
            {activeLine.hydraulicBar.toFixed(1)} bar
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#64748B] dark:text-slate-400">
            Sampled {activeLine.lastSampleTimestamp}
          </div>
        </div>

        <div className="rounded border border-[#E2E8F0] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
            Vibration RMS
          </div>
          <div className="mt-1.5 font-mono text-[20px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
            {activeLine.vibrationRms.toFixed(2)} mm/s
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#64748B] dark:text-slate-400">
            ISO 10816-3 Class II
          </div>
        </div>

        <div className="rounded border border-[#E2E8F0] bg-white p-3.5 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
            Active Feed / Cycle
          </div>
          <div className="mt-1.5 font-mono text-[20px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
            {activeLine.feedRateMmMin} mm/min
          </div>
          <div className="mt-1 font-mono text-[11px] text-[#64748B] dark:text-slate-400">
            Cycle {activeLine.cycleTimeSec.toFixed(1)}s · Batch {activeLine.activeBatchId}
          </div>
        </div>
      </div>

      {/* Dual Telemetry Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <TelemetryChart
          title={`${activeLine.stationCode} Thermal Envelope`}
          unit="°C"
          series={activeLine.tempSeries}
          ceilingValue={activeLine.maxThermalCeilingC}
          ceilingLabel="Thermal Limit"
          strokeColor="#2563EB"
        />
        <TelemetryChart
          title={`${activeLine.stationCode} Spindle / Ram Load`}
          unit="%"
          series={activeLine.loadSeries}
          ceilingValue={90}
          ceilingLabel="Load Threshold"
          strokeColor="#0F172A"
        />
      </div>

      {/* Setpoint Calibration + Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 rounded border border-[#CBD5E1] bg-white p-4 dark:bg-[#1E293B] dark:border-[#334155]">
          <h2 className="font-display text-[15px] font-semibold text-[#0F172A] dark:text-white">
            Precision Setpoint Calibration
          </h2>
          <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-slate-400">
            {activeLine.name} · Operator {activeLine.operator}
          </p>

          <div className="mt-4 space-y-3.5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
                  Target Feed Rate
                </div>
                <div className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                  Nominal: {activeLine.nominalFeedRateMmMin} mm/min
                </div>
              </div>
              <NumericStepper
                value={feedRate}
                onChange={setFeedRate}
                step={20}
                min={200}
                max={4000}
                unit="mm/m"
                ariaLabel="Target feed rate"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
                  Max Thermal Ceiling
                </div>
                <div className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                  Current sensor: {activeLine.spindleTempC.toFixed(1)} °C
                </div>
              </div>
              <NumericStepper
                value={thermalCeiling}
                onChange={setThermalCeiling}
                step={0.5}
                min={20}
                max={120}
                decimals={1}
                unit="°C"
                ariaLabel="Max thermal ceiling"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
                  Torque / Dimensional Tolerance
                </div>
                <div className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                  Current delta: {activeLine.toleranceDeltaPct >= 0 ? '+' : ''}
                  {activeLine.toleranceDeltaPct.toFixed(2)}%
                </div>
              </div>
              <NumericStepper
                value={torqueTol}
                onChange={setTorqueTol}
                step={0.1}
                min={0.5}
                max={10.0}
                decimals={1}
                unit="%"
                ariaLabel="Tolerance band percentage"
              />
            </div>
          </div>

          {savedNotice && (
            <div className="mt-3 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-[12px] text-[#047857] dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-300">
              {savedNotice}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleResetNominal}
              className="px-3 py-2 rounded border border-[#CBD5E1] text-[12px] font-medium text-[#334155] hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Reset Nominal
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3.5 py-2 rounded bg-[#1E293B] hover:bg-[#0F172A] text-white text-[12px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
            >
              Apply Calibration
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 rounded border border-[#CBD5E1] bg-white overflow-hidden dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between dark:border-[#334155]">
            <h2 className="font-display text-[15px] font-semibold text-[#0F172A] dark:text-white">
              Controller Calibration Audit Log
            </h2>
            <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
              {calibrationLogs.length} events recorded
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]">
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                    Timestamp
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                    Station
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                    Parameter
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                    Previous
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                    Committed
                  </th>
                  <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                    Engineer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
                {calibrationLogs.map((entry) => (
                  <tr key={entry.id} className="h-9">
                    <td className="py-1.5 px-3 font-mono text-[11px] text-[#64748B] dark:text-slate-400 tabular-nums whitespace-nowrap">
                      {entry.timestamp}
                    </td>
                    <td className="py-1.5 px-3 font-mono text-[12px] font-semibold text-[#0F172A] dark:text-white whitespace-nowrap">
                      {entry.stationCode}
                    </td>
                    <td className="py-1.5 px-3 text-[12px] text-[#334155] dark:text-slate-300 whitespace-nowrap">
                      {entry.parameter}
                    </td>
                    <td className="py-1.5 px-3 font-mono text-[11px] text-[#64748B] dark:text-slate-400 text-right tabular-nums whitespace-nowrap">
                      {entry.previousValue}
                    </td>
                    <td className="py-1.5 px-3 font-mono text-[12px] font-medium text-[#2563EB] dark:text-blue-400 text-right tabular-nums whitespace-nowrap">
                      {entry.newValue}
                    </td>
                    <td className="py-1.5 px-3 text-[12px] text-[#334155] dark:text-slate-300 whitespace-nowrap">
                      {entry.engineer}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
