# Policy v2: Unified Effect Model + Approval Flow

> **Status: Design draft.** Not yet implemented.

## Motivation

The current system has three separate mechanisms for controlling what happens when a principal tries to use a resource:

1. **`autonomy_level`** in SecurityPolicy — `readonly | supervised | full`. When `readonly`, a hardcoded `READONLY_BLOCKED_TOOLS` set blocks 24 write tools at the `execute()` entry point.
2. **`require_approval_for`** in SecurityPolicy — a `string[]` of tool names. In `supervised` mode, matching tools trigger an in-session approval prompt before execution.
3. **Policy grants** in `agent_policies` — per-resource grant-based access control determining **who** can access **what**.

These overlap:

- `readonly` is semantically "deny all roles on write tools" — expressible as policy rows.
- `require_approval_for: ['exec']` is semantically "require approval for exec from non-owner" — expressible as a policy effect.
- Grants control access but have no middle ground between allow and deny — no "ask first" option.

Additionally, when a non-owner user is denied, the only recourse is to manually ask the owner to run `policy_set` via a separate conversation. There is no structured approval flow.

## Design

### 1. Add `effect` to PolicyRow

```ts
interface PolicyRow {
  agentId: string;
  resourceType: string;        // tool | file | exec | mcp
  resourceKey: string;
  effect: 'allow' | 'deny' | 'require_approval';   // NEW
  grants: Grant[];             // who this rule targets
  scope: Record<string, unknown>;
}
```

Semantics:

- `effect: 'allow'` — principals matching grants are **permitted**. (Current behavior.)
- `effect: 'deny'` — principals matching grants are **blocked**. Explicit deny always wins.
- `effect: 'require_approval'` — principals matching grants must **request approval** before the operation proceeds.

### 2. Evaluation order

When resolving access for a principal against matched policy rows:

```
1. If any matched row has effect='deny' and principal matches its grants → DENY
2. If any matched row has effect='require_approval' and principal matches its grants → REQUIRE_APPROVAL
3. If any matched row has effect='allow' and principal matches its grants → ALLOW
4. Otherwise → fall back to default policy (see section 3)
```

Deny always wins, then require_approval, then allow. This follows AWS IAM precedent and prevents accidental privilege escalation.

### 3. Default policy configuration

New field in SecurityPolicy:

```ts
interface SecurityPolicy {
  // ... existing fields ...
  policy_default?: 'allow' | 'deny';   // default: 'allow' (backward compatible)
}
```

When no policy rows match a resource:

- `policy_default: 'allow'` — current behavior, no rows = permitted (tool-level defaultGrants apply).
- `policy_default: 'deny'` — no rows = denied. Every resource must be explicitly allowed.

### 4. Deprecate overlapping SecurityPolicy fields

| Current field | Replaced by | Migration |
|---------------|-------------|-----------|
| `autonomy_level: 'readonly'` | `effect: 'deny'` rows on write tools for `grants: [{type:'any'}]` | Auto-generate deny rows on load, or keep as syntactic sugar that generates virtual rows |
| `autonomy_level: 'supervised'` + `require_approval_for` | `effect: 'require_approval'` rows on specific tools | Same approach |
| `autonomy_level: 'full'` | No deny/require_approval rows exist | Default state |

The `READONLY_BLOCKED_TOOLS` hardcoded set and `ensureAutonomyAllows()` function can be removed once the effect model is in place.

**Migration strategy**: Keep `autonomy_level` and `require_approval_for` as optional sugar in SecurityPolicy. On load, synthesize virtual PolicyRows from them (not persisted to DB). Real DB rows take precedence. This way existing configs keep working without migration.

### 5. Approval flow

#### ApprovalRequest storage

```ts
interface ApprovalRequest {
  id: string;
  agentId: string;
  sessionId: string;              // session that triggered the request
  requesterId: string;            // userId who triggered the request
  resourceType: string;           // tool | file | exec | mcp
  resourceKey: string;
  scope: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  resolution?: 'once' | 'persistent';
  createdAt: string;
  resolvedAt?: string;
  ttlMinutes: number;
}
```

Schema (new table):

```sql
CREATE TABLE approval_requests (
  id            TEXT PRIMARY KEY,
  agent_id      TEXT NOT NULL REFERENCES agents(id),
  session_id    TEXT NOT NULL,
  requester_id  TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_key  TEXT NOT NULL,
  scope         JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending',
  resolution    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ,
  ttl_minutes   INTEGER NOT NULL DEFAULT 60
);

CREATE INDEX idx_approval_requests_agent ON approval_requests (agent_id, status);
```

#### Notification

New SecurityPolicy field:

```ts
interface SecurityPolicy {
  // ... existing fields ...
  approval_notify_session?: string;   // session ID where owner receives approval requests
  approval_ttl_minutes?: number;      // default: 60
}
```

When an operation triggers `require_approval`:

