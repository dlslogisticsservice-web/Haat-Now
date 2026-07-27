# HAAT NOW Website Studio — Security Audit (Phase 9E)

| Control | Status | Evidence |
|---|---|---|
| **Expression sandbox** | ✅ PASS | `logic/expression.ts` is a hand-written recursive-descent evaluator — **no `eval`, no `new Function`**. Only a whitelisted function library is callable; unknown identifiers resolve to `undefined` (null-safe), unknown functions throw a caught error. No property/prototype traversal beyond the provided scope. |
| **Runtime injection** | ✅ PASS | Bindings/conditions evaluate through the same sandbox; a malicious expression cannot reach globals, `window`, `process`, or the prototype chain. |
| **Tenant isolation** | ✅ PASS | `BuilderStore.records()` filters every read by `ctx.tenant`; `createRecord`/`import`/`seed` tag rows with the current tenant. Verified in browser: tenant `beauty` sees **0** of `haat`'s rows. |
| **RBAC** | ✅ PASS | `can(entity, op)` gates `create/read/update/delete`; a role only matches `role === 'any'` or its own role, with an optional expression condition. Verified: removing the `create` permission blocks record creation. |
| **Permission escalation** | ✅ PASS | Permissions are per-entity, per-op; there is no wildcard that grants beyond declared roles. Adding a permission is an explicit, audited op. |
| **Import validation** | ✅ PASS | `importRows()` runs field validators on every row **before** committing; any invalid row rolls the whole import back (nothing partially written) and returns an error report. |
| **Export security** | ✅ PASS | Export projects only the entity's declared fields for the current tenant; SQL export escapes single quotes. No secrets are ever in the model. |
| **Builder injection** | ✅ PASS | Component render functions consume typed props + design tokens; `richtext` is the only `dangerouslySetInnerHTML` sink and is author-controlled Studio content (not end-user input). |
| **Publishing authorization** | ✅ PASS | Publish requires an **approved** candidate and **re-validates** before committing (`PublishEngine.publish`); publishing never bypasses validation (Phase 8J). |
| **Data isolation (design vs runtime)** | ✅ PASS | Design model (undoable) and runtime rows are separate stores; production remains the sandbox demo (mock OTP, localStorage) with the real backend dormant behind `HAAT_LIVE_BACKEND=1`. |
| **Secrets client-side** | ✅ PASS | `check-architecture.cjs` enforces no `lib/supabase` import from `features/*`; provider mappings are declarative (record which service they'd wrap), never embedding credentials. |

**Result:** no critical or high findings. The Studio is session-only and in-memory; all data is
tenant-scoped and permission-gated; the expression engine is a true sandbox.
