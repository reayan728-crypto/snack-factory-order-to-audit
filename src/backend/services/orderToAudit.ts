import type { DatabaseSync } from 'node:sqlite';
import { runInTransaction } from '../db/connection.ts';
import { logAudit } from './auditLog.ts';
import { assertSafeIntegerPaise, computeGstSplit } from './money.ts';
import { recordStockMovement } from './stockLedger.ts';
import { convertToBaseUnitDb } from './unitConversion.ts';

export const SELLER_STATE = 'Tamil Nadu';

export interface PurchaseLineInput {
  itemId: number;
  quantity: string | number;
  unit: string;
  lineTotalPaise: number;
}

export function createAndPostPurchase(
  db: DatabaseSync,
  input: {
    purchaseNumber: string;
    supplierName: string;
    supplierGstin: string;
    purchaseDate: string;
    taxPaise?: number;
    lines: PurchaseLineInput[];
    userId: number;
  }
): number {
  return runInTransaction(db, () => {
    if (input.lines.length === 0) {
      throw new Error('Purchase must contain at least one item line');
    }

    const subtotalPaise = input.lines.reduce(
      (sum, l) => sum + assertSafeIntegerPaise(l.lineTotalPaise, 'lineTotalPaise'),
      0
    );
    const taxPaise = assertSafeIntegerPaise(input.taxPaise ?? 0, 'taxPaise');
    const totalPaise = subtotalPaise + taxPaise;
    const now = new Date().toISOString();

    const pInfo = db
      .prepare(
        `INSERT INTO purchases (
           purchase_number, supplier_name, supplier_gstin, purchase_date,
           status, subtotal_paise, tax_paise, total_paise,
           created_by_user_id, posted_by_user_id, posted_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'POSTED', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.purchaseNumber,
        input.supplierName,
        input.supplierGstin,
        input.purchaseDate,
        subtotalPaise,
        taxPaise,
        totalPaise,
        input.userId,
        input.userId,
        now,
        now,
        now
      );

    const purchaseId = Number(pInfo.lastInsertRowid);

    for (const line of input.lines) {
      const { quantityBase } = convertToBaseUnitDb(db, line.itemId, line.quantity, line.unit);
      const unitCostPaise = Math.round(line.lineTotalPaise / quantityBase);

      db.prepare(
        `INSERT INTO purchase_items (
           purchase_id, item_id, quantity_base, input_quantity, input_unit, unit_cost_paise, line_total_paise
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        purchaseId,
        line.itemId,
        quantityBase,
        String(line.quantity),
        line.unit,
        unitCostPaise,
        line.lineTotalPaise
      );

      recordStockMovement(db, {
        itemId: line.itemId,
        movementType: 'PURCHASE_RECEIPT',
        quantityBase,
        unitCostPaise,
        totalValuePaise: line.lineTotalPaise,
        sourceDocType: 'PURCHASE',
        sourceDocId: purchaseId,
        createdByUserId: input.userId,
        createdAt: now,
      });
    }

    logAudit(db, {
      entityType: 'purchase',
      entityId: purchaseId,
      action: 'POST',
      changedByUserId: input.userId,
      after: { purchaseNumber: input.purchaseNumber, totalPaise },
      changedAt: now,
    });

    return purchaseId;
  });
}

