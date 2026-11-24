import type { DatabaseSync } from 'node:sqlite';
import { assertSafeIntegerPaise } from './money.ts';
import type { BaseUnit } from './unitConversion.ts';

export type MovementType =
  | 'OPENING_BALANCE'
  | 'PURCHASE_RECEIPT'
  | 'PRODUCTION_CONSUME'
  | 'PRODUCTION_OUTPUT'
  | 'ORDER_DISPATCH'
  | 'INVOICE_SALE'
  | 'CREDIT_NOTE_RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT';

export interface RecordStockMovementInput {
  itemId: number;
  movementType: MovementType;
  quantityBase: number;
  unitCostPaise?: number;
  totalValuePaise?: number;
  sourceDocType: string;
  sourceDocId: number;
  createdByUserId: number;
  createdAt?: string;
  allowNegative?: boolean;
}

export interface ItemBalanceRow {
  itemId: number;
  sku: string;
  name: string;
  itemType: 'raw_material' | 'packaging' | 'finished_good';
  baseUnit: BaseUnit;
  balanceBase: number;
}

export function getItemBalance(
  db: DatabaseSync,
  itemId: number,
  asOfIso?: string
): ItemBalanceRow {
  const item = db
    .prepare(
      `SELECT id, sku, name, item_type, base_unit
       FROM items
       WHERE id = ?`
    )
    .get(itemId) as
    | {
        id: number;
        sku: string;
        name: string;
        item_type: 'raw_material' | 'packaging' | 'finished_good';
        base_unit: BaseUnit;
      }
    | undefined;

  if (!item) {
    throw new Error(`Item ${itemId} does not exist`);
  }

  const row = asOfIso
    ? (db
        .prepare(
          `SELECT COALESCE(SUM(quantity_base), 0) AS balance_base
           FROM stock_movements
           WHERE item_id = ? AND created_at <= ?`
        )
        .get(itemId, asOfIso) as { balance_base: number })
    : (db
        .prepare(
          `SELECT COALESCE(SUM(quantity_base), 0) AS balance_base
           FROM stock_movements
           WHERE item_id = ?`
        )
        .get(itemId) as { balance_base: number });

  return {
    itemId: item.id,
    sku: item.sku,
    name: item.name,
    itemType: item.item_type,
    baseUnit: item.base_unit,
    balanceBase: Number(row.balance_base),
  };
}

export function getAllItemBalances(db: DatabaseSync): ItemBalanceRow[] {
  const rows = db
    .prepare(
      `SELECT
         i.id AS item_id,
         i.sku,
         i.name,
         i.item_type,
         i.base_unit,
         COALESCE(SUM(sm.quantity_base), 0) AS balance_base
       FROM items i
       LEFT JOIN stock_movements sm ON sm.item_id = i.id
       GROUP BY i.id
       ORDER BY i.id ASC`
    )
    .all() as Array<{
    item_id: number;
    sku: string;
    name: string;
    item_type: 'raw_material' | 'packaging' | 'finished_good';
    base_unit: BaseUnit;
    balance_base: number;
  }>;

  return rows.map((r) => ({
    itemId: r.item_id,
    sku: r.sku,
    name: r.name,
    itemType: r.item_type,
    baseUnit: r.base_unit,
    balanceBase: Number(r.balance_base),
  }));
}

export function recordStockMovement(
  db: DatabaseSync,
  input: RecordStockMovementInput
): number {
  if (!Number.isSafeInteger(input.quantityBase) || input.quantityBase === 0) {
    throw new RangeError(
      `StockMovement quantityBase must be a non-zero integer; received ${input.quantityBase}`
    );
  }

  const unitCostPaise = assertSafeIntegerPaise(input.unitCostPaise ?? 0, 'unitCostPaise');
  const totalValuePaise = assertSafeIntegerPaise(
    input.totalValuePaise ?? 0,
    'totalValuePaise'
  );

  if (input.quantityBase < 0 && !input.allowNegative) {
    const current = getItemBalance(db, input.itemId);
    const projected = current.balanceBase + input.quantityBase;
    if (projected < 0) {
      throw new Error(
        `Insufficient stock for ${current.sku} (${current.name}): current ${current.balanceBase} ${current.baseUnit}, requested ${Math.abs(input.quantityBase)} ${current.baseUnit}`
      );
    }
  }

  const timestamp = input.createdAt ?? new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO stock_movements (
       item_id, movement_type, quantity_base, unit_cost_paise, total_value_paise,
       source_doc_type, source_doc_id, created_by_user_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const info = stmt.run(
    input.itemId,
    input.movementType,
    input.quantityBase,
    unitCostPaise,
    totalValuePaise,
    input.sourceDocType,
    input.sourceDocId,
    input.createdByUserId,
    timestamp
  );

  return Number(info.lastInsertRowid);
}

export function getItemMovementLedger(db: DatabaseSync, itemId: number) {
  const rows = db
    .prepare(
      `SELECT
         sm.id,
         sm.item_id,
         sm.movement_type,
         sm.quantity_base,
         sm.unit_cost_paise,
         sm.total_value_paise,
         sm.source_doc_type,
         sm.source_doc_id,
         sm.created_by_user_id,
         u.name AS created_by_name,
         sm.created_at
       FROM stock_movements sm
       JOIN users u ON u.id = sm.created_by_user_id
       WHERE sm.item_id = ?
       ORDER BY sm.id ASC`
    )
    .all(itemId) as Array<{
    id: number;
    item_id: number;
    movement_type: MovementType;
    quantity_base: number;
    unit_cost_paise: number;
    total_value_paise: number;
    source_doc_type: string;
    source_doc_id: number;
    created_by_user_id: number;
    created_by_name: string;
    created_at: string;
  }>;

  let running = 0;
  return rows.map((r) => {
    running += Number(r.quantity_base);
    return {
      ...r,
      running_balance_base: running,
    };
  });
}
