import { MaterialBin } from '../types/erp';

interface MaterialStagingScreenProps {
  bins: MaterialBin[];
  onStageMaterial: (binId: string, addQty: number) => void;
  onRequestReplenishment: (binId: string) => void;
}

export function MaterialStagingScreen({
  bins,
  onStageMaterial,
  onRequestReplenishment,
}: MaterialStagingScreenProps) {
  const lowStockCount = bins.filter((b) => b.status === 'LOW-STOCK').length;
  const replenishingCount = bins.filter((b) => b.status === 'REPLENISHING').length;

  return (
    <div className="space-y-4">
      <div className="rounded border border-[#CBD5E1] bg-white p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 dark:bg-[#1E293B] dark:border-[#334155]">
        <div>
          <h1 className="font-display text-[17px] font-semibold text-[#0F172A] dark:text-white">
            BOM Material Staging & Bin Levels
          </h1>
          <p className="text-[12px] text-[#64748B] dark:text-slate-400">
            Track raw alloy bar stock, sheet coils, and sub-assembly kit depletion across production bays.
          </p>
        </div>

        <div className="flex items-center gap-4 font-mono text-[12px] tabular-nums">
          <span>
            <span className="text-[#64748B] dark:text-slate-400">Low Stock Bins:</span>{' '}
            <span className="font-semibold text-[#B45309] dark:text-amber-400">
              {lowStockCount}
            </span>
          </span>
          <span className="text-[#CBD5E1] dark:text-slate-600">|</span>
          <span>
            <span className="text-[#64748B] dark:text-slate-400">In Transit:</span>{' '}
            <span className="font-semibold text-[#2563EB] dark:text-blue-400">
              {replenishingCount}
            </span>
          </span>
        </div>
      </div>

      <div className="rounded border border-[#CBD5E1] bg-white overflow-hidden dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]">
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Bin Location
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Material Code · Specification
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Target Line
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  On Hand
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  Burn / Hr
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  Runway (Hrs)
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Bin State
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  Staging Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {bins.map((bin) => {
                const runwayHours = bin.onHandQty / Math.max(1, bin.burnRatePerHr);
                const isLow = bin.onHandQty <= bin.reorderPoint;

                return (
                  <tr
                    key={bin.id}
                    className="h-11 hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors"
                  >
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[12px] font-semibold text-[#0F172A] dark:text-white">
                      {bin.binLocation}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="font-mono text-[12px] font-medium text-[#2563EB] dark:text-blue-400">
                        {bin.materialCode}
                      </span>
                      <span className="mx-1.5 text-[#94A3B8]">·</span>
                      <span className="text-[12px] text-[#334155] dark:text-slate-300">
                        {bin.specification}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-mono text-[12px] text-[#0F172A] dark:text-slate-200">
                      {bin.assignedLineId}
                    </td>
                    <td
                      className={`py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] font-semibold tabular-nums ${
                        isLow
                          ? 'bg-[#FFFBEB] text-[#B45309] dark:bg-amber-950/40 dark:text-amber-300'
                          : 'text-[#0F172A] dark:text-white'
                      }`}
                    >
                      {bin.onHandQty} {bin.unit}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] text-[#475569] dark:text-slate-300 tabular-nums">
                      {bin.burnRatePerHr}/hr
                    </td>
                    <td
                      className={`py-2 px-3 whitespace-nowrap text-right font-mono text-[12px] font-medium tabular-nums ${
                        runwayHours < 4
                          ? 'text-[#DC2626] dark:text-red-400 font-semibold'
                          : 'text-[#0F172A] dark:text-slate-200'
                      }`}
                    >
                      {runwayHours.toFixed(1)} h
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
                          bin.status === 'ADEQUATE'
                            ? 'bg-[#ECFDF5] text-[#047857] dark:bg-emerald-950/60 dark:text-emerald-300'
                            : bin.status === 'LOW-STOCK'
                              ? 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A] dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
                              : 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE] dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                        }`}
                      >
                        {bin.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onStageMaterial(bin.id, 50)}
                          className="px-2.5 py-1 rounded border border-[#CBD5E1] bg-white hover:bg-[#F1F5F9] text-[11px] font-medium text-[#334155] whitespace-nowrap dark:bg-[#0F172A] dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Stage +50
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestReplenishment(bin.id)}
                          disabled={bin.status === 'REPLENISHING'}
                          className="px-2.5 py-1 rounded bg-[#1E293B] hover:bg-[#0F172A] disabled:opacity-45 text-white text-[11px] font-medium whitespace-nowrap dark:bg-[#2563EB] dark:hover:bg-[#1D4ED8]"
                        >
                          {bin.status === 'REPLENISHING' ? 'Dispatched' : 'Replenish'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
