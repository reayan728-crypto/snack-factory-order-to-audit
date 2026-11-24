import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { openDatabase } from '../src/backend/db/connection.ts';
import { seedDatabase } from '../src/backend/seed.ts';
import { getAuditTrail } from '../src/backend/services/auditLog.ts';
import {
  cancelInvoiceWithCreditNote,
  completeProductionRun,
  createAndPostInvoiceFromOrder,
  createAndPostPurchase,
  createOrder,
  createProductionRun,
  recordPayment,
  updateCustomerWithAudit,
} from '../src/backend/services/orderToAudit.ts';
import {
  getAllItemBalances,
  getItemBalance,
  getItemMovementLedger,
  recordStockMovement,
} from '../src/backend/services/stockLedger.ts';

function withSeededTempDb<T>(
  fn: (ctx: {
    db: ReturnType<typeof openDatabase>;
    seed: ReturnType<typeof seedDatabase>;
  }) => T
): T {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snack-ledger-'));
  const dbPath = path.join(tmpDir, 'order_to_audit.db');
  const db = openDatabase(dbPath);
  try {
    const seed = seedDatabase(db);
    return fn({ db, seed });
  } finally {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

test('opening balances are calculated exclusively from StockMovement and items table has no balance column', () => {
  withSeededTempDb(({ db, seed }) => {
    const columns = db.prepare("PRAGMA table_info('items')").all() as Array<{ name: string }>;
    const colNames = columns.map((c) => c.name);
    assert.equal(colNames.includes('stock_qty'), false);
    assert.equal(colNames.includes('balance'), false);
    assert.equal(colNames.includes('quantity'), false);

    assert.equal(getItemBalance(db, seed.items['RM-FLOUR']).balanceBase, 100000);
    assert.equal(getItemBalance(db, seed.items['RM-OIL']).balanceBase, 30000);
    assert.equal(getItemBalance(db, seed.items['RM-SPICE']).balanceBase, 5000);
    assert.equal(getItemBalance(db, seed.items['PKG-POUCH-200']).balanceBase, 500);
    assert.equal(getItemBalance(db, seed.items['PKG-CARTON']).balanceBase, 30);
    assert.equal(getItemBalance(db, seed.items['FG-MUR-200']).balanceBase, 50);

    const all = getAllItemBalances(db);
    assert.equal(all.length, 6);
  });
});

test('StockMovement ledger is strictly append-only at the database level', () => {
  withSeededTempDb(({ db, seed }) => {
    const flourId = seed.items['RM-FLOUR'];
    const row = db
      .prepare('SELECT id FROM stock_movements WHERE item_id = ? LIMIT 1')
      .get(flourId) as { id: number };

    assert.throws(
      () => db.prepare('UPDATE stock_movements SET quantity_base = 999 WHERE id = ?').run(row.id),
      /append-only/
    );
    assert.throws(
      () => db.prepare('DELETE FROM stock_movements WHERE id = ?').run(row.id),
      /append-only/
    );
    assert.throws(
      () =>
        recordStockMovement(db, {
          itemId: flourId,
          movementType: 'ADJUSTMENT_IN',
          quantityBase: 0,
          sourceDocType: 'ADJ',
          sourceDocId: 1,
          createdByUserId: seed.users['admin@kaviyasnacks.in'],
        }),
      /non-zero integer/
    );
  });
});

test('production run consumes BOM materials and adds finished Murukku packets in StockMovement', () => {
  withSeededTempDb(({ db, seed }) => {
    const prodUserId = seed.users['production@kaviyasnacks.in'];
    const runId = createProductionRun(db, {
      runNumber: 'PR-2026-001',
      bomId: seed.bomId,
      batchesCount: 1,
      userId: prodUserId,
    });

    completeProductionRun(db, runId, 200, prodUserId);

    // 100 kg - 40 kg = 60 kg (60000 g)
    assert.equal(getItemBalance(db, seed.items['RM-FLOUR']).balanceBase, 60000);
    // 30 L - 10 L = 20 L (20000 ml)
    assert.equal(getItemBalance(db, seed.items['RM-OIL']).balanceBase, 20000);
    // 5 kg - 1.2 kg = 3.8 kg (3800 g)
    assert.equal(getItemBalance(db, seed.items['RM-SPICE']).balanceBase, 3800);
    // 500 - 200 = 300 pouches
    assert.equal(getItemBalance(db, seed.items['PKG-POUCH-200']).balanceBase, 300);
    // 30 - 10 = 20 cartons
    assert.equal(getItemBalance(db, seed.items['PKG-CARTON']).balanceBase, 20);
    // 50 opening + 200 produced = 250 packets
    assert.equal(getItemBalance(db, seed.items['FG-MUR-200']).balanceBase, 250);

    // Ledger history shows opening (+50) then production (+200) -> running 250
    const ledger = getItemMovementLedger(db, seed.items['FG-MUR-200']);
    assert.equal(ledger.length, 2);
    assert.equal(ledger[0].running_balance_base, 50);
    assert.equal(ledger[1].running_balance_base, 250);
  });
});

test('insufficient raw material aborts production run atomically without partial deductions', () => {
  withSeededTempDb(({ db, seed }) => {
    const prodUserId = seed.users['production@kaviyasnacks.in'];
    // 3 batches require 120 kg flour, but only 100 kg is on hand.
    const runId = createProductionRun(db, {
      runNumber: 'PR-2026-OVER',
      bomId: seed.bomId,
      batchesCount: 3,
      userId: prodUserId,
    });

    assert.throws(
      () => completeProductionRun(db, runId, 600, prodUserId),
      /Insufficient stock/
    );

    // Balances must remain completely unchanged
    assert.equal(getItemBalance(db, seed.items['RM-FLOUR']).balanceBase, 100000);
    assert.equal(getItemBalance(db, seed.items['RM-OIL']).balanceBase, 30000);
    assert.equal(getItemBalance(db, seed.items['FG-MUR-200']).balanceBase, 50);
  });
});

test('purchase receipt, order, GST invoice, payment, and credit-note cancellation maintain exact ledger and audit trail', () => {
  withSeededTempDb(({ db, seed }) => {
    const adminId = seed.users['admin@kaviyasnacks.in'];
    const salesmanAId = seed.users['salesman.a@kaviyasnacks.in'];
    const accountantId = seed.users['accounts@kaviyasnacks.in'];

    // Purchase 50 kg more flour
    createAndPostPurchase(db, {
      purchaseNumber: 'PO-2026-01',
      supplierName: 'Kaveri Agro Mills',
      supplierGstin: '33AAACK9999K1Z1',
      purchaseDate: '2026-11-24',
      lines: [
        {
          itemId: seed.items['RM-FLOUR'],
          quantity: '50',
          unit: 'kg',
          lineTotalPaise: 210000,
        },
      ],
      userId: adminId,
    });
    assert.equal(getItemBalance(db, seed.items['RM-FLOUR']).balanceBase, 150000);

    // Order 40 packets for Retailer A (Tamil Nadu -> INTRA_STATE 2.5% CGST + 2.5% SGST)
    const orderId = createOrder(db, {
      orderNumber: 'ORD-2026-001',
      customerId: seed.customers['CUST-RET-A'],
      salesmanUserId: salesmanAId,
      orderDate: '2026-11-24',
      lines: [{ productId: seed.productId, quantityPackets: 40 }],
    });

    const invoiceId = createAndPostInvoiceFromOrder(db, {
      invoiceNumber: 'INV-2026-001',
      orderId,
      userId: accountantId,
    });

    // Finished Murukku drops from 50 to 10 packets
    assert.equal(getItemBalance(db, seed.items['FG-MUR-200']).balanceBase, 10);

    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as {
      supply_type: string;
      subtotal_paise: number;
      cgst_paise: number;
      sgst_paise: number;
      igst_paise: number;
      total_paise: number;
    };
    assert.equal(inv.supply_type, 'INTRA_STATE');
    assert.equal(inv.subtotal_paise, 200000); // 40 * 5000 paise
    assert.equal(inv.cgst_paise, 5000);
    assert.equal(inv.sgst_paise, 5000);
    assert.equal(inv.igst_paise, 0);
    assert.equal(inv.total_paise, 210000);

    // Posted invoice cannot be deleted
    assert.throws(
      () => db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId),
      /cannot be deleted/
    );

    // Partial payment recorded
    recordPayment(db, {
      paymentNumber: 'PAY-2026-001',
      invoiceId,
      amountPaise: 100000,
      paymentMode: 'UPI',
      referenceNo: 'UPI-998877',
      paymentDate: '2026-11-24',
      userId: accountantId,
    });

    // Cancel posted invoice with Credit Note -> restores 40 packets back to StockMovement
    const creditNoteId = cancelInvoiceWithCreditNote(db, {
      invoiceId,
      creditNoteNumber: 'CN-2026-001',
      reason: 'Customer requested batch swap before dispatch',
      userId: adminId,
    });
    assert.ok(creditNoteId > 0);
    assert.equal(getItemBalance(db, seed.items['FG-MUR-200']).balanceBase, 50);

    // Customer edit is logged in audit_logs with user and timestamp
    updateCustomerWithAudit(db, {
      customerId: seed.customers['CUST-RET-A'],
      billingAddress: '22 Cross Cut Road, Coimbatore, Tamil Nadu 641012',
      userId: adminId,
      reason: 'Updated shop door number',
    });

    const customerAudit = getAuditTrail(db, 'customer', seed.customers['CUST-RET-A']) as Array<{
      action: string;
      changed_by_user_id: number;
      changed_at: string;
    }>;
    assert.equal(customerAudit.length, 1);
    assert.equal(customerAudit[0].action, 'UPDATE');
    assert.equal(customerAudit[0].changed_by_user_id, adminId);
    assert.ok(customerAudit[0].changed_at.length > 10);
  });
});
