import { useEffect, useMemo, useState } from 'react';
import { LineOverviewScreen } from './components/LineOverviewScreen';
import { MaterialStagingScreen } from './components/MaterialStagingScreen';
import { ProductionScheduleScreen } from './components/ProductionScheduleScreen';
import { QualityVarianceScreen } from './components/QualityVarianceScreen';
import { StationDrawer } from './components/StationDrawer';
import { TopBar } from './components/TopBar';
import { WorkOrderModal } from './components/WorkOrderModal';
import { WorkspaceToolbar } from './components/WorkspaceToolbar';
import { WorkstationTelemetryScreen } from './components/WorkstationTelemetryScreen';
import {
  INITIAL_CALIBRATION_LOGS,
  INITIAL_LINES,
  INITIAL_MATERIAL_BINS,
  INITIAL_VARIANCES,
  INITIAL_WORK_ORDERS,
} from './data/industrialData';
import {
  CalibrationLogEntry,
  MaterialBin,
  OperationalStatus,
  ProductionLine,
  ScreenView,
  ShiftCode,
  VarianceRecord,
  VarianceResolution,
  WorkOrder,
} from './types/erp';

function formatCurrentTime(): string {
  const now = new Date();
  return now.toTimeString().slice(0, 8);
}

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenView>(
    ScreenView.LINE_OVERVIEW
  );
  const [selectedShift, setSelectedShift] = useState<ShiftCode>(ShiftCode.ALL);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OperationalStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);

  const [lines, setLines] = useState<ProductionLine[]>(INITIAL_LINES);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>(INITIAL_WORK_ORDERS);
  const [variances, setVariances] = useState<VarianceRecord[]>(INITIAL_VARIANCES);
  const [calibrationLogs, setCalibrationLogs] = useState<CalibrationLogEntry[]>(
    INITIAL_CALIBRATION_LOGS
  );
  const [materialBins, setMaterialBins] = useState<MaterialBin[]>(
    INITIAL_MATERIAL_BINS
  );

  const [selectedTelemetryLineId, setSelectedTelemetryLineId] = useState<string>(
    INITIAL_LINES[2].id
  );
  const [drawerLineId, setDrawerLineId] = useState<string | null>(null);
  const [isWorkOrderModalOpen, setIsWorkOrderModalOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const filteredLines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return lines.filter((line) => {
      if (selectedShift !== ShiftCode.ALL && line.shift !== selectedShift) {
        return false;
      }
      if (statusFilter !== 'ALL' && line.status !== statusFilter) {
        return false;
      }
      if (q) {
        const haystack =
          `${line.id} ${line.stationCode} ${line.name} ${line.activeBatchId} ${line.partSku} ${line.operator}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [lines, selectedShift, statusFilter, searchQuery]);

  const filteredWorkOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return workOrders.filter((wo) => {
      if (selectedShift !== ShiftCode.ALL && wo.shift !== selectedShift) {
        return false;
      }
      if (q) {
        const haystack =
          `${wo.id} ${wo.batchCode} ${wo.partSku} ${wo.partName} ${wo.assignedLineId}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [workOrders, selectedShift, searchQuery]);

  const drawerLine = useMemo(
    () => lines.find((l) => l.id === drawerLineId) ?? null,
    [lines, drawerLineId]
  );

  const handleToggleEmergencyStop = (lineId: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        if (line.status === OperationalStatus.HALTED) {
          const recoveredStatus =
            line.spindleTempC > line.maxThermalCeilingC
              ? OperationalStatus.CRITICAL
              : Math.abs(line.toleranceDeltaPct) >= line.toleranceLimitPct * 0.8
                ? OperationalStatus.NEAR_TOLERANCE
                : OperationalStatus.NOMINAL;
          return { ...line, status: recoveredStatus };
        }
        return { ...line, status: OperationalStatus.HALTED };
      })
    );
  };

  const handleAcknowledgeCritical = (lineId: string) => {
    setVariances((prev) =>
      prev.map((v) =>
        v.lineId === lineId && v.resolution === VarianceResolution.OPEN
          ? { ...v, resolution: VarianceResolution.ACKNOWLEDGED }
          : v
      )
    );
    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId && line.status === OperationalStatus.CRITICAL
          ? { ...line, status: OperationalStatus.NEAR_TOLERANCE }
          : line
      )
    );
  };

  const handleApplyCalibration = (
    lineId: string,
    updates: {
      feedRateMmMin: number;
      maxThermalCeilingC: number;
      torqueTolerancePct: number;
    }
  ) => {
    const target = lines.find((l) => l.id === lineId);
    if (!target) return;

    const timestamp = formatCurrentTime();
    const newLogs: CalibrationLogEntry[] = [];

    if (updates.feedRateMmMin !== target.feedRateMmMin) {
      newLogs.push({
        id: `CAL-${Math.floor(715 + Math.random() * 200)}`,
        timestamp,
        stationCode: target.stationCode,
        parameter: 'Target Feed Rate',
        previousValue: `${target.feedRateMmMin} mm/min`,
        newValue: `${updates.feedRateMmMin} mm/min`,
        engineer: 'Shift Supervisor',
      });
    }
    if (updates.maxThermalCeilingC !== target.maxThermalCeilingC) {
      newLogs.push({
        id: `CAL-${Math.floor(715 + Math.random() * 200)}`,
        timestamp,
        stationCode: target.stationCode,
        parameter: 'Thermal Ceiling',
        previousValue: `${target.maxThermalCeilingC.toFixed(1)} °C`,
        newValue: `${updates.maxThermalCeilingC.toFixed(1)} °C`,
        engineer: 'Shift Supervisor',
      });
    }

    if (newLogs.length > 0) {
      setCalibrationLogs((prev) => [...newLogs, ...prev]);
    }

    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        const nextStatus =
          line.status === OperationalStatus.HALTED
            ? OperationalStatus.HALTED
            : line.spindleTempC > updates.maxThermalCeilingC ||
                Math.abs(line.toleranceDeltaPct) > updates.torqueTolerancePct
              ? OperationalStatus.CRITICAL
              : Math.abs(line.toleranceDeltaPct) >= updates.torqueTolerancePct * 0.8
                ? OperationalStatus.NEAR_TOLERANCE
                : OperationalStatus.NOMINAL;

        return {
          ...line,
          feedRateMmMin: updates.feedRateMmMin,
          maxThermalCeilingC: updates.maxThermalCeilingC,
          torqueTolerancePct: updates.torqueTolerancePct,
          toleranceLimitPct: updates.torqueTolerancePct,
          status: nextStatus,
          lastSampleTimestamp: timestamp,
        };
      })
    );
  };

  const handleSaveDrawerSetpoint = (
    lineId: string,
    updates: {
      feedRateMmMin: number;
      maxThermalCeilingC: number;
      targetUnits: number;
    }
  ) => {
    const target = lines.find((l) => l.id === lineId);
    if (!target) return;

    handleApplyCalibration(lineId, {
      feedRateMmMin: updates.feedRateMmMin,
      maxThermalCeilingC: updates.maxThermalCeilingC,
      torqueTolerancePct: target.torqueTolerancePct,
    });

    setLines((prev) =>
      prev.map((line) =>
        line.id === lineId ? { ...line, targetUnits: updates.targetUnits } : line
      )
    );
  };

  const handleUpdateWorkOrder = (
    id: string,
    patch: Partial<Pick<WorkOrder, 'assignedLineId' | 'priority' | 'targetQty'>>
  ) => {
    setWorkOrders((prev) =>
      prev.map((wo) => (wo.id === id ? { ...wo, ...patch } : wo))
    );
  };

  const handleDispatchWorkOrder = (newOrder: WorkOrder) => {
    setWorkOrders((prev) => [newOrder, ...prev]);
    setActiveScreen(ScreenView.PRODUCTION_SCHEDULE);
  };

  const handleResolveVariance = (
    id: string,
    resolution: VarianceResolution,
    note?: string
  ) => {
    setVariances((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              resolution,
              dispositionNote: note !== undefined ? note : v.dispositionNote,
            }
          : v
      )
    );
  };

  const handleStageMaterial = (binId: string, addQty: number) => {
    setMaterialBins((prev) =>
      prev.map((bin) => {
        if (bin.id !== binId) return bin;
        const nextQty = bin.onHandQty + addQty;
        return {
          ...bin,
          onHandQty: nextQty,
          status: nextQty > bin.reorderPoint ? 'ADEQUATE' : 'LOW-STOCK',
        };
      })
    );
  };

  const handleRequestReplenishment = (binId: string) => {
    setMaterialBins((prev) =>
      prev.map((bin) =>
        bin.id === binId ? { ...bin, status: 'REPLENISHING' } : bin
      )
    );
  };

  const handleOpenTelemetry = (lineId: string) => {
    setSelectedTelemetryLineId(lineId);
    setDrawerLineId(null);
    setActiveScreen(ScreenView.WORKSTATION_TELEMETRY);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] dark:bg-[#0F172A] dark:text-[#F8FAFC] flex flex-col">
      <TopBar
        activeScreen={activeScreen}
        onSelectScreen={setActiveScreen}
        onOpenNewWorkOrder={() => setIsWorkOrderModalOpen(true)}
      />

      <WorkspaceToolbar
        selectedShift={selectedShift}
        onShiftChange={setSelectedShift}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        showStatusFilter={activeScreen === ScreenView.LINE_OVERVIEW}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 py-4">
        {activeScreen === ScreenView.LINE_OVERVIEW && (
          <LineOverviewScreen
            lines={filteredLines}
            variances={variances}
            onInspectLine={(line) => setDrawerLineId(line.id)}
            onOpenTelemetry={handleOpenTelemetry}
            onEmergencyStop={handleToggleEmergencyStop}
            onAcknowledgeCritical={handleAcknowledgeCritical}
            onNavigateSchedule={() =>
              setActiveScreen(ScreenView.PRODUCTION_SCHEDULE)
            }
          />
        )}

        {activeScreen === ScreenView.PRODUCTION_SCHEDULE && (
          <ProductionScheduleScreen
            workOrders={filteredWorkOrders}
            lines={lines}
            onUpdateWorkOrder={handleUpdateWorkOrder}
            onOpenNewWorkOrder={() => setIsWorkOrderModalOpen(true)}
          />
        )}

        {activeScreen === ScreenView.WORKSTATION_TELEMETRY && (
          <WorkstationTelemetryScreen
            lines={lines}
            selectedLineId={selectedTelemetryLineId}
            onSelectLineId={setSelectedTelemetryLineId}
            calibrationLogs={calibrationLogs}
            onApplyCalibration={handleApplyCalibration}
            onToggleEmergencyStop={handleToggleEmergencyStop}
          />
        )}

        {activeScreen === ScreenView.QUALITY_VARIANCE && (
          <QualityVarianceScreen
            variances={variances}
            onResolveVariance={handleResolveVariance}
            onInspectStation={handleOpenTelemetry}
          />
        )}

        {activeScreen === ScreenView.MATERIAL_STAGING && (
          <MaterialStagingScreen
            bins={materialBins}
            onStageMaterial={handleStageMaterial}
            onRequestReplenishment={handleRequestReplenishment}
          />
        )}
      </main>

      <StationDrawer
        line={drawerLine}
        onClose={() => setDrawerLineId(null)}
        onSaveSetpoint={handleSaveDrawerSetpoint}
        onToggleEmergencyStop={handleToggleEmergencyStop}
        onOpenFullTelemetry={handleOpenTelemetry}
      />

      <WorkOrderModal
        isOpen={isWorkOrderModalOpen}
        lines={lines}
        onClose={() => setIsWorkOrderModalOpen(false)}
        onDispatch={handleDispatchWorkOrder}
      />
    </div>
  );
}
