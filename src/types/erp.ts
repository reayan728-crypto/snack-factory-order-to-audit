export enum ScreenView {
  LINE_OVERVIEW = 'line-overview',
  PRODUCTION_SCHEDULE = 'production-schedule',
  WORKSTATION_TELEMETRY = 'workstation-telemetry',
  QUALITY_VARIANCE = 'quality-variance',
  MATERIAL_STAGING = 'material-staging',
}

export enum OperationalStatus {
  NOMINAL = 'NOMINAL',
  NEAR_TOLERANCE = 'NEAR-TOLERANCE',
  CRITICAL = 'CRITICAL',
  HALTED = 'HALTED',
}

export enum ShiftCode {
  ALL = 'ALL',
  SHIFT_A = 'SHIFT-A',
  SHIFT_B = 'SHIFT-B',
  SHIFT_C = 'SHIFT-C',
}

export enum BatchPriority {
  EXPEDITE = 'EXPEDITE',
  STANDARD = 'STANDARD',
  HOLD = 'HOLD',
}

export enum VarianceResolution {
  OPEN = 'OPEN',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  QUARANTINED = 'QUARANTINED',
  RESOLVED = 'RESOLVED',
}

export interface ProductionLine {
  id: string;
  stationCode: string;
  name: string;
  department: string;
  activeBatchId: string;
  partSku: string;
  partDescription: string;
  shift: ShiftCode;
  operator: string;
  targetUnits: number;
  actualUnits: number;
  cycleTimeSec: number;
  nominalCycleTimeSec: number;
  toleranceDeltaPct: number;
  toleranceLimitPct: number;
  oeePct: number;
  spindleTempC: number;
  maxThermalCeilingC: number;
  feedRateMmMin: number;
  nominalFeedRateMmMin: number;
  torqueTolerancePct: number;
  hydraulicBar: number;
  vibrationRms: number;
  status: OperationalStatus;
  lastSampleTimestamp: string;
  tempSeries: number[];
  loadSeries: number[];
  ganttStartHour: number; // 0 to 12 relative to shift window 06:00 - 18:00
  ganttDurationHours: number;
}

export interface WorkOrder {
  id: string;
  batchCode: string;
  partSku: string;
  partName: string;
  assignedLineId: string;
  shift: ShiftCode;
  priority: BatchPriority;
  targetQty: number;
  completedQty: number;
  startHour: number;
  durationHours: number;
  dueTime: string;
  materialStatus: 'STAGED' | 'PARTIAL' | 'PENDING';
}

export interface VarianceRecord {
  id: string;
  timestamp: string;
  lineId: string;
  stationCode: string;
  batchCode: string;
  parameter: string;
  nominalSpec: string;
  measuredValue: string;
  deltaPct: number;
  severity: OperationalStatus;
  resolution: VarianceResolution;
  dispositionNote: string;
}

export interface CalibrationLogEntry {
  id: string;
  timestamp: string;
  stationCode: string;
  parameter: string;
  previousValue: string;
  newValue: string;
  engineer: string;
}

export interface MaterialBin {
  id: string;
  binLocation: string;
  materialCode: string;
  specification: string;
  assignedLineId: string;
  onHandQty: number;
  unit: string;
  burnRatePerHr: number;
  reorderPoint: number;
  status: 'ADEQUATE' | 'LOW-STOCK' | 'REPLENISHING';
}
