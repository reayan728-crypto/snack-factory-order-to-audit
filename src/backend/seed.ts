import type { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { closeDb, getDb, runInTransaction } from './db/connection.ts';
import { initializeSchema } from './db/schema.ts';
import { logAudit } from './services/auditLog.ts';
import { rupeesToPaise } from './services/money.ts';
import { getAllItemBalances, recordStockMovement } from './services/stockLedger.ts';
import { convertToBaseUnitDb } from './services/unitConversion.ts';

export interface SeedSummary {
  users: Record<string, number>;
  items: Record<string, number>;
  customers: Record<string, number>;
  productId: number;
  bomId: number;
}

export function seedDatabase(db: DatabaseSync): SeedSummary {
  initializeSchema(db);

  const existing = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  if (Number(existing.cnt) > 0) {
    // Already seeded; return existing IDs idempotently.
    const usersRows = db.prepare('SELECT id, email FROM users').all() as Array<{ id: number; email: string }>;
    const itemRows = db.prepare('SELECT id, sku FROM items').all() as Array<{ id: number; sku: string }>;
    const custRows = db.prepare('SELECT id, code FROM customers').all() as Array<{ id: number; code: string }>;
    const prod = db.prepare("SELECT id FROM products WHERE sku = 'FG-MUR-200'").get() as { id: number };
    const bom = db.prepare("SELECT id FROM boms WHERE batch_code = 'BOM-MUR-200-V1'").get() as { id: number };

    return {
      users: Object.fromEntries(usersRows.map((u) => [u.email, u.id])),
      items: Object.fromEntries(itemRows.map((i) => [i.sku, i.id])),
      customers: Object.fromEntries(custRows.map((c) => [c.code, c.id])),
      productId: prod.id,
      bomId: bom.id,
    };
  }

  return runInTransaction(db, () => {
    const now = '2026-11-24T04:00:00.000Z';
    const unclaimedCredential = '!UNCLAIMED!';

    // 1. Users across required roles
    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const adminId = Number(
      insertUser.run('Admin User', 'admin@kaviyasnacks.in', unclaimedCredential, 'admin', now, now).lastInsertRowid
    );
    const productionId = Number(
      insertUser.run('Production Supervisor', 'production@kaviyasnacks.in', unclaimedCredential, 'production', now, now).lastInsertRowid
    );
    const salesmanAId = Number(
      insertUser.run('Salesman A', 'salesman.a@kaviyasnacks.in', unclaimedCredential, 'salesman', now, now).lastInsertRowid
    );
    const salesmanBId = Number(
      insertUser.run('Salesman B', 'salesman.b@kaviyasnacks.in', unclaimedCredential, 'salesman', now, now).lastInsertRowid
    );
    const accountantId = Number(
      insertUser.run('Accountant User', 'accounts@kaviyasnacks.in', unclaimedCredential, 'accountant', now, now).lastInsertRowid
    );
    const ownerId = Number(
      insertUser.run('Plant Owner', 'owner@kaviyasnacks.in', unclaimedCredential, 'owner', now, now).lastInsertRowid
    );

    // 2. Items (no stock balance column—stock lives strictly in stock_movements)
    const insertItem = db.prepare(
      `INSERT INTO items (sku, name, item_type, base_unit, standard_cost_paise, cost_unit, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const flourId = Number(
      insertItem.run('RM-FLOUR', 'Rice & Besan Flour Blend', 'raw_material', 'g', rupeesToPaise(42), 'kg', now, now).lastInsertRowid
    );
    const oilId = Number(
      insertItem.run('RM-OIL', 'Cooking Oil', 'raw_material', 'ml', rupeesToPaise(140), 'litre', now, now).lastInsertRowid
    );
    const spiceId = Number(
      insertItem.run('RM-SPICE', 'Salt and Spice Mix', 'raw_material', 'g', rupeesToPaise(200), 'kg', now, now).lastInsertRowid
    );
    const pouchId = Number(
      insertItem.run('PKG-POUCH-200', '200 g Pouch', 'packaging', 'piece', rupeesToPaise('2.50'), 'piece', now, now).lastInsertRowid
    );
    const cartonId = Number(
      insertItem.run('PKG-CARTON', 'Carton', 'packaging', 'piece', rupeesToPaise(15), 'piece', now, now).lastInsertRowid
    );
    const murukkuItemId = Number(
      insertItem.run('FG-MUR-200', 'Murukku 200 g', 'finished_good', 'packet', rupeesToPaise(50), 'packet', now, now).lastInsertRowid
    );

    // 3. Global and item-specific unit conversions
    const insertConv = db.prepare(
      `INSERT INTO unit_conversions (item_id, from_unit, to_unit, factor_numerator, factor_denominator, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    insertConv.run(null, 'kg', 'g', 1000, 1, now);
    insertConv.run(null, 'g', 'kg', 1, 1000, now);
    insertConv.run(null, 'litre', 'ml', 1000, 1, now);
    insertConv.run(null, 'ml', 'litre', 1, 1000, now);
    insertConv.run(null, 'piece', 'piece', 1, 1, now);
    insertConv.run(null, 'packet', 'packet', 1, 1, now);
    insertConv.run(murukkuItemId, 'carton', 'packet', 20, 1, now);
    insertConv.run(murukkuItemId, 'packet', 'carton', 1, 20, now);

    // 4. Product: Murukku 200 g, Rs 50 before tax, GST 5% (500 bps)
    const productId = Number(
      db
        .prepare(
          `INSERT INTO products (sku, name, finished_item_id, hsn_code, selling_price_paise, gst_rate_bps, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run('FG-MUR-200', 'Murukku 200 g', murukkuItemId, '21069099', rupeesToPaise(50), 500, now, now)
        .lastInsertRowid
    );

    // 5. BOM: 1 batch = 200 packets
    const bomId = Number(
      db
        .prepare(
          `INSERT INTO boms (product_id, version, batch_code, expected_yield_packets, created_by_user_id, created_at, updated_at)
           VALUES (?, 1, 'BOM-MUR-200-V1', 200, ?, ?, ?)`
        )
        .run(productId, productionId, now, now).lastInsertRowid
    );

    const insertBomItem = db.prepare(
      `INSERT INTO bom_items (bom_id, item_id, quantity_base, display_quantity, display_unit)
       VALUES (?, ?, ?, ?, ?)`
    );

    const bomSpecs: Array<{ itemId: number; qty: string; unit: string }> = [
      { itemId: flourId, qty: '40', unit: 'kg' },
      { itemId: oilId, qty: '10', unit: 'litre' },
      { itemId: spiceId, qty: '1.2', unit: 'kg' },
      { itemId: pouchId, qty: '200', unit: 'piece' },
      { itemId: cartonId, qty: '10', unit: 'piece' },
    ];

    for (const spec of bomSpecs) {
      const { quantityBase } = convertToBaseUnitDb(db, spec.itemId, spec.qty, spec.unit);
      insertBomItem.run(bomId, spec.itemId, quantityBase, spec.qty, spec.unit);
    }

    // 6. Customers: Retailer A (Tamil Nadu) & Distributor B (Karnataka)
    const insertCust = db.prepare(
      `INSERT INTO customers (code, name, customer_type, state, state_code, gstin, billing_address, salesman_user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const retailerAId = Number(
      insertCust.run(
        'CUST-RET-A',
        'Retailer A',
        'retailer',
        'Tamil Nadu',
        '33',
        '33AABCR1234A1Z5',
        '14 Gandhipuram Cross Cut Road, Coimbatore, Tamil Nadu 641012',
        salesmanAId,
        now,
        now
      ).lastInsertRowid
    );

    const distributorBId = Number(
      insertCust.run(
        'CUST-DIST-B',
        'Distributor B',
        'distributor',
        'Karnataka',
        '29',
        '29AABCD5678B1Z2',
        '88 Peenya Industrial Area Phase 2, Bengaluru, Karnataka 560058',
        salesmanBId,
        now,
        now
      ).lastInsertRowid
    );

    // 7. Opening stock recorded exclusively via StockMovement ledger rows
    const openingEntries: Array<{
      itemId: number;
      qty: string;
      unit: string;
      totalValuePaise: number;
    }> = [
      { itemId: flourId, qty: '100', unit: 'kg', totalValuePaise: 100 * rupeesToPaise(42) },
      { itemId: oilId, qty: '30', unit: 'litre', totalValuePaise: 30 * rupeesToPaise(140) },
      { itemId: spiceId, qty: '5', unit: 'kg', totalValuePaise: 5 * rupeesToPaise(200) },
      { itemId: pouchId, qty: '500', unit: 'piece', totalValuePaise: 500 * rupeesToPaise('2.50') },
      { itemId: cartonId, qty: '30', unit: 'piece', totalValuePaise: 30 * rupeesToPaise(15) },
      { itemId: murukkuItemId, qty: '50', unit: 'packet', totalValuePaise: 50 * rupeesToPaise(50) },
    ];

    for (const entry of openingEntries) {
      const { quantityBase } = convertToBaseUnitDb(db, entry.itemId, entry.qty, entry.unit);
      const unitCostPaise = Math.round(entry.totalValuePaise / quantityBase);
      recordStockMovement(db, {
        itemId: entry.itemId,
        movementType: 'OPENING_BALANCE',
        quantityBase,
        unitCostPaise,
        totalValuePaise: entry.totalValuePaise,
        sourceDocType: 'OPENING',
        sourceDocId: entry.itemId,
        createdByUserId: adminId,
        createdAt: now,
      });
    }

    logAudit(db, {
      entityType: 'seed',
      entityId: 1,
      action: 'CREATE',
      changedByUserId: adminId,
      after: {
        bomCode: 'BOM-MUR-200-V1',
        openingStockItems: openingEntries.length,
      },
      reason: 'Initial opening stock and master data seed',
      changedAt: now,
    });

    return {
      users: {
        'admin@kaviyasnacks.in': adminId,
        'production@kaviyasnacks.in': productionId,
        'salesman.a@kaviyasnacks.in': salesmanAId,
        'salesman.b@kaviyasnacks.in': salesmanBId,
        'accounts@kaviyasnacks.in': accountantId,
        'owner@kaviyasnacks.in': ownerId,
      },
      items: {
        'RM-FLOUR': flourId,
        'RM-OIL': oilId,
        'RM-SPICE': spiceId,
        'PKG-POUCH-200': pouchId,
        'PKG-CARTON': cartonId,
        'FG-MUR-200': murukkuItemId,
      },
      customers: {
        'CUST-RET-A': retailerAId,
        'CUST-DIST-B': distributorBId,
      },
      productId,
      bomId,
    };
  });
}

// Allow direct execution via `npm run seed`
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const db = getDb();
  const summary = seedDatabase(db);
  const balances = getAllItemBalances(db);
  console.log('Seed completed successfully:', {
    productId: summary.productId,
    bomId: summary.bomId,
    balances: balances.map((b) => `${b.sku}: ${b.balanceBase} ${b.baseUnit}`),
  });
  closeDb();
}
