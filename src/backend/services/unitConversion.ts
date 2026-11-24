import type { DatabaseSync } from 'node:sqlite';

export type BaseUnit = 'g' | 'ml' | 'piece' | 'packet';
export type UnitName = 'kg' | 'g' | 'litre' | 'l' | 'ml' | 'piece' | 'packet' | 'carton';

export interface ConversionFactor {
  fromUnit: string;
  toUnit: string;
  numerator: number;
  denominator: number;
}

const DEFAULT_CONVERSIONS: Record<string, Record<string, { numerator: number; denominator: number }>> = {
  kg: {
    g: { numerator: 1000, denominator: 1 },
    kg: { numerator: 1, denominator: 1 },
  },
  g: {
    g: { numerator: 1, denominator: 1 },
    kg: { numerator: 1, denominator: 1000 },
  },
  litre: {
    ml: { numerator: 1000, denominator: 1 },
    litre: { numerator: 1, denominator: 1 },
  },
  l: {
    ml: { numerator: 1000, denominator: 1 },
    litre: { numerator: 1, denominator: 1 },
    l: { numerator: 1, denominator: 1 },
  },
  ml: {
    ml: { numerator: 1, denominator: 1 },
    litre: { numerator: 1, denominator: 1000 },
    l: { numerator: 1, denominator: 1000 },
  },
  piece: {
    piece: { numerator: 1, denominator: 1 },
  },
  packet: {
    packet: { numerator: 1, denominator: 1 },
    carton: { numerator: 1, denominator: 20 },
  },
  carton: {
    packet: { numerator: 20, denominator: 1 },
    carton: { numerator: 1, denominator: 1 },
  },
};

export function normalizeUnitName(unit: string): string {
  const cleaned = unit.trim().toLowerCase();
  if (cleaned === 'l' || cleaned === 'liter' || cleaned === 'liters' || cleaned === 'litres') {
    return 'litre';
  }
  if (cleaned === 'pcs' || cleaned === 'pieces' || cleaned === 'pc') {
    return 'piece';
  }
  if (cleaned === 'pkt' || cleaned === 'pkts' || cleaned === 'packets') {
    return 'packet';
  }
  if (cleaned === 'cartons' || cleaned === 'ctn') {
    return 'carton';
  }
  if (cleaned === 'grams' || cleaned === 'gm' || cleaned === 'gms') {
    return 'g';
  }
  if (cleaned === 'kgs' || cleaned === 'kilogram' || cleaned === 'kilograms') {
    return 'kg';
  }
  return cleaned;
}

/**
 * Scales a decimal quantity string or number by an integer factor without float drift.
 * Example: scaleDecimalExact("1.2", 1000, 1) -> 1200
 */
export function scaleDecimalExact(
  quantity: string | number,
  numerator: number,
  denominator: number
): number {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || numerator <= 0 || denominator <= 0) {
    throw new RangeError(`Invalid conversion ratio ${numerator}/${denominator}`);
  }

  const raw = typeof quantity === 'number' ? quantity.toString() : quantity.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    throw new RangeError(`Quantity must be a non-negative decimal value; received "${quantity}"`);
  }

  const [whole, frac = ''] = raw.split('.');
  const scale = BigInt(10) ** BigInt(frac.length);
  const scaledQty = BigInt(whole + frac);

  const num = scaledQty * BigInt(numerator);
  const den = scale * BigInt(denominator);

  if (num % den !== 0n) {
    throw new RangeError(
      `Quantity "${quantity}" with ratio ${numerator}/${denominator} does not resolve to an exact integer base unit`
    );
  }

  const result = num / den;
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Converted quantity exceeds MAX_SAFE_INTEGER');
  }
  return Number(result);
}

/**
 * Pure unit conversion to an item's base unit using either explicit conversion rows
 * or built-in standard conversions. Returns exact integer base quantity.
 */
