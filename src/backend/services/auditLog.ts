import type { DatabaseSync } from 'node:sqlite';

export interface AuditLogInput {
  entityType: string;
  entityId: number;
  action: string;
  changedByUserId: number;
  before?: unknown;
  after?: unknown;
  reason?: string;
  changedAt?: string;
}

export function logAudit(db: DatabaseSync, input: AuditLogInput): number {
  const timestamp = input.changedAt ?? new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO audit_logs (
       entity_type, entity_id, action, changed_by_user_id, changed_at, before_json, after_json, reason
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const info = stmt.run(
    input.entityType,
    input.entityId,
    input.action,
    input.changedByUserId,
    timestamp,
    input.before !== undefined ? JSON.stringify(input.before) : null,
    input.after !== undefined ? JSON.stringify(input.after) : null,
    input.reason ?? ''
  );

  return Number(info.lastInsertRowid);
}

export function getAuditTrail(
  db: DatabaseSync,
  entityType?: string,
  entityId?: number
) {
  if (entityType && entityId !== undefined) {
    return db
      .prepare(
        `SELECT a.*, u.name AS changed_by_name, u.role AS changed_by_role
         FROM audit_logs a
         JOIN users u ON u.id = a.changed_by_user_id
         WHERE a.entity_type = ? AND a.entity_id = ?
         ORDER BY a.id ASC`
      )
      .all(entityType, entityId);
  }

  return db
    .prepare(
      `SELECT a.*, u.name AS changed_by_name, u.role AS changed_by_role
       FROM audit_logs a
       JOIN users u ON u.id = a.changed_by_user_id
       ORDER BY a.id DESC
       LIMIT 200`
    )
    .all();
}
