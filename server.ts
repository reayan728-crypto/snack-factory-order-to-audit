import 'dotenv/config';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { getDb } from './src/backend/db/connection.ts';
import { initializeSchema } from './src/backend/db/schema.ts';
import {
  type AuthRequest,
  hashUserPassword,
  issueSessionToken,
  requireAuth,
  requireRole,
  verifyUserPassword,
} from './src/backend/middleware/auth.ts';
import { seedDatabase } from './src/backend/seed.ts';
import { getAuditTrail } from './src/backend/services/auditLog.ts';
import {
  cancelInvoiceWithCreditNote,
  completeProductionRun,
  createAndPostInvoiceFromOrder,
  createAndPostPurchase,
  createOrder,
  createProductionRun,
  recordPayment,
  updateCustomerWithAudit,
} from './src/backend/services/orderToAudit.ts';
import {
  getAllItemBalances,
  getItemBalance,
  getItemMovementLedger,
} from './src/backend/services/stockLedger.ts';

function ensureDbReady() {
  const db = getDb();
  initializeSchema(db);
  return db;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  // One-time admin/user password claim when account is still unclaimed
  app.post('/api/auth/claim', (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string' || password.length < 8) {
        res.status(400).json({ error: 'Valid email and password (min 8 chars) required' });
        return;
      }

      const db = ensureDbReady();
      const user = db
        .prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?')
        .get(email.trim().toLowerCase()) as
        | { id: number; email: string; name: string; role: 'salesman' | 'admin' | 'production' | 'accountant' | 'owner'; password_hash: string }
        | undefined;

      if (!user) {
        res.status(404).json({ error: 'Account not found' });
        return;
      }
      if (user.password_hash !== '!UNCLAIMED!') {
        res.status(409).json({ error: 'Account password is already claimed' });
        return;
      }

      const nextHash = hashUserPassword(password);
      db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
        nextHash,
        new Date().toISOString(),
        user.id
      );

      const token = issueSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      console.error('Claim error:', error);
      res.status(500).json({ error: 'Failed to claim account' });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};
      if (typeof email !== 'string' || typeof password !== 'string') {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      const db = ensureDbReady();
      const user = db
        .prepare('SELECT id, email, name, role, password_hash, is_active FROM users WHERE email = ?')
        .get(email.trim().toLowerCase()) as
        | {
            id: number;
            email: string;
            name: string;
            role: 'salesman' | 'admin' | 'production' | 'accountant' | 'owner';
            password_hash: string;
            is_active: number;
          }
        | undefined;

      if (!user || user.is_active !== 1 || !verifyUserPassword(password, user.password_hash)) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const token = issueSessionToken({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Inventory balances calculated strictly from StockMovement ledger
  app.get('/api/stock/balances', requireAuth, (_req: AuthRequest, res: Response) => {
    try {
      const db = ensureDbReady();
      res.json({ balances: getAllItemBalances(db) });
    } catch (error) {
      console.error('Stock balances error:', error);
      res.status(500).json({ error: 'Failed to compute stock balances' });
    }
  });

  app.get('/api/stock/items/:itemId/ledger', requireAuth, (req: AuthRequest, res: Response) => {
    try {
      const itemId = Number(req.params.itemId);
      if (!Number.isSafeInteger(itemId) || itemId <= 0) {
        res.status(400).json({ error: 'Invalid itemId' });
        return;
      }
      const db = ensureDbReady();
      const balance = getItemBalance(db, itemId);
      const movements = getItemMovementLedger(db, itemId);
      res.json({ balance, movements });
    } catch (error) {
      console.error('Item ledger error:', error);
      res.status(500).json({ error: 'Failed to retrieve item stock ledger' });
    }
  });

  app.post(
    '/api/purchases',
    requireAuth,
    requireRole('admin', 'owner', 'accountant', 'production'),
    (req: AuthRequest, res: Response) => {
      try {
        const db = ensureDbReady();
        const purchaseId = createAndPostPurchase(db, {
          ...req.body,
          userId: req.authUser!.id,
        });
        res.status(201).json({ purchaseId });
      } catch (error) {
        console.error('Create purchase error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Purchase failed' });
      }
    }
  );

  app.post(
    '/api/production-runs',
    requireAuth,
    requireRole('production', 'admin', 'owner'),
    (req: AuthRequest, res: Response) => {
      try {
        const db = ensureDbReady();
        const runId = createProductionRun(db, {
          ...req.body,
          userId: req.authUser!.id,
        });
        res.status(201).json({ runId });
      } catch (error) {
        console.error('Create production run error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Production run failed' });
      }
    }
  );

  app.post(
    '/api/production-runs/:runId/complete',
    requireAuth,
    requireRole('production', 'admin', 'owner'),
    (req: AuthRequest, res: Response) => {
      try {
        const runId = Number(req.params.runId);
        const actualYieldPackets = Number(req.body?.actualYieldPackets);
        const db = ensureDbReady();
        completeProductionRun(db, runId, actualYieldPackets, req.authUser!.id);
        res.json({ status: 'COMPLETED', runId });
      } catch (error) {
        console.error('Complete production run error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Completion failed' });
      }
    }
  );

  app.post(
    '/api/orders',
    requireAuth,
    requireRole('salesman', 'admin', 'owner'),
    (req: AuthRequest, res: Response) => {
      try {
        const db = ensureDbReady();
        const orderId = createOrder(db, {
          ...req.body,
          salesmanUserId: req.authUser!.id,
        });
        res.status(201).json({ orderId });
      } catch (error) {
        console.error('Create order error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Order failed' });
      }
    }
  );

  app.post(
    '/api/invoices',
    requireAuth,
    requireRole('accountant', 'admin', 'owner'),
    (req: AuthRequest, res: Response) => {
      try {
        const db = ensureDbReady();
        const invoiceId = createAndPostInvoiceFromOrder(db, {
          invoiceNumber: req.body?.invoiceNumber,
          orderId: Number(req.body?.orderId),
          userId: req.authUser!.id,
        });
        res.status(201).json({ invoiceId });
      } catch (error) {
        console.error('Post invoice error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Invoice posting failed' });
      }
    }
  );

  app.post(
    '/api/invoices/:invoiceId/credit-note',
    requireAuth,
    requireRole('accountant', 'admin', 'owner'),
    (req: AuthRequest, res: Response) => {
      try {
        const invoiceId = Number(req.params.invoiceId);
        const db = ensureDbReady();
        const creditNoteId = cancelInvoiceWithCreditNote(db, {
          invoiceId,
          creditNoteNumber: req.body?.creditNoteNumber,
          reason: req.body?.reason,
          userId: req.authUser!.id,
        });
        res.status(201).json({ creditNoteId });
      } catch (error) {
        console.error('Credit note error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Credit note failed' });
      }
    }
  );

  app.post(
    '/api/payments',
    requireAuth,
    requireRole('accountant', 'admin', 'owner'),
    (req: AuthRequest, res: Response) => {
      try {
        const db = ensureDbReady();
        const paymentId = recordPayment(db, {
          ...req.body,
          invoiceId: Number(req.body?.invoiceId),
          amountPaise: Number(req.body?.amountPaise),
          userId: req.authUser!.id,
        });
        res.status(201).json({ paymentId });
      } catch (error) {
        console.error('Payment error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Payment failed' });
      }
    }
  );

  app.patch(
    '/api/customers/:customerId',
    requireAuth,
    requireRole('admin', 'owner', 'accountant'),
    (req: AuthRequest, res: Response) => {
      try {
        const customerId = Number(req.params.customerId);
        const db = ensureDbReady();
        updateCustomerWithAudit(db, {
          customerId,
          gstin: req.body?.gstin,
          billingAddress: req.body?.billingAddress,
          reason: req.body?.reason ?? 'Customer record edit',
          userId: req.authUser!.id,
        });
        res.json({ updated: true, customerId });
      } catch (error) {
        console.error('Customer update error:', error);
        res.status(400).json({ error: error instanceof Error ? error.message : 'Customer update failed' });
      }
    }
  );

  app.get(
    '/api/audit-logs',
    requireAuth,
    requireRole('admin', 'owner', 'accountant'),
    (req: AuthRequest, res: Response) => {
      try {
        const db = ensureDbReady();
        const entityType =
          typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
        const entityId =
          typeof req.query.entityId === 'string' ? Number(req.query.entityId) : undefined;
        res.json({ logs: getAuditTrail(db, entityType, entityId) });
      } catch (error) {
        console.error('Audit trail error:', error);
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
      }
    }
  );

  app.post(
    '/api/admin/seed',
    requireAuth,
    requireRole('admin', 'owner'),
    (_req: AuthRequest, res: Response) => {
      try {
        const db = ensureDbReady();
        const summary = seedDatabase(db);
        res.json({ summary });
      } catch (error) {
        console.error('Seed error:', error);
        res.status(500).json({ error: 'Seed failed' });
      }
    }
  );

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Order-to-Audit backend server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
