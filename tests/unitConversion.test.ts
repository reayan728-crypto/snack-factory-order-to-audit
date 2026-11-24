import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openDatabase } from '../src/backend/db/connection.ts';
import { seedDatabase } from '../src/backend/seed.ts';
import {
  computeGstSplit,
  paiseToRupeesString,
  rupeesToPaise,
} from '../src/backend/services/money.ts';
import {
  convertToBaseUnitDb,
  convertToBaseUnitPure,
  decomposeBaseQuantity,
  scaleDecimalExact,
} from '../src/backend/services/unitConversion.ts';

test('kg to g and g to kg exact conversions without float drift', () => {
  assert.equal(convertToBaseUnitPure('100', 'kg', 'g'), 100000);
  assert.equal(convertToBaseUnitPure('1.2', 'kg', 'g'), 1200);
  assert.equal(convertToBaseUnitPure(0.25, 'kg', 'g'), 250);
  assert.equal(convertToBaseUnitPure(750, 'g', 'g'), 750);
  assert.equal(scaleDecimalExact('40', 1000, 1), 40000);

  const decomp = decomposeBaseQuantity(1200, 'g', 'kg');
  assert.equal(decomp.whole, 1);
  assert.equal(decomp.remainderBase, 200);
  assert.equal(decomp.decimalDisplay, '1.2 kg');
});

test('litre to ml and ml to litre exact conversions', () => {
  assert.equal(convertToBaseUnitPure('30', 'litre', 'ml'), 30000);
  assert.equal(convertToBaseUnitPure('10', 'L', 'ml'), 10000);
  assert.equal(convertToBaseUnitPure('2.5', 'litres', 'ml'), 2500);
  assert.equal(convertToBaseUnitPure(500, 'ml', 'ml'), 500);

  const decomp = decomposeBaseQuantity(30500, 'ml', 'litre');
  assert.equal(decomp.whole, 30);
  assert.equal(decomp.remainderBase, 500);
  assert.equal(decomp.decimalDisplay, '30.5 litre');
});

test('piece, packet, and carton of 20 packets conversions', () => {
  assert.equal(convertToBaseUnitPure(500, 'piece', 'piece'), 500);
  assert.equal(convertToBaseUnitPure(30, 'pcs', 'piece'), 30);
  assert.equal(convertToBaseUnitPure(10, 'carton', 'packet'), 200);
  assert.equal(convertToBaseUnitPure('2.5', 'carton', 'packet'), 50);

  const decomp = decomposeBaseQuantity(50, 'packet', 'carton', 20);
  assert.equal(decomp.whole, 2);
  assert.equal(decomp.remainderBase, 10);
  assert.equal(decomp.decimalDisplay, '2.5 carton');
});

test('database unit_conversions table resolves item-specific carton conversion', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snack-conv-'));
  const dbPath = path.join(tmpDir, 'test.db');
  const db = openDatabase(dbPath);
  try {
    const summary = seedDatabase(db);
    const murukkuItemId = summary.items['FG-MUR-200'];
    const flourItemId = summary.items['RM-FLOUR'];

    const cartonsToPackets = convertToBaseUnitDb(db, murukkuItemId, 10, 'carton');
    assert.equal(cartonsToPackets.quantityBase, 200);
    assert.equal(cartonsToPackets.baseUnit, 'packet');

    const spiceKgToG = convertToBaseUnitDb(db, summary.items['RM-SPICE'], '1.2', 'kg');
    assert.equal(spiceKgToG.quantityBase, 1200);
    assert.equal(spiceKgToG.baseUnit, 'g');

    assert.throws(
      () => convertToBaseUnitDb(db, flourItemId, 1, 'litre'),
      /Unsupported unit conversion/
    );
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('rejects invalid decimal precision, negative quantities, and incompatible units', () => {
  assert.throws(() => convertToBaseUnitPure('0.0001', 'kg', 'g'), /exact integer base unit/);
  assert.throws(() => convertToBaseUnitPure(-5, 'kg', 'g'), /non-negative/);
  assert.throws(() => convertToBaseUnitPure(1, 'carton', 'g'), /Unsupported unit conversion/);
});

test('integer paise conversion and Tamil Nadu vs Karnataka GST split', () => {
  assert.equal(rupeesToPaise('2.50'), 250);
  assert.equal(rupeesToPaise(50), 5000);
  assert.equal(paiseToRupeesString(5250), '52.50');
  assert.throws(() => rupeesToPaise('10.123'), /more than 2 decimal places/);

  // 20 packets * Rs 50 = Rs 1000 (100000 paise), 5% GST = 5000 paise
  const tnIntra = computeGstSplit(100000, 500, 'Tamil Nadu', 'Tamil Nadu');
  assert.equal(tnIntra.supplyType, 'INTRA_STATE');
  assert.equal(tnIntra.cgstPaise, 2500);
  assert.equal(tnIntra.sgstPaise, 2500);
  assert.equal(tnIntra.igstPaise, 0);
  assert.equal(tnIntra.totalPaise, 105000);

  const kaInter = computeGstSplit(100000, 500, 'Tamil Nadu', 'Karnataka');
  assert.equal(kaInter.supplyType, 'INTER_STATE');
  assert.equal(kaInter.cgstPaise, 0);
  assert.equal(kaInter.sgstPaise, 0);
  assert.equal(kaInter.igstPaise, 5000);
  assert.equal(kaInter.totalPaise, 105000);
});
