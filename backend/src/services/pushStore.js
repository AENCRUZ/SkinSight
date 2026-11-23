/**
 * Storage for push subscriptions + the medication schedule each one should be reminded about.
 *
 *  - Supabase (production): used when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set. Render's disk is wiped on
 *    every deploy/restart, so production MUST use this. Table: see backend/sql/push_subscriptions.sql.
 *  - JSON file (local development fallback): backend/data/push-subscriptions.json.
 *
 * Record shape: { endpoint, subscription, medications, completed, timezone, last_sent, updated_at }
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const TABLE = 'push_subscriptions';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, '../../data/push-subscriptions.json');

function isConfigured(v) {
  return typeof v === 'string' && v.trim() && !/your[_-]/i.test(v);
}

function createSupabaseStore(url, key) {
  const db = createClient(url.trim(), key.trim(), { auth: { persistSession: false, autoRefreshToken: false } });

  async function run(promise) {
    const { data, error } = await promise;
    if (error) throw new Error(`Supabase ${TABLE}: ${error.message}`);
    return data;
  }

  return {
    kind: 'supabase',
    async all() {
      return (await run(db.from(TABLE).select('*'))) || [];
    },
    async get(endpoint) {
      const rows = await run(db.from(TABLE).select('*').eq('endpoint', endpoint).limit(1));
      return rows && rows[0] ? rows[0] : null;
    },
    async upsert(record) {
      await run(db.from(TABLE).upsert({ ...record, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' }));
    },
    async update(endpoint, fields) {
      await run(db.from(TABLE).update({ ...fields, updated_at: new Date().toISOString() }).eq('endpoint', endpoint));
    },
    async remove(endpoint) {
      await run(db.from(TABLE).delete().eq('endpoint', endpoint));
    },
  };
}

function createFileStore(file) {
  function read() {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return {};
    }
  }
  function write(all) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(all, null, 2), 'utf8');
  }

  return {
    kind: 'file',
    async all() {
      return Object.values(read());
    },
    async get(endpoint) {
      return read()[endpoint] || null;
    },
    async upsert(record) {
      const all = read();
      all[record.endpoint] = { ...all[record.endpoint], ...record, updated_at: new Date().toISOString() };
      write(all);
    },
    async update(endpoint, fields) {
      const all = read();
      if (!all[endpoint]) return;
      all[endpoint] = { ...all[endpoint], ...fields, updated_at: new Date().toISOString() };
      write(all);
    },
    async remove(endpoint) {
      const all = read();
      delete all[endpoint];
      write(all);
    },
  };
}

export function createPushStore(env = process.env) {
  if (isConfigured(env.SUPABASE_URL) && isConfigured(env.SUPABASE_SERVICE_ROLE_KEY)) {
    return createSupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  }
  if (env.NODE_ENV === 'production') {
    console.warn(
      '⚠️  [push] SUPABASE_SERVICE_ROLE_KEY is not set: reminder subscriptions are kept in a local file and will be ' +
        'LOST whenever Render restarts or redeploys.'
    );
  }
  return createFileStore(env.PUSH_DATA_FILE || DATA_FILE);
}
