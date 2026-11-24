import { useState } from 'react';
import {
  OperationalStatus,
  VarianceRecord,
  VarianceResolution,
} from '../types/erp';
import { StatusTag } from './StatusTag';

interface QualityVarianceScreenProps {
  variances: VarianceRecord[];
  onResolveVariance: (
    id: string,
    resolution: VarianceResolution,
    note?: string
  ) => void;
  onInspectStation: (lineId: string) => void;
}

const SPC_BINS = [
  { label: '-3σ', count: 4, outOfSpec: true },
  { label: '-2σ', count: 18, outOfSpec: false },
  { label: '-1σ', count: 64, outOfSpec: false },
  { label: 'NOM', count: 112, outOfSpec: false },
  { label: '+1σ', count: 59, outOfSpec: false },
  { label: '+2σ', count: 21, outOfSpec: false },
  { label: '+3σ', count: 7, outOfSpec: true },
];

export function QualityVarianceScreen({
  variances,
  onResolveVariance,
  onInspectStation,
}: QualityVarianceScreenProps) {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | OperationalStatus>('ALL');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftNote, setDraftNote] = useState('');

  const filtered = variances.filter((v) =>
    severityFilter === 'ALL' ? true : v.severity === severityFilter
  );

  const openCount = variances.filter(
    (v) => v.resolution === VarianceResolution.OPEN
  ).length;
  const quarantinedCount = variances.filter(
    (v) => v.resolution === VarianceResolution.QUARANTINED
  ).length;

  return (
    <div className="space-y-4">
      {/* SPC Overview Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-5 rounded border border-[#CBD5E1] bg-white p-4 flex flex-col justify-between dark:bg-[#1E293B] dark:border-[#334155]">
          <div>
            <h1 className="font-display text-[17px] font-semibold text-[#0F172A] dark:text-white">
              Quality Control & Tolerance Variance
            </h1>
            <p className="mt-0.5 text-[12px] text-[#64748B] dark:text-slate-400">
              Statistical process control audit log and lot quarantine disposition workflow.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 pt-3 border-t border-[#E2E8F0] dark:border-[#334155]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                Process Cpk
              </div>
              <div className="mt-1 font-mono text-[18px] font-semibold text-[#0F172A] dark:text-white tabular-nums">
                1.62
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                Open Alerts
              </div>
              <div
                className={`mt-1 font-mono text-[18px] font-semibold tabular-nums ${
                  openCount > 0 ? 'text-[#DC2626] dark:text-red-400' : 'text-[#047857] dark:text-emerald-400'
                }`}
              >
                {openCount}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                Quarantined
              </div>
              <div className="mt-1 font-mono text-[18px] font-semibold text-[#B45309] dark:text-amber-400 tabular-nums">
                {quarantinedCount}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 rounded border border-[#CBD5E1] bg-white p-4 dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
              SPC Dimensional Dispersion (n = 285 samples)
            </span>
            <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
              USL / LSL ±2.50%
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2">
            {SPC_BINS.map((bin) => {
              const heightPct = Math.round((bin.count / 112) * 100);
              return (
                <div key={bin.label} className="flex flex-col items-center justify-end h-full gap-1">
                  <span className="font-mono text-[10px] text-[#64748B] dark:text-slate-400 tabular-nums">
                    {bin.count}
                  </span>
                  <div
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                    className={`w-full rounded-[2px] ${
                      bin.outOfSpec
                        ? 'bg-[#DC2626]'
                        : bin.label === 'NOM'
                          ? 'bg-[#2563EB]'
                          : 'bg-[#1E293B] dark:bg-slate-500'
                    }`}
                  />
                  <span className="font-mono text-[10px] font-medium text-[#334155] dark:text-slate-300">
                    {bin.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded border border-[#CBD5E1] bg-white p-0.5 dark:border-[#334155] dark:bg-[#1E293B]">
          {(['ALL', OperationalStatus.CRITICAL, OperationalStatus.NEAR_TOLERANCE, OperationalStatus.NOMINAL] as const).map(
            (sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-3 py-1 rounded-[3px] text-[12px] font-medium whitespace-nowrap transition-colors ${
                  severityFilter === sev
                    ? 'bg-[#1E293B] text-white dark:bg-[#2563EB]'
                    : 'text-[#475569] hover:text-[#0F172A] dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {sev === 'ALL' ? 'All Readings' : sev}
              </button>
            )
          )}
        </div>
        <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
          Showing {filtered.length} inspection records
        </span>
      </div>

      {/* Variance Audit Table */}
      <div className="rounded border border-[#CBD5E1] bg-white overflow-hidden dark:bg-[#1E293B] dark:border-[#334155]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#F1F5F9] border-b border-[#E2E8F0] dark:bg-[#0F172A] dark:border-[#334155]">
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  ID / Time
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Station · Batch
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Parameter
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  Nominal Spec
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  Measured
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400 text-right">
                  Delta
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Severity
                </th>
                <th className="py-2 px-3 text-[10px] font-bold uppercase tracking-[0.06em] text-[#64748B] dark:text-slate-400">
                  Disposition & Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
              {filtered.map((rec) => {
                const isEditing = editingNoteId === rec.id;
                return (
                  <tr
                    key={rec.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-slate-800/60 transition-colors align-top"
                  >
                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] tabular-nums">
                      <div className="font-semibold text-[#0F172A] dark:text-white">
                        {rec.id}
                      </div>
                      <div className="text-[#64748B] dark:text-slate-400">
                        {rec.timestamp}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onInspectStation(rec.lineId)}
                        className="font-mono text-[12px] font-semibold text-[#2563EB] hover:underline dark:text-blue-400"
                      >
                        {rec.stationCode}
                      </button>
                      <div className="font-mono text-[11px] text-[#64748B] dark:text-slate-400">
                        {rec.batchCode}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-[12px] font-medium text-[#0F172A] dark:text-slate-200">
                        {rec.parameter}
                      </div>
                      {isEditing ? (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <input
                            type="text"
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            className="h-7 px-2 w-60 rounded border border-[#CBD5E1] bg-white text-[11px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2563EB] dark:bg-[#0F172A] dark:border-[#334155] dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onResolveVariance(rec.id, rec.resolution, draftNote);
                              setEditingNoteId(null);
                            }}
                            className="px-2 py-1 rounded bg-[#1E293B] text-white text-[11px] font-medium dark:bg-[#2563EB]"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <div className="mt-0.5 text-[11px] text-[#64748B] dark:text-slate-400 max-w-xs">
                          {rec.dispositionNote}{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNoteId(rec.id);
                              setDraftNote(rec.dispositionNote);
                            }}
                            className="text-[#2563EB] hover:underline ml-1"
                          >
                            Edit note
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono text-[12px] text-[#475569] dark:text-slate-300 tabular-nums">
                      {rec.nominalSpec}
                    </td>
                    <td
                      className={`py-2.5 px-3 whitespace-nowrap text-right font-mono text-[12px] font-semibold tabular-nums ${
                        rec.severity === OperationalStatus.CRITICAL
                          ? 'bg-[#FEF2F2] text-[#DC2626] dark:bg-red-950/60 dark:text-red-300'
                          : 'text-[#0F172A] dark:text-white'
                      }`}
                    >
                      {rec.measuredValue}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-right font-mono text-[12px] font-medium text-[#0F172A] dark:text-slate-200 tabular-nums">
                      +{rec.deltaPct.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <StatusTag status={rec.severity} />
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[11px] font-semibold text-[#334155] dark:text-slate-200 mr-1">
                          {rec.resolution}
                        </span>
                        {rec.resolution !== VarianceResolution.ACKNOWLEDGED &&
                          rec.resolution !== VarianceResolution.RESOLVED && (
                            <button
                              type="button"
                              onClick={() =>
                                onResolveVariance(
                                  rec.id,
                                  VarianceResolution.ACKNOWLEDGED
                                )
                              }
                              className="px-2 py-1 rounded border border-[#CBD5E1] text-[11px] font-medium text-[#334155] hover:bg-[#F1F5F9] dark:border-[#334155] dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              Acknowledge
                            </button>
                          )}
                        {rec.resolution !== VarianceResolution.QUARANTINED &&
                          rec.resolution !== VarianceResolution.RESOLVED && (
                            <button
                              type="button"
                              onClick={() =>
                                onResolveVariance(
                                  rec.id,
                                  VarianceResolution.QUARANTINED
                                )
                              }
                              className="px-2 py-1 rounded bg-[#FEF2F2] border border-[#FCA5A5] text-[11px] font-medium text-[#DC2626] hover:bg-red-100 dark:bg-red-950/60 dark:border-red-800 dark:text-red-300"
                            >
                              Quarantine Lot
                            </button>
                          )}
                        {rec.resolution !== VarianceResolution.RESOLVED && (
                          <button
                            type="button"
                            onClick={() =>
                              onResolveVariance(rec.id, VarianceResolution.RESOLVED)
                            }
                            className="px-2 py-1 rounded bg-[#1E293B] text-white text-[11px] font-medium hover:bg-[#0F172A] dark:bg-[#2563EB]"
                          >
                            Resolve
                          </button>
                        )}
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