export function createProductionRun(
  db: DatabaseSync,
  input: {
    runNumber: string;
    bomId: number;
    batchesCount: number;
    userId: number;
  }
): number {
  if (!Number.isSafeInteger(input.batchesCount) || input.batchesCount <= 0) {
    throw new RangeError('batchesCount must be a positive integer');
  }

  return runInTransaction(db, () => {
    const bom = db
      .prepare('SELECT id, product_id, expected_yield_packets FROM boms WHERE id = ?')
      .get(input.bomId) as
      | { id: number; product_id: number; expected_yield_packets: number }
      | undefined;

    if (!bom) {
      throw new Error(`BOM ${input.bomId} not found`);
    }

    const expectedYieldPackets = bom.expected_yield_packets * input.batchesCount;
    const now = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO production_runs (
           run_number, bom_id, product_id, batches_count, expected_yield_packets,
           status, started_at, created_by_user_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 'IN_PROGRESS', ?, ?, ?, ?)`
      )
      .run(
        input.runNumber,
        bom.id,
        bom.product_id,
        input.batchesCount,
        expectedYieldPackets,
        now,
        input.userId,
        now,
        now
      );

    const runId = Number(info.lastInsertRowid);
    logAudit(db, {
      entityType: 'production_run',
      entityId: runId,
      action: 'CREATE',
      changedByUserId: input.userId,
      after: { runNumber: input.runNumber, batchesCount: input.batchesCount, expectedYieldPackets },
      changedAt: now,
    });

    return runId;
  });
}

export function completeProductionRun(
  db: DatabaseSync,
  runId: number,
  actualYieldPackets: number,
  userId: number
): void {
  if (!Number.isSafeInteger(actualYieldPackets) || actualYieldPackets <= 0) {
    throw new RangeError('actualYieldPackets must be a positive integer');
  }

  runInTransaction(db, () => {
    const run = db
      .prepare(
        `SELECT pr.*, p.finished_item_id
         FROM production_runs pr
         JOIN products p ON p.id = pr.product_id
         WHERE pr.id = ?`
      )
      .get(runId) as
      | {
          id: number;
          run_number: string;
          bom_id: number;
          product_id: number;
          finished_item_id: number;
          batches_count: number;
          status: string;
        }
      | undefined;

    if (!run) {
      throw new Error(`Production run ${runId} not found`);
    }
    if (run.status === 'COMPLETED' || run.status === 'CANCELLED') {
      throw new Error(`Production run ${run.run_number} is already ${run.status}`);
    }

    const bomItems = db
      .prepare('SELECT item_id, quantity_base FROM bom_items WHERE bom_id = ?')
      .all(run.bom_id) as Array<{ item_id: number; quantity_base: number }>;

    if (bomItems.length === 0) {
      throw new Error(`BOM ${run.bom_id} has no ingredient/packaging lines`);
    }

    const now = new Date().toISOString();

    for (const bi of bomItems) {
      const consumeQty = -(bi.quantity_base * run.batches_count);
      recordStockMovement(db, {
        itemId: bi.item_id,
        movementType: 'PRODUCTION_CONSUME',
        quantityBase: consumeQty,
        sourceDocType: 'PRODUCTION_RUN',
        sourceDocId: run.id,
        createdByUserId: userId,
        createdAt: now,
      });
    }

    recordStockMovement(db, {
      itemId: run.finished_item_id,
      movementType: 'PRODUCTION_OUTPUT',
      quantityBase: actualYieldPackets,
      sourceDocType: 'PRODUCTION_RUN',
      sourceDocId: run.id,
      createdByUserId: userId,
      createdAt: now,
    });

    db.prepare(
      `UPDATE production_runs
       SET status = 'COMPLETED',
           actual_yield_packets = ?,
           completed_at = ?,
           completed_by_user_id = ?,
           updated_at = ?
       WHERE id = ?`
    ).run(actualYieldPackets, now, userId, now, run.id);

    logAudit(db, {
      entityType: 'production_run',
      entityId: run.id,
      action: 'COMPLETE',
      changedByUserId: userId,
      before: { status: run.status },
      after: { status: 'COMPLETED', actualYieldPackets },
      changedAt: now,
    });
  });
}

export function createOrder(
  db: DatabaseSync,
  input: {
    orderNumber: string;
    customerId: number;
    salesmanUserId: number;
    orderDate: string;
    notes?: string;
    lines: Array<{ productId: number; quantityPackets: number }>;
  }
): number {
  if (input.lines.length === 0) {
    throw new Error('Order must contain at least one product line');
  }

  return runInTransaction(db, () => {
    const customer = db
      .prepare('SELECT id, state FROM customers WHERE id = ?')
      .get(input.customerId) as { id: number; state: string } | undefined;
    if (!customer) {
      throw new Error(`Customer ${input.customerId} not found`);
    }

    let orderSubtotal = 0;
    let orderTax = 0;
    const computedLines: Array<{
      productId: number;
      quantityPackets: number;
      unitPricePaise: number;
      gstRateBps: number;
      lineSubtotalPaise: number;
      lineTaxPaise: number;
      lineTotalPaise: number;
    }> = [];

    for (const line of input.lines) {
      if (!Number.isSafeInteger(line.quantityPackets) || line.quantityPackets <= 0) {
        throw new RangeError('quantityPackets must be a positive integer');
      }
      const product = db
        .prepare('SELECT id, selling_price_paise, gst_rate_bps FROM products WHERE id = ?')
        .get(line.productId) as
        | { id: number; selling_price_paise: number; gst_rate_bps: number }
        | undefined;
      if (!product) {
        throw new Error(`Product ${line.productId} not found`);
      }

      const lineSubtotalPaise = product.selling_price_paise * line.quantityPackets;
      const gst = computeGstSplit(
        lineSubtotalPaise,
        product.gst_rate_bps,
        SELLER_STATE,
        customer.state
      );

      orderSubtotal += lineSubtotalPaise;
      orderTax += gst.totalTaxPaise;
      computedLines.push({
        productId: product.id,
        quantityPackets: line.quantityPackets,
        unitPricePaise: product.selling_price_paise,
        gstRateBps: product.gst_rate_bps,
        lineSubtotalPaise,
        lineTaxPaise: gst.totalTaxPaise,
        lineTotalPaise: gst.totalPaise,
      });
    }

    const now = new Date().toISOString();
    const orderTotal = orderSubtotal + orderTax;

    const oInfo = db
      .prepare(
        `INSERT INTO orders (
           order_number, customer_id, salesman_user_id, order_date, status,
           subtotal_paise, tax_paise, total_paise, notes, created_at, updated_at
         ) VALUES (?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.orderNumber,
        input.customerId,
        input.salesmanUserId,
        input.orderDate,
        orderSubtotal,
        orderTax,
        orderTotal,
        input.notes ?? '',
        now,
        now
      );

    const orderId = Number(oInfo.lastInsertRowid);

    for (const cl of computedLines) {
      db.prepare(
        `INSERT INTO order_items (
           order_id, product_id, quantity_packets, unit_price_paise, gst_rate_bps,
           line_subtotal_paise, line_tax_paise, line_total_paise
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        orderId,
        cl.productId,
        cl.quantityPackets,
        cl.unitPricePaise,
        cl.gstRateBps,
        cl.lineSubtotalPaise,
        cl.lineTaxPaise,
        cl.lineTotalPaise
      );
    }

    logAudit(db, {
      entityType: 'order',
      entityId: orderId,
      action: 'CREATE',
      changedByUserId: input.salesmanUserId,
      after: { orderNumber: input.orderNumber, totalPaise: orderTotal },
      changedAt: now,
    });

    return orderId;
  });
}

export function createAndPostInvoiceFromOrder(
  db: DatabaseSync,
  input: {
    invoiceNumber: string;
    orderId: number;
    userId: number;
  }
): number {
  return runInTransaction(db, () => {
    const order = db
      .prepare(
        `SELECT o.*, c.state AS buyer_state
         FROM orders o
         JOIN customers c ON c.id = o.customer_id
         WHERE o.id = ?`
      )
      .get(input.orderId) as
      | {
          id: number;
          customer_id: number;
          buyer_state: string;
          status: string;
        }
      | undefined;

    if (!order) {
      throw new Error(`Order ${input.orderId} not found`);
    }
    if (order.status === 'CANCELLED' || order.status === 'INVOICED') {
      throw new Error(`Order ${input.orderId} cannot be invoiced in status ${order.status}`);
    }

    const orderItems = db
      .prepare(
        `SELECT oi.*, p.finished_item_id
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`
      )
      .all(order.id) as Array<{
      product_id: number;
      finished_item_id: number;
      quantity_packets: number;
      unit_price_paise: number;
      gst_rate_bps: number;
      line_subtotal_paise: number;
    }>;

    let subtotalPaise = 0;
    let cgstPaise = 0;
    let sgstPaise = 0;
    let igstPaise = 0;

    const lineSplits = orderItems.map((oi) => {
      const split = computeGstSplit(
        oi.line_subtotal_paise,
        oi.gst_rate_bps,
        SELLER_STATE,
        order.buyer_state
      );
      subtotalPaise += split.subtotalPaise;
      cgstPaise += split.cgstPaise;
      sgstPaise += split.sgstPaise;
      igstPaise += split.igstPaise;
      return { ...oi, split };
    });

    const totalPaise = subtotalPaise + cgstPaise + sgstPaise + igstPaise;
    const supplyType =
      order.buyer_state.trim().toLowerCase() === SELLER_STATE.toLowerCase()
        ? 'INTRA_STATE'
        : 'INTER_STATE';
    const now = new Date().toISOString();

    const invInfo = db
      .prepare(
        `INSERT INTO invoices (
           invoice_number, order_id, customer_id, seller_state, buyer_state, supply_type,
           status, subtotal_paise, cgst_paise, sgst_paise, igst_paise, total_paise,
           posted_at, posted_by_user_id, created_by_user_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'POSTED', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.invoiceNumber,
        order.id,
        order.customer_id,
        SELLER_STATE,
        order.buyer_state,
        supplyType,
        subtotalPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        totalPaise,
        now,
        input.userId,
        input.userId,
        now,
        now
      );

    const invoiceId = Number(invInfo.lastInsertRowid);

    for (const ls of lineSplits) {
      db.prepare(
        `INSERT INTO invoice_items (
           invoice_id, product_id, item_id, quantity_packets, unit_price_paise, gst_rate_bps,
           line_subtotal_paise, cgst_paise, sgst_paise, igst_paise, line_total_paise
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        invoiceId,
        ls.product_id,
        ls.finished_item_id,
        ls.quantity_packets,
        ls.unit_price_paise,
        ls.gst_rate_bps,
        ls.split.subtotalPaise,
        ls.split.cgstPaise,
        ls.split.sgstPaise,
        ls.split.igstPaise,
        ls.split.totalPaise
      );

      recordStockMovement(db, {
        itemId: ls.finished_item_id,
        movementType: 'INVOICE_SALE',
        quantityBase: -ls.quantity_packets,
        unitCostPaise: ls.unit_price_paise,
        totalValuePaise: ls.split.subtotalPaise,
        sourceDocType: 'INVOICE',
        sourceDocId: invoiceId,
        createdByUserId: input.userId,
        createdAt: now,
      });
    }

    db.prepare(`UPDATE orders SET status = 'INVOICED', updated_at = ? WHERE id = ?`).run(
      now,
      order.id
    );

    logAudit(db, {
      entityType: 'invoice',
      entityId: invoiceId,
      action: 'POST',
      changedByUserId: input.userId,
      after: {
        invoiceNumber: input.invoiceNumber,
        supplyType,
        subtotalPaise,
        cgstPaise,
        sgstPaise,
        igstPaise,
        totalPaise,
      },
      changedAt: now,
    });

    return invoiceId;
  });
}

export function cancelInvoiceWithCreditNote(
  db: DatabaseSync,
  input: {
    invoiceId: number;
    creditNoteNumber: string;
    reason: string;
    userId: number;
  }
): number {
  if (!input.reason.trim()) {
    throw new Error('Credit note cancellation requires a non-empty reason');
  }

  return runInTransaction(db, () => {
    const invoice = db
      .prepare('SELECT * FROM invoices WHERE id = ?')
      .get(input.invoiceId) as
      | {
          id: number;
          invoice_number: string;
          status: string;
          subtotal_paise: number;
          cgst_paise: number;
          sgst_paise: number;
          igst_paise: number;
          total_paise: number;
        }
      | undefined;

    if (!invoice) {
      throw new Error(`Invoice ${input.invoiceId} not found`);
    }
    if (invoice.status !== 'POSTED') {
      throw new Error(`Only POSTED invoices can be cancelled via credit note; current status is ${invoice.status}`);
    }

    const now = new Date().toISOString();

    const cnInfo = db
      .prepare(
        `INSERT INTO credit_notes (
           credit_note_number, invoice_id, reason,
           subtotal_paise, cgst_paise, sgst_paise, igst_paise, total_paise,
           issued_by_user_id, issued_at, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.creditNoteNumber,
        invoice.id,
        input.reason.trim(),
        invoice.subtotal_paise,
        invoice.cgst_paise,
        invoice.sgst_paise,
        invoice.igst_paise,
        invoice.total_paise,
        input.userId,
        now,
        now
      );

    const creditNoteId = Number(cnInfo.lastInsertRowid);

    const invoiceLines = db
      .prepare('SELECT item_id, quantity_packets, unit_price_paise, line_subtotal_paise FROM invoice_items WHERE invoice_id = ?')
      .all(invoice.id) as Array<{
      item_id: number;
      quantity_packets: number;
      unit_price_paise: number;
      line_subtotal_paise: number;
    }>;

    for (const line of invoiceLines) {
      recordStockMovement(db, {
        itemId: line.item_id,
        movementType: 'CREDIT_NOTE_RETURN',
        quantityBase: line.quantity_packets,
        unitCostPaise: line.unit_price_paise,
        totalValuePaise: line.line_subtotal_paise,
        sourceDocType: 'CREDIT_NOTE',
        sourceDocId: creditNoteId,
        createdByUserId: input.userId,
        createdAt: now,
      });
    }

    db.prepare(
      `UPDATE invoices
       SET status = 'CANCELLED_BY_CREDIT_NOTE', updated_at = ?
       WHERE id = ?`
    ).run(now, invoice.id);

    logAudit(db, {
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'CANCEL_CREDIT_NOTE',
      changedByUserId: input.userId,
      before: { status: invoice.status },
      after: { status: 'CANCELLED_BY_CREDIT_NOTE', creditNoteNumber: input.creditNoteNumber },
      reason: input.reason.trim(),
      changedAt: now,
    });

    return creditNoteId;
  });
}

export function recordPayment(
  db: DatabaseSync,
  input: {
    paymentNumber: string;
    invoiceId: number;
    amountPaise: number;
    paymentMode: 'CASH' | 'UPI' | 'NEFT' | 'RTGS' | 'CHEQUE';
    referenceNo?: string;
    paymentDate: string;
    userId: number;
  }
): number {
  assertSafeIntegerPaise(input.amountPaise, 'amountPaise');
  if (input.amountPaise <= 0) {
    throw new RangeError('Payment amountPaise must be greater than zero');
  }

  return runInTransaction(db, () => {
    const invoice = db
      .prepare('SELECT id, customer_id, status, total_paise FROM invoices WHERE id = ?')
      .get(input.invoiceId) as
      | { id: number; customer_id: number; status: string; total_paise: number }
      | undefined;

    if (!invoice) {
      throw new Error(`Invoice ${input.invoiceId} not found`);
    }
    if (invoice.status !== 'POSTED') {
      throw new Error(`Cannot record payment against invoice with status ${invoice.status}`);
    }

    const paidRow = db
      .prepare('SELECT COALESCE(SUM(amount_paise), 0) AS paid_paise FROM payments WHERE invoice_id = ?')
      .get(invoice.id) as { paid_paise: number };

    const remainingPaise = invoice.total_paise - Number(paidRow.paid_paise);
    if (input.amountPaise > remainingPaise) {
      throw new Error(
        `Payment ${input.amountPaise} paise exceeds remaining invoice balance ${remainingPaise} paise`
      );
    }

    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO payments (
           payment_number, customer_id, invoice_id, amount_paise, payment_mode,
           reference_no, payment_date, recorded_by_user_id, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        input.paymentNumber,
        invoice.customer_id,
        invoice.id,
        input.amountPaise,
        input.paymentMode,
        input.referenceNo ?? '',
        input.paymentDate,
        input.userId,
        now,
        now
      );

    const paymentId = Number(info.lastInsertRowid);
    logAudit(db, {
      entityType: 'payment',
      entityId: paymentId,
      action: 'CREATE',
      changedByUserId: input.userId,
      after: {
        paymentNumber: input.paymentNumber,
        invoiceId: invoice.id,
        amountPaise: input.amountPaise,
        paymentMode: input.paymentMode,
      },
      changedAt: now,
    });

    return paymentId;
  });
}

export function updateCustomerWithAudit(
  db: DatabaseSync,
  input: {
    customerId: number;
    gstin?: string;
    billingAddress?: string;
    userId: number;
    reason: string;
  }
): void {
  runInTransaction(db, () => {
    const existing = db
      .prepare('SELECT * FROM customers WHERE id = ?')
      .get(input.customerId) as
      | { id: number; gstin: string; billing_address: string }
      | undefined;
    if (!existing) {
      throw new Error(`Customer ${input.customerId} not found`);
    }

    const nextGstin = input.gstin ?? existing.gstin;
    const nextAddress = input.billingAddress ?? existing.billing_address;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE customers
       SET gstin = ?, billing_address = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextGstin, nextAddress, now, existing.id);

    logAudit(db, {
      entityType: 'customer',
      entityId: existing.id,
      action: 'UPDATE',
      changedByUserId: input.userId,
      before: { gstin: existing.gstin, billingAddress: existing.billing_address },
      after: { gstin: nextGstin, billingAddress: nextAddress },
      reason: input.reason,
      changedAt: now,
    });
  });
}
