# MCP_CONNECTION_REPORT.md — HAAT NOW Supabase MCP

Supabase MCP configured for project `umwbzradvbsirsybfxfb`. Credentials, project, SQL access, and table visibility were **validated live** against the Supabase Management API (the same backend the MCP server uses) with the provided token — all read-only.

## Status matrix
| Check | Result | Evidence |
|---|---|---|
| **MCP Installed** (config written) | ✅ **PASS** | `.mcp.json` created with `@supabase/mcp-server-supabase@latest`, `--read-only`, `--project-ref=umwbzradvbsirsybfxfb`; `node v24.15.0` + `npx 11.12.1` present to spawn it |
| **MCP Authenticated** (token valid) | ✅ **PASS** | `GET /v1/projects` → **HTTP 200** with the token |
| **Project Connected** | ✅ **PASS** | `GET /v1/projects/umwbzradvbsirsybfxfb` → **HTTP 200**; name **`haat-now-dev`**, org `dvkfoervzwdbddfacdhw`, region `eu-west-1`, `ACTIVE_HEALTHY`, Postgres 17.6 |
| **SQL Access Available** | ✅ **PASS** | `POST /v1/projects/.../database/query` (read-only catalog select) → **HTTP 201** |
| **Tables Visible** | ✅ **PASS** | 45 public tables returned: `addresses, admin_users, app_config, … wallets, webhook_events, zones` |
| **Required Tools Available** (`list_projects`, `get_project`, `list_tables`, `execute_sql`) | ⏳ **PASS (validated via API) / PENDING in-session** | Each capability proved against the Management API. The MCP **tools themselves do not appear until Claude Code is restarted** and the server is approved (MCP servers load at startup, not mid-session) |

## HAAT NOW project identification
- **Project: `umwbzradvbsirsybfxfb` → "haat-now-dev"** — confirmed as the HAAT NOW database (the one `.env` `VITE_SUPABASE_URL` targets and all migrations/runbooks reference). It is the **only** project under this token's organization.

## Exact files created / modified
- **`.mcp.json`** (created) — Supabase MCP server config with the access token. **Gitignored** (verified `git check-ignore .mcp.json` → matched) so the secret is never committed; currently untracked.
- **`.mcp.json.example`** (created) — secret-free template using `${SUPABASE_ACCESS_TOKEN}` expansion, safe to commit.
- **`.gitignore`** (modified) — added `.mcp.json`.
- No application code, UI, or production SQL touched. The only SQL run was a read-only `information_schema` select for verification.

## Exact MCP status
- **Configuration: COMPLETE and credential-validated.** The server will start on next launch.
- **In-session tools: NOT yet live** — `mcp__supabase__list_projects` / `get_project` / `list_tables` / `execute_sql` will register only after Claude Code reloads MCP servers.

## Remaining blockers (to make the tools live in a session)
1. **Restart / reload required** — exit and relaunch Claude Code in this repo (or run `/mcp` → reconnect). On first load, **approve** the new `supabase` server when prompted (project-scoped `.mcp.json` servers require trust approval).
2. **Verify after reload:** run `/mcp` (server `supabase` should show **connected**), then call `list_projects` and `list_tables` — they should return `haat-now-dev` and the 45 tables shown above.
3. **For the actual cutover (later, separate step):** `.mcp.json` is pinned `--read-only`, which **blocks DDL/DML** (correct for now — "do not execute production SQL"). To run the cutover SQL via MCP you must remove `--read-only` (or add a second non-read-only server) and explicitly approve each write. Until then MCP can only read.

## Security notes (important)
- The access token was provided in plaintext in chat and written to `.mcp.json`. It is **gitignored**, but **rotate it** in the Supabase dashboard (Account → Access Tokens) if this transcript/workspace is shared — then update `.mcp.json` (or set `SUPABASE_ACCESS_TOKEN` in your shell and switch to the `.mcp.json.example` env-expansion form).
- `--read-only` is set as a safety default; it does not weaken connectivity verification.

## Verdict
**MCP connectivity is fully verified at the credential/project/SQL level (all PASS).** The only thing standing between this and live in-session tools is a **Claude Code restart + server approval** — a client action I cannot perform from inside the running session. Stopping here as instructed.
