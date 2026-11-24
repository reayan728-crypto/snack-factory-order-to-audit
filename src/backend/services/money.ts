/**
 * Integer-paise monetary utilities.
 * All monetary amounts in the Order-to-Audit system are stored and computed
 * strictly as safe integers in paise (1 INR = 100 paise). Floats are never persisted.
 */

export function assertSafeIntegerPaise(amountPaise: number, label = 'amountPaise'): number {
  if (!Number.isSafeInteger(amountPaise)) {
    throw new RangeError(`${label} must be a safe integer in paise; received ${amountPaise}`);
  }
  return amountPaise;
}

/**
 * Parses a decimal Rupee amount (e.g. "2.50", "50", 140) into exact integer paise
 * without using IEEE-754 floating-point multiplication.
 */
export function rupeesToPaise(input: string | number): number {
  const raw = typeof input === 'number' ? input.toString() : input.trim();
  if (!/^-?\d+(\.\d+)?$/.test(raw)) {
    throw new RangeError(`Invalid rupee amount: "${input}"`);
  }

  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholePart, fracPart = ''] = unsigned.split('.');

  if (fracPart.length > 2) {
    throw new RangeError(`Rupee amount "${input}" has more than 2 decimal places (sub-paisa precision not allowed)`);
  }

  const paddedFrac = fracPart.padEnd(2, '0');
  const paise = Number(wholePart) * 100 + Number(paddedFrac);
  const signed = negative ? -paise : paise;

  return assertSafeIntegerPaise(signed, 'rupeesToPaise');
}

export function paiseToRupeesString(amountPaise: number): string {
  assertSafeIntegerPaise(amountPaise);
  const negative = amountPaise < 0;
  const abs = Math.abs(amountPaise);
  const rupees = Math.floor(abs / 100);
  const paise = abs % 100;
  return `${negative ? '-' : ''}${rupees}.${String(paise).padStart(2, '0')}`;
}

export type SupplyType = 'INTRA_STATE' | 'INTER_STATE';

export interface GstBreakdown {
  supplyType: SupplyType;
  subtotalPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  totalPaise: number;
}

/**
 * Computes GST breakdown in integer paise from basis points (e.g. 500 bps = 5%).
 * Intra-state (sellerState === buyerState) splits GST equally into CGST and SGST.
 * Inter-state charges full IGST.
 */
export function computeGstSplit(
  subtotalPaise: number,
  gstRateBps: number,
  sellerState: string,
  buyerState: string
): GstBreakdown {
  assertSafeIntegerPaise(subtotalPaise, 'subtotalPaise');
  if (!Number.isSafeInteger(gstRateBps) || gstRateBps < 0) {
    throw new RangeError(`gstRateBps must be a non-negative integer; received ${gstRateBps}`);
  }

  const totalTaxPaise = Math.round((subtotalPaise * gstRateBps) / 10000);
  const normalizedSeller = sellerState.trim().toLowerCase();
  const normalizedBuyer = buyerState.trim().toLowerCase();
  const supplyType: SupplyType =
    normalizedSeller === normalizedBuyer ? 'INTRA_STATE' : 'INTER_STATE';

  if (supplyType === 'INTRA_STATE') {
    const cgstPaise = Math.floor(totalTaxPaise / 2);
    const sgstPaise = totalTaxPaise - cgstPaise;
    return {
      supplyType,
      subtotalPaise,
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
      totalTaxPaise,
      totalPaise: subtotalPaise + totalTaxPaise,
    };
  }

  return {
    supplyType,
    subtotalPaise,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: totalTaxPaise,
    totalTaxPaise,
    totalPaise: subtotalPaise + totalTaxPaise,
  };
}
