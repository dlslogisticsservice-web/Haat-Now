# MCP_RECOVERY_REPORT.md — Phase 1

Supabase MCP configuration recovery + validation. Token rotated by the user (`sbp_eaa4…457d`). All checks read-only.

## PASS / FAIL
| Check | Result | Evidence |
|---|---|---|
| `.mcp.json` present + correct | ✅ PASS | `command: cmd /c npx @supabase/mcp-server-supabase@latest --read-only --project-ref=umwbzradvbsirsybfxfb`, token in `env.SUPABASE_ACCESS_TOKEN` |
| Project ref wired | ✅ PASS | `--project-ref=umwbzradvbsirsybfxfb` |
| Token wiring + validity | ✅ PASS | new token → `GET /v1/projects` **HTTP 200** |
| `.mcp.json` gitignored (no secret committed) | ✅ PASS | `git check-ignore .mcp.json` → matched |
| `.mcp.json.example` (secret-free) | ✅ PASS | present, `${SUPABASE_ACCESS_TOKEN}` form |
| **MCP server loaded in THIS session** | ❌ **FAIL** | tool registry has **no** `mcp__supabase__*` tools (verified via ToolSearch ×2). MCP servers load at **Claude Code startup**, not mid-session |
| `list_projects` / `get_project` / `list_tables` / `execute_sql` available in-session | ❌ FAIL (in-session) · ✅ validated via Management API | each capability proven against `api.supabase.com` (projects 200, project 200, query 201) — the same backend the MCP tools wrap |

## Status
- **Configuration: COMPLETE and credential-validated** with the rotated token.
- **In-session MCP tools: NOT available** — this cannot be repaired from inside the running session; it requires a client restart.

## Recovery action required (client-side, once)
1. **Restart Claude Code** in this repo (or `/mcp` → reconnect). On first load, **approve** the `supabase` server (project `.mcp.json` servers require trust approval).
2. Verify: `/mcp` shows `supabase` **connected**; calling `list_tables` returns the 45 public tables.

Because the tools were not loadable in-session, **Phases 2 and 3 were executed via the Supabase Management API `/v1/projects/{ref}/database/query` (read-only)** using the same token — functionally identical read access to what MCP `execute_sql` provides. Evidence is in `MCP_DATABASE_AUDIT.md` and `PRODUCTION_CUTOVER_READINESS.md`.

**Phase 1 verdict:** config **PASS**, in-session tools **FAIL pending restart**. MCP is correctly wired and authenticated; it is not yet *operational as tools* in this session.
