import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { OperationalStatus, ProductionLine } from '../types/erp';
import { NumericStepper } from './NumericStepper';
import { StatusTag } from './StatusTag';

interface StationDrawerProps {
  line: ProductionLine | null;
  onClose: () => void;
  onSaveSetpoint: (
    lineId: string,
    updates: {
      feedRateMmMin: number;
      maxThermalCeilingC: number;
      targetUnits: number;
    }
  ) => void;
  onToggleEmergencyStop: (lineId: string) => void;
  onOpenFullTelemetry: (lineId: string) => void;
}

export function StationDrawer({
  line,
  onClose,
  onSaveSetpoint,
  onToggleEmergencyStop,
  onOpenFullTelemetry,
}: StationDrawerProps) {
  const [feedRate, setFeedRate] = useState(0);
  const [thermalCeiling, setThermalCeiling] = useState(0);
  const [targetUnits, setTargetUnits] = useState(0);

  useEffect(() => {
    if (line) {
      setFeedRate(line.feedRateMmMin);
      setThermalCeiling(line.maxThermalCeilingC);
      setTargetUnits(line.targetUnits);
    }
  }, [line]);

  if (!line) return null;

  const isHalted = line.status === OperationalStatus.HALTED;

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/40"
      role="dialog"
      aria-modal="true"
      aria-label={`Inspect ${line.stationCode}`}
    >
      <div className="w-full max-w-md bg-white h-full border-l border-[#CBD5E1] flex flex-col dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between dark:border-[#334155]">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] font-semibold text-[#0F172A] dark:text-white">
                {line.stationCode}
              </span>
              <StatusTag status={line.status} />
            </div>
            <p className="text-[12px] text-[#64748B] dark:text-slate-400 mt-0.5">
              {line.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspection drawer"
            className="p-1.5 rounded border border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:bg-[#0F172A] dark:border-[#334155]">
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                Active Batch
              </div>
              <div className="mt-1 font-mono text-[13px] font-semibold text-[#2563EB] dark:text-blue-400">
                {line.activeBatchId}
              </div>
              <div className="font-mono text-[11px] text-[#475569] dark:text-slate-400">
                {line.partSku}
              </div>
            </div>
            <div className="rounded border border-[#E2E8F0] bg-[#F8FAFC] p-3 dark:bg-[#0F172A] dark:border-[#334155]">
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                Live Output
              </div>
              <div className="mt-1 font-mono text-[13px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                {line.actualUnits} / {line.targetUnits}
              </div>
              <div className="font-mono text-[11px] text-[#475569] dark:text-slate-400">
                OEE {line.oeePct.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="rounded border border-[#E2E8F0] p-3.5 space-y-3 dark:border-[#334155]">
            <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
              Quick Setpoint Override
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
                Feed Rate
              </span>
              <NumericStepper
                compact
                value={feedRate}
                onChange={setFeedRate}
                step={20}
                min={200}
                max={4000}
                unit="mm/m"
                ariaLabel="Drawer feed rate"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
                Thermal Ceiling
              </span>
              <NumericStepper
                compact
                value={thermalCeiling}
                onChange={setThermalCeiling}
                step={0.5}
                min={20}
                max={120}
                decimals={1}
                unit="°C"
                ariaLabel="Drawer thermal ceiling"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
                Lot Target Units
              </span>
              <NumericStepper
                compact
                value={targetUnits}
                onChange={setTargetUnits}
                step={20}
                min={50}
                max={5000}
                unit="pcs"
                ariaLabel="Drawer lot target units"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onOpenFullTelemetry(line.id)}
              className="flex-1 px-3 py-2 rounded border border-[#CBD5E1] text-[12px] font-medium text-[#334155] hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open Full Telemetry
            </button>
            <button
              type="button"
              onClick={() => onToggleEmergencyStop(line.id)}
              className={`px-3.5 py-2 rounded text-[12px] font-semibold text-white whitespace-nowrap ${
                isHalted
                  ? 'bg-[#047857] hover:bg-[#065F46]'
                  : 'bg-[#DC2626] hover:bg-[#B91C1C]'
              }`}
            >
              {isHalted ? 'Resume Line' : 'Emergency Stop'}
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-[#E2E8F0] flex items-center justify-end gap-2 dark:border-[#334155]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded border border-[#CBD5E1] text-[12px] font-medium text-[#334155] hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSaveSetpoint(line.id, {
                feedRateMmMin: feedRate,
                maxThermalCeilingC: thermalCeiling,
                targetUnits,
              });
              onClose();
            }}
            className="px-4 py-2 rounded bg-[#1E293B] hover:bg-[#0F172A] text-white text-[12px] font-medium dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
          >
            Commit Setpoint
          </button>
        </div>
      </div>
    </div>
  );
}
