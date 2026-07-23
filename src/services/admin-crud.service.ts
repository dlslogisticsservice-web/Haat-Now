// ─────────────────────────────────────────────────────────────────────────────
// Generic admin CRUD engine — real Supabase table operations with a sandbox
// (localStorage) fallback so every CRUD page works end-to-end in demo without a
// live DB. One instance per table: adminCrud('categories'). No fake data — in
// production it reads/writes the real table; in sandbox it persists locally.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase';

// Demo mode is decided by the BUILD, never by whether a client object happens to exist:
// `|| !supabase` meant a production deploy with missing env vars silently served demo
// data. (main.tsx blocks that boot today, so this is closing the trap, not a live bug.)
import { IS_SANDBOX as SANDBOX } from '../config/runtime';

export interface CrudRow { id?: string; [k: string]: any }

export function adminCrud<T extends CrudRow = CrudRow>(table: string) {
  const lsKey = `haat_crud_${table}`;
  const readLocal = (): T[] => { try { return JSON.parse(localStorage.getItem(lsKey) || '[]'); } catch { return []; } };
  const writeLocal = (rows: T[]) => { try { localStorage.setItem(lsKey, JSON.stringify(rows)); } catch { /* ignore quota */ } };
  const localId = () => 'loc_' + Math.random().toString(36).slice(2, 10);

  return {
    sandbox: SANDBOX,
    async list(): Promise<{ data: T[]; error: any }> {
      if (SANDBOX) return { data: readLocal(), error: null };
      const { data, error } = await supabase.from(table).select('*');
      return { data: (data as T[]) || [], error };
    },
    async create(row: Partial<T>): Promise<{ data: T | null; error: any }> {
      if (SANDBOX) {
        const created = { ...row, id: localId() } as T;
        writeLocal([created, ...readLocal()]);
        return { data: created, error: null };
      }
      const { data, error } = await supabase.from(table).insert(row as any).select().single();
      return { data: data as T, error };
    },
    async update(id: string, patch: Partial<T>): Promise<{ error: any }> {
      if (SANDBOX) { writeLocal(readLocal().map(r => (r.id === id ? { ...r, ...patch } : r))); return { error: null }; }
      const { error } = await supabase.from(table).update(patch as any).eq('id', id);
      return { error };
    },
    async remove(id: string): Promise<{ error: any }> {
      if (SANDBOX) { writeLocal(readLocal().filter(r => r.id !== id)); return { error: null }; }
      const { error } = await supabase.from(table).delete().eq('id', id);
      return { error };
    },
  };
}
