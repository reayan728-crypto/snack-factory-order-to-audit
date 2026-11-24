import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import {
  BatchPriority,
  ProductionLine,
  ShiftCode,
  WorkOrder,
} from '../types/erp';
import { NumericStepper } from './NumericStepper';

interface WorkOrderModalProps {
  isOpen: boolean;
  lines: ProductionLine[];
  onClose: () => void;
  onDispatch: (order: WorkOrder) => void;
}

export function WorkOrderModal({
  isOpen,
  lines,
  onClose,
  onDispatch,
}: WorkOrderModalProps) {
  const [partSku, setPartSku] = useState('ACT-7075-HSG');
  const [partName, setPartName] = useState('Actuator Housing Billet');
  const [assignedLineId, setAssignedLineId] = useState(lines[0]?.id ?? 'LINE-01');
  const [shift, setShift] = useState<ShiftCode>(ShiftCode.SHIFT_A);
  const [priority, setPriority] = useState<BatchPriority>(BatchPriority.EXPEDITE);
  const [targetQty, setTargetQty] = useState(240);
  const [dueTime, setDueTime] = useState('16:30');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!partSku.trim() || !partName.trim()) return;

    const serialSuffix = Math.floor(910 + Math.random() * 89);
    const newOrder: WorkOrder = {
      id: `WO-${9050 + Math.floor(Math.random() * 400)}`,
      batchCode: `B-2409-${serialSuffix}`,
      partSku: partSku.trim().toUpperCase(),
      partName: partName.trim(),
      assignedLineId,
      shift,
      priority,
      targetQty,
      completedQty: 0,
      startHour: 6.0,
      durationHours: 4.5,
      dueTime,
      materialStatus: 'STAGED',
    };

    onDispatch(newOrder);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Dispatch New Work Order"
    >
      <div className="w-full max-w-lg rounded-lg border border-[#CBD5E1] bg-white shadow-lg dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between dark:border-[#334155]">
          <div>
            <h2 className="font-display text-[16px] font-semibold text-[#0F172A] dark:text-white">
              Dispatch Production Work Order
            </h2>
            <p className="text-[12px] text-[#64748B] dark:text-slate-400">
              Assign a new manufacturing lot directly into the floor schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded border border-[#CBD5E1] text-[#334155] hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="wo-sku"
                className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 mb-1"
              >
                Part SKU
              </label>
              <input
                id="wo-sku"
                type="text"
                required
                value={partSku}
                onChange={(e) => setPartSku(e.target.value)}
                className="w-full h-9 px-3 rounded border border-[#CBD5E1] bg-white font-mono text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white"
              />
            </div>

            <div>
              <label
                htmlFor="wo-name"
                className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 mb-1"
              >
                Part Description
              </label>
              <input
                id="wo-name"
                type="text"
                required
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                className="w-full h-9 px-3 rounded border border-[#CBD5E1] bg-white text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="wo-line"
                className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 mb-1"
              >
                Target Production Line
              </label>
              <select
                id="wo-line"
                value={assignedLineId}
                onChange={(e) => setAssignedLineId(e.target.value)}
                className="w-full h-9 px-2.5 rounded border border-[#CBD5E1] bg-white font-mono text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white"
              >
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.id} · {l.stationCode}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="wo-shift"
                className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 mb-1"
              >
                Shift Window
              </label>
              <select
                id="wo-shift"
                value={shift}
                onChange={(e) => setShift(e.target.value as ShiftCode)}
                className="w-full h-9 px-2.5 rounded border border-[#CBD5E1] bg-white font-mono text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white"
              >
                <option value={ShiftCode.SHIFT_A}>SHIFT-A (06:00)</option>
                <option value={ShiftCode.SHIFT_B}>SHIFT-B (14:00)</option>
                <option value={ShiftCode.SHIFT_C}>SHIFT-C (22:00)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 mb-1">
                Target Quantity
              </span>
              <NumericStepper
                value={targetQty}
                onChange={setTargetQty}
                step={20}
                min={20}
                max={5000}
                unit="pcs"
                ariaLabel="New work order quantity"
              />
            </div>

            <div>
              <label
                htmlFor="wo-priority"
                className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 mb-1"
              >
                Queue Priority
              </label>
              <select
                id="wo-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as BatchPriority)}
                className="w-full h-10 px-2.5 rounded border border-[#CBD5E1] bg-white font-mono text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white"
              >
                <option value={BatchPriority.EXPEDITE}>EXPEDITE</option>
                <option value={BatchPriority.STANDARD}>STANDARD</option>
                <option value={BatchPriority.HOLD}>HOLD</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="wo-due"
                className="block text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 mb-1"
              >
                Target Due
              </label>
              <input
                id="wo-due"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full h-10 px-2.5 rounded border border-[#CBD5E1] bg-white font-mono text-[12px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#334155] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded border border-[#CBD5E1] text-[12px] font-medium text-[#334155] hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[#1E293B] hover:bg-[#0F172A] text-white text-[12px] font-medium dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
            >
              Dispatch Work Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
