import type { DatabaseSync } from 'node:sqlite';

export function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uid TEXT UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('salesman', 'admin', 'production', 'accountant', 'owner')),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    -- Stock is NEVER stored on items. Balances are calculated strictly from stock_movements.
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      item_type TEXT NOT NULL CHECK (item_type IN ('raw_material', 'packaging', 'finished_good')),
      base_unit TEXT NOT NULL CHECK (base_unit IN ('g', 'ml', 'piece', 'packet')),
      standard_cost_paise INTEGER NOT NULL DEFAULT 0 CHECK (standard_cost_paise >= 0),
      cost_unit TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS unit_conversions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
      from_unit TEXT NOT NULL,
      to_unit TEXT NOT NULL,
      factor_numerator INTEGER NOT NULL CHECK (factor_numerator > 0),
      factor_denominator INTEGER NOT NULL CHECK (factor_denominator > 0),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      UNIQUE (item_id, from_unit, to_unit)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      customer_type TEXT NOT NULL CHECK (customer_type IN ('retailer', 'distributor', 'wholesaler')),
      state TEXT NOT NULL,
      state_code TEXT NOT NULL,
      gstin TEXT NOT NULL,
      billing_address TEXT NOT NULL,
      salesman_user_id INTEGER NOT NULL REFERENCES users(id),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      finished_item_id INTEGER NOT NULL UNIQUE REFERENCES items(id),
      hsn_code TEXT NOT NULL,
      selling_price_paise INTEGER NOT NULL CHECK (selling_price_paise >= 0),
      gst_rate_bps INTEGER NOT NULL CHECK (gst_rate_bps >= 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS boms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id),
      version INTEGER NOT NULL DEFAULT 1,
      batch_code TEXT NOT NULL UNIQUE,
      expected_yield_packets INTEGER NOT NULL CHECK (expected_yield_packets > 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS bom_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bom_id INTEGER NOT NULL REFERENCES boms(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id),
      quantity_base INTEGER NOT NULL CHECK (quantity_base > 0),
      display_quantity TEXT NOT NULL,
      display_unit TEXT NOT NULL,
      UNIQUE (bom_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_number TEXT NOT NULL UNIQUE,
      supplier_name TEXT NOT NULL,
      supplier_gstin TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED')),
      subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_paise >= 0),
      tax_paise INTEGER NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
      total_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_paise >= 0),
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      posted_by_user_id INTEGER REFERENCES users(id),
      posted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      item_id INTEGER NOT NULL REFERENCES items(id),
      quantity_base INTEGER NOT NULL CHECK (quantity_base > 0),
      input_quantity TEXT NOT NULL,
      input_unit TEXT NOT NULL,
      unit_cost_paise INTEGER NOT NULL CHECK (unit_cost_paise >= 0),
      line_total_paise INTEGER NOT NULL CHECK (line_total_paise >= 0)
    );

    CREATE TABLE IF NOT EXISTS production_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_number TEXT NOT NULL UNIQUE,
      bom_id INTEGER NOT NULL REFERENCES boms(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      batches_count INTEGER NOT NULL CHECK (batches_count > 0),
      expected_yield_packets INTEGER NOT NULL CHECK (expected_yield_packets > 0),
      actual_yield_packets INTEGER CHECK (actual_yield_packets IS NULL OR actual_yield_packets >= 0),
      status TEXT NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
      started_at TEXT,
      completed_at TEXT,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      completed_by_user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      salesman_user_id INTEGER NOT NULL REFERENCES users(id),
      order_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'DISPATCHED', 'INVOICED', 'CANCELLED')),
      subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_paise >= 0),
      tax_paise INTEGER NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
      total_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_paise >= 0),
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_packets INTEGER NOT NULL CHECK (quantity_packets > 0),
      unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
      gst_rate_bps INTEGER NOT NULL CHECK (gst_rate_bps >= 0),
      line_subtotal_paise INTEGER NOT NULL CHECK (line_subtotal_paise >= 0),
      line_tax_paise INTEGER NOT NULL CHECK (line_tax_paise >= 0),
      line_total_paise INTEGER NOT NULL CHECK (line_total_paise >= 0)
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      order_id INTEGER REFERENCES orders(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      seller_state TEXT NOT NULL DEFAULT 'Tamil Nadu',
      buyer_state TEXT NOT NULL,
      supply_type TEXT NOT NULL CHECK (supply_type IN ('INTRA_STATE', 'INTER_STATE')),
      status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'POSTED', 'CANCELLED_BY_CREDIT_NOTE')),
      subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_paise >= 0),
      cgst_paise INTEGER NOT NULL DEFAULT 0 CHECK (cgst_paise >= 0),
      sgst_paise INTEGER NOT NULL DEFAULT 0 CHECK (sgst_paise >= 0),
      igst_paise INTEGER NOT NULL DEFAULT 0 CHECK (igst_paise >= 0),
      total_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_paise >= 0),
      posted_at TEXT,
      posted_by_user_id INTEGER REFERENCES users(id),
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      item_id INTEGER NOT NULL REFERENCES items(id),
      quantity_packets INTEGER NOT NULL CHECK (quantity_packets > 0),
      unit_price_paise INTEGER NOT NULL CHECK (unit_price_paise >= 0),
      gst_rate_bps INTEGER NOT NULL CHECK (gst_rate_bps >= 0),
      line_subtotal_paise INTEGER NOT NULL CHECK (line_subtotal_paise >= 0),
      cgst_paise INTEGER NOT NULL CHECK (cgst_paise >= 0),
      sgst_paise INTEGER NOT NULL CHECK (sgst_paise >= 0),
      igst_paise INTEGER NOT NULL CHECK (igst_paise >= 0),
      line_total_paise INTEGER NOT NULL CHECK (line_total_paise >= 0)
    );

    CREATE TABLE IF NOT EXISTS credit_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credit_note_number TEXT NOT NULL UNIQUE,
      invoice_id INTEGER NOT NULL UNIQUE REFERENCES invoices(id),
      reason TEXT NOT NULL,
      subtotal_paise INTEGER NOT NULL CHECK (subtotal_paise >= 0),
      cgst_paise INTEGER NOT NULL CHECK (cgst_paise >= 0),
      sgst_paise INTEGER NOT NULL CHECK (sgst_paise >= 0),
      igst_paise INTEGER NOT NULL CHECK (igst_paise >= 0),
      total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
      issued_by_user_id INTEGER NOT NULL REFERENCES users(id),
      issued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_number TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      invoice_id INTEGER NOT NULL REFERENCES invoices(id),
      amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
      payment_mode TEXT NOT NULL CHECK (payment_mode IN ('CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE')),
      reference_no TEXT NOT NULL DEFAULT '',
      payment_date TEXT NOT NULL,
      recorded_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES items(id),
      movement_type TEXT NOT NULL CHECK (
        movement_type IN (
          'OPENING_BALANCE',
          'PURCHASE_RECEIPT',
          'PRODUCTION_CONSUME',
          'PRODUCTION_OUTPUT',
          'ORDER_DISPATCH',
          'INVOICE_SALE',
          'CREDIT_NOTE_RETURN',
          'ADJUSTMENT_IN',
          'ADJUSTMENT_OUT'
        )
      ),
      quantity_base INTEGER NOT NULL CHECK (quantity_base != 0),
      unit_cost_paise INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_paise >= 0),
      total_value_paise INTEGER NOT NULL DEFAULT 0 CHECK (total_value_paise >= 0),
      source_doc_type TEXT NOT NULL,
      source_doc_id INTEGER NOT NULL,
      created_by_user_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      changed_by_user_id INTEGER NOT NULL REFERENCES users(id),
      changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      before_json TEXT,
      after_json TEXT,
      reason TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX IF NOT EXISTS idx_stock_movements_item_id ON stock_movements(item_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_source ON stock_movements(source_doc_type, source_doc_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, changed_at);
    CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, status);

    -- Enforce append-only StockMovement ledger
    CREATE TRIGGER IF NOT EXISTS trg_stock_movements_no_update
    BEFORE UPDATE ON stock_movements
    BEGIN
      SELECT RAISE(ABORT, 'stock_movements is append-only and cannot be updated');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_stock_movements_no_delete
    BEFORE DELETE ON stock_movements
    BEGIN
      SELECT RAISE(ABORT, 'stock_movements is append-only and cannot be deleted');
    END;

    -- Enforce invoice non-deletion and posted invoice immutability (must cancel via credit note)
    CREATE TRIGGER IF NOT EXISTS trg_invoices_no_delete
    BEFORE DELETE ON invoices
    BEGIN
      SELECT RAISE(ABORT, 'Invoices cannot be deleted; posted invoices must be cancelled with a credit note');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_invoices_posted_immutable
    BEFORE UPDATE ON invoices
    WHEN OLD.status = 'POSTED' AND (
      NEW.status != 'CANCELLED_BY_CREDIT_NOTE'
      OR NEW.subtotal_paise != OLD.subtotal_paise
      OR NEW.cgst_paise != OLD.cgst_paise
      OR NEW.sgst_paise != OLD.sgst_paise
      OR NEW.igst_paise != OLD.igst_paise
      OR NEW.total_paise != OLD.total_paise
      OR NEW.customer_id != OLD.customer_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'Posted invoices are immutable; issue a credit note to cancel');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_invoices_cancelled_immutable
    BEFORE UPDATE ON invoices
    WHEN OLD.status = 'CANCELLED_BY_CREDIT_NOTE'
    BEGIN
      SELECT RAISE(ABORT, 'Cancelled invoices cannot be modified');
    END;

    -- Enforce append-only AuditLog
    CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'audit_logs is append-only and cannot be updated');
    END;

    CREATE TRIGGER IF NOT EXISTS trg_audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    BEGIN
      SELECT RAISE(ABORT, 'audit_logs is append-only and cannot be deleted');
    END;
  `);
}
