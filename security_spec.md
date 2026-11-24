# Order-to-Audit Firestore Security Specification

## Data Invariants
1. No document may contain unvalidated shadow keys (`keys().hasOnly(...)` enforced on create and `affectedKeys().hasOnly(...)` on update).
2. `stockMovements` and `auditLogs` are strictly append-only (`update` and `delete` permanently denied).
3. `invoices` cannot be deleted; a `POSTED` invoice may only transition to `CANCELLED_BY_CREDIT_NOTE` by an admin/accountant.
4. All monetary values (`standardCostPaise`, `subtotalPaise`, `taxPaise`, `totalPaise`) are integers (`is int`), never floats.
5. Users cannot self-escalate their `role` or `isActive` fields.
6. Only verified emails (`request.auth.token.email_verified == true`) are permitted to perform writes.