1. Create an ApprovalRequest (status: `pending`).
2. If `approval_notify_session` is set, send a message to that session via `session_send` describing the request (resource type, key, scope, requester).
3. Reply to the user: "Access requires approval. Request submitted (id: xxx)."

If `approval_notify_session` is not set, fall back to current behavior: reply to the user suggesting they ask the owner directly (no structured request created).

#### Approval tools

Two new owner-only fixed tools:

```
approval_list(status?: 'pending' | 'approved' | 'rejected' | 'expired')
  policy: { kind: 'fixed', grants: [{type:'role', value:'owner'}] }

approval_review(id: string, decision: 'approved' | 'rejected', resolution?: 'once' | 'persistent')
  policy: { kind: 'fixed', grants: [{type:'role', value:'owner'}] }
```

`approval_review` behavior:

- `decision: 'approved'`, `resolution: 'once'` (default) — marks request as approved. The user can retry the operation; the system checks for an approved request before re-evaluating policy.
- `decision: 'approved'`, `resolution: 'persistent'` — marks request as approved AND auto-creates an `effect: 'allow'` policy row for the requester on the target resource. Future identical requests are allowed without approval.
- `decision: 'rejected'` — marks request as rejected. The user is notified.

#### User retry flow

When a user retries an operation that previously triggered `require_approval`:

1. Check for an approved ApprovalRequest matching (agentId, requesterId, resourceType, resourceKey).
2. If found and not expired → allow the operation.
3. If not found or expired → trigger a new approval request.

For `resolution: 'persistent'`, the policy row handles it — no need to check ApprovalRequest on retry.

### 6. Access resolution summary

Full evaluation for a resource access attempt:

```
1. Load policy rows for (agentId, resourceType)
2. Find matching rows (by resourceKey, scope, etc. — existing logic)
3. Evaluate effects:
   a. Any deny row where principal matches grants? → DENY (hard block)
   b. Any require_approval row where principal matches grants?
      → Check for approved ApprovalRequest → if found, ALLOW
      → Otherwise, create ApprovalRequest → REQUIRE_APPROVAL
   c. Any allow row where principal matches grants? → ALLOW
   d. No rows matched? → policy_default (allow or deny)
4. If REQUIRE_APPROVAL: return structured error with request ID
5. If DENY: return access denied error
6. If ALLOW: proceed
```

### 7. DB migration

```sql
-- Add effect column with default 'allow' for backward compatibility
ALTER TABLE agent_policies ADD COLUMN effect TEXT NOT NULL DEFAULT 'allow';

-- Create approval_requests table
CREATE TABLE approval_requests ( ... );
```

Existing rows get `effect: 'allow'` automatically — no data migration needed.

### 8. Impact on existing code

| Component | Change |
|-----------|--------|
| `PolicyRow` type | Add `effect` field |
| `resolveToolGrants` | Return effect alongside grants |
| `resolveFilePathGrants` | Return effect alongside grants |
| `resolveExecGrants` | Return effect alongside grants |
| `resolveMcpGrants` | Return effect alongside grants |
| `canAccess` | Becomes `evaluateAccess` returning `'allow' \| 'deny' \| 'require_approval'` |
| `ensureAutonomyAllows` | Remove (replaced by deny rows) |
| `READONLY_BLOCKED_TOOLS` | Remove (replaced by deny rows) |
| `withApproval` wrapper | Integrate with ApprovalRequest flow |
| SecurityPolicy | Add `policy_default`, `approval_notify_session`, `approval_ttl_minutes` |
| Agent runner tool filter | Use `evaluateAccess` instead of `canAccess` |
| File/exec/mcp checks | Use `evaluateAccess`, handle require_approval |
| Policy tools | Support `effect` param in `policy_set` |
| Web UI / CLI | Expose effect option |
| Store | Add ApprovalRequest CRUD |

### 9. Open questions

1. **Approval deduplication** — if the same user requests the same resource twice while the first is pending, create a new request or return the existing one?
2. **Batch approval** — should `approval_review` support approving by resource pattern (e.g. "approve all pending file reads for user X") or only by individual request ID?
3. **Expiration cleanup** — background job to expire old requests, or lazy expiration on read?
4. **Notification channels** — beyond session_send, should approval notifications go through configured channels (Slack, email) in the future?
5. **Virtual rows from autonomy_level** — keep autonomy_level as sugar long-term, or deprecate with a one-time migration?

### 10. Phased implementation

- **Phase A**: Add `effect` column to `agent_policies`. Update resolve functions to return effect. Update `canAccess` → `evaluateAccess`. Keep `autonomy_level` working via virtual rows.
- **Phase B**: Implement ApprovalRequest storage and `approval_list` / `approval_review` tools. Add `approval_notify_session` to SecurityPolicy.
- **Phase C**: Wire `require_approval` effect to actual approval flow (create request, notify, check on retry). Update file/exec/mcp resource checks.
- **Phase D**: Migrate `require_approval_for` to policy rows. Deprecate `READONLY_BLOCKED_TOOLS` and `ensureAutonomyAllows`. Update docs and admin UI.