export function convertToBaseUnitPure(
  quantity: string | number,
  fromUnit: string,
  baseUnit: BaseUnit,
  customConversions: ConversionFactor[] = []
): number {
  const from = normalizeUnitName(fromUnit);
  const to = normalizeUnitName(baseUnit);

  const customMatch = customConversions.find(
    (c) => normalizeUnitName(c.fromUnit) === from && normalizeUnitName(c.toUnit) === to
  );
  if (customMatch) {
    return scaleDecimalExact(quantity, customMatch.numerator, customMatch.denominator);
  }

  const defaultMatch = DEFAULT_CONVERSIONS[from]?.[to];
  if (!defaultMatch) {
    throw new Error(`Unsupported unit conversion from "${fromUnit}" to base unit "${baseUnit}"`);
  }

  return scaleDecimalExact(quantity, defaultMatch.numerator, defaultMatch.denominator);
}

/**
 * Database-backed unit conversion to an item's base unit.
 * Checks item-specific conversion rules first, then global conversion rules in `unit_conversions`.
 */
export function convertToBaseUnitDb(
  db: DatabaseSync,
  itemId: number,
  quantity: string | number,
  fromUnit: string
): { quantityBase: number; baseUnit: BaseUnit } {
  const itemRow = db
    .prepare('SELECT id, base_unit FROM items WHERE id = ?')
    .get(itemId) as { id: number; base_unit: BaseUnit } | undefined;

  if (!itemRow) {
    throw new Error(`Item ${itemId} not found`);
  }

  const from = normalizeUnitName(fromUnit);
  const to = normalizeUnitName(itemRow.base_unit);

  if (from === to) {
    return {
      quantityBase: scaleDecimalExact(quantity, 1, 1),
      baseUnit: itemRow.base_unit,
    };
  }

  const rows = db
    .prepare(
      `SELECT item_id, from_unit, to_unit, factor_numerator, factor_denominator
       FROM unit_conversions
       WHERE (item_id = ? OR item_id IS NULL)
         AND LOWER(from_unit) = ?
         AND LOWER(to_unit) = ?
       ORDER BY CASE WHEN item_id IS NOT NULL THEN 0 ELSE 1 END
       LIMIT 1`
    )
    .all(itemId, from, to) as Array<{
      item_id: number | null;
      from_unit: string;
      to_unit: string;
      factor_numerator: number;
      factor_denominator: number;
    }>;

  if (rows.length > 0) {
    const rule = rows[0];
    return {
      quantityBase: scaleDecimalExact(quantity, rule.factor_numerator, rule.factor_denominator),
      baseUnit: itemRow.base_unit,
    };
  }

  return {
    quantityBase: convertToBaseUnitPure(quantity, fromUnit, itemRow.base_unit),
    baseUnit: itemRow.base_unit,
  };
}

/**
 * Converts an integer base-unit quantity into a larger display unit (e.g. 1200 g -> "1.2 kg",
 * 50 packets -> { whole: 2, remainderBase: 10, display: "2 carton + 10 packet" }).
 */
export function decomposeBaseQuantity(
  quantityBase: number,
  baseUnit: BaseUnit,
  targetUnit: string,
  packSize = 20
): { whole: number; remainderBase: number; decimalDisplay: string } {
  if (!Number.isSafeInteger(quantityBase)) {
    throw new RangeError(`quantityBase must be an integer; received ${quantityBase}`);
  }

  const target = normalizeUnitName(targetUnit);
  const base = normalizeUnitName(baseUnit);

  if (target === base) {
    return {
      whole: quantityBase,
      remainderBase: 0,
      decimalDisplay: `${quantityBase} ${base}`,
    };
  }

  let factor = 1;
  if (base === 'g' && target === 'kg') factor = 1000;
  else if (base === 'ml' && target === 'litre') factor = 1000;
  else if (base === 'packet' && target === 'carton') factor = packSize;
  else {
    throw new Error(`Cannot decompose base unit "${baseUnit}" into "${targetUnit}"`);
  }

  const sign = quantityBase < 0 ? -1 : 1;
  const abs = Math.abs(quantityBase);
  const whole = sign * Math.floor(abs / factor);
  const remainderBase = sign * (abs % factor);

  const fracDigits = factor === 1000 ? 3 : 2;
  const decimalRaw =
    factor === 1000
      ? `${whole}.${String(Math.abs(remainderBase)).padStart(fracDigits, '0').replace(/0+$/, '')}`.replace(/\.$/, '')
      : `${(quantityBase / factor).toFixed(2).replace(/\.?0+$/, '')}`;

  return {
    whole,
    remainderBase,
    decimalDisplay: `${decimalRaw} ${target}`,
  };
}
