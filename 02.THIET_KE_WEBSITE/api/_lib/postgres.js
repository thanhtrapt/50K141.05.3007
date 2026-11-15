import { config } from './config.js';

function quoteIdentifiers(sql) {
  let output = '';
  let aliasNext = false;
  for (let i = 0; i < sql.length;) {
    const ch = sql[i];
    if (ch === "'") {
      const start = i++;
      while (i < sql.length) {
        if (sql[i++] === "'") {
          if (sql[i] === "'") { i++; continue; }
          break;
        }
      }
      output += sql.slice(start, i);
      aliasNext = false;
      continue;
    }
    if (ch === '"') {
      const start = i++;
      while (i < sql.length) {
        if (sql[i++] === '"') {
          if (sql[i] === '"') { i++; continue; }
          break;
        }
      }
      output += sql.slice(start, i);
      aliasNext = false;
      continue;
    }
    if (ch === '[') {
      const end = sql.indexOf(']', i + 1);
      if (end >= 0) {
        output += `"${sql.slice(i + 1, end)}"`;
        i = end + 1;
        aliasNext = false;
        continue;
      }
    }
    if (/[A-Za-z_]/.test(ch)) {
      const start = i++;
      while (i < sql.length && /[A-Za-z0-9_$]/.test(sql[i])) i++;
      const word = sql.slice(start, i);
      // Supabase schema was created from the group's SQL Server DDL using
      // PostgreSQL's unquoted identifier rules, so table/column names are
      // stored lowercase. Keep explicit aliases case-preserving for API JSON.
      if (aliasNext) output += `"${word}"`;
      else output += word.toLowerCase();
      aliasNext = word.toUpperCase() === 'AS';
      continue;
    }
    output += ch;
    if (!/\s/.test(ch)) aliasNext = false;
    i++;
  }
  return output;
}

export function toPostgresSql(source) {
  let sql = String(source).trim().replace(/^;+\s*/, '');
  sql = sql.replace(/\bN(?=')/gi, '');
  sql = sql.replace(/dbo\.([A-Za-z_][A-Za-z0-9_]*)/gi, (_match, table) => `public.${table.toLowerCase()}`);
  sql = sql.replace(/\s+WITH\s*\(\s*(?:UPDLOCK|HOLDLOCK|READPAST|ROWLOCK)(?:\s*,\s*(?:UPDLOCK|HOLDLOCK|READPAST|ROWLOCK))*\s*\)/gi, '');
  sql = sql.replace(/\bSYSDATETIME\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP');
  sql = sql.replace(/\bGETDATE\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP');
  sql = sql.replace(/\bCOUNT_BIG\s*\(/gi, 'COUNT(');
  sql = sql.replace(/\bISNULL\s*\(/gi, 'COALESCE(');
  sql = sql.replace(/\bDATEADD\s*\(\s*SECOND\s*,\s*(\$\d+)\s*,\s*CURRENT_TIMESTAMP\s*\)/gi, "(CURRENT_TIMESTAMP + ($1 * INTERVAL '1 second'))");
  sql = sql.replace(/\bCONVERT\s*\(\s*date\s*,\s*CURRENT_TIMESTAMP\s*\)/gi, 'CURRENT_DATE');
  sql = sql.replace(/\bCONVERT\s*\(\s*time\s*\(\s*0\s*\)\s*,\s*(\$\d+)\s*\)/gi, '$1::time');
  sql = sql.replace(/\bCONVERT\s*\(\s*varchar\s*\(\s*5\s*\)\s*,\s*([\w.]+)\s*,\s*108\s*\)/gi, "TO_CHAR($1, 'HH24:MI')");
  sql = sql.replace(/\bTRY_CONVERT\s*\(\s*INT\s*,\s*RIGHT\s*\(\s*RTRIM\s*\(\s*([\w.]+)\s*\)\s*,\s*(\d+)\s*\)\s*\)/gi,
    "NULLIF(regexp_replace(RIGHT(RTRIM($1), $2), '[^0-9]', '', 'g'), '')::integer");
  sql = sql.replace(/OUTER\s+APPLY\s*\(/gi, 'LEFT JOIN LATERAL (').replace(/\)\s+(\w+)\s+WHERE\s+/gi, ') $1 ON TRUE WHERE ');

  let limit = null;
  sql = sql.replace(/\bSELECT\s+TOP\s*\(\s*(\d+)\s*\)\s+/i, (_match, n) => { limit = Number(n); return 'SELECT '; });
  let returning = null;
  sql = sql.replace(/\s+OUTPUT\s+([\s\S]+?)\s+(WHERE\s+|VALUES\s*)/i, (_match, fields, clause) => {
    returning = fields.split(',').map((field) => field.trim().replace(/^inserted\./i, '')).join(', ');
    return ` ${clause.trimStart()}`;
  });

  sql = quoteIdentifiers(sql);
  sql = sql.replace(/(\$\d+)\s*\+\s*('(?:[^']|'')*')/g, '$1 || $2');
  if (limit !== null) sql += ` LIMIT ${limit}`;
  if (returning) sql += ` RETURNING ${quoteIdentifiers(returning.replace(/\bAS\s+\[?([A-Za-z_][\w]*)\]?/gi, 'AS "$1"'))}`;
  return sql;
}

function splitStatements(sql) {
  const result = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < sql.length; i++) {
    if (sql[i] === "'") {
      if (quoted && sql[i + 1] === "'") { i++; continue; }
      quoted = !quoted;
    } else if (sql[i] === ';' && !quoted) {
      const statement = sql.slice(start, i).trim();
      if (statement) result.push(statement);
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail) result.push(tail);
  return result;
}

export class PgRequest {
  constructor(client) { this.client = client; this.bindings = new Map(); }
  input(name, type, value) {
    if (arguments.length === 2) value = type;
    this.bindings.set(String(name).replace(/^@/, ''), value);
    return this;
  }
  async query(source) {
    let result = null;
    for (const statement of splitStatements(String(source))) {
      const values = [];
      const indexes = new Map();
      let output = '';
      let quoted = false;
      for (let i = 0; i < statement.length;) {
        if (statement[i] === "'") {
          output += statement[i++];
          if (quoted && statement[i] === "'") { output += statement[i++]; continue; }
          quoted = !quoted;
          continue;
        }
        const match = !quoted && /^@[A-Za-z_][A-Za-z0-9_]*/.exec(statement.slice(i));
        if (match) {
          const name = match[0].slice(1);
          if (!this.bindings.has(name)) throw new Error(`Missing query parameter: ${name}`);
          if (!indexes.has(name)) { indexes.set(name, values.length + 1); values.push(this.bindings.get(name)); }
          output += `$${indexes.get(name)}`;
          i += match[0].length;
        } else output += statement[i++];
      }
      result = await this.client.query(toPostgresSql(output), values);
    }
    return { recordset: result?.rows || [], rowsAffected: result ? [result.rowCount || 0] : [], rowCount: result?.rowCount || 0 };
  }
}

export function createPoolOptions() {
  return {
    connectionString: config.databaseUrl,
    max: config.isServerless ? 3 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    ssl: { rejectUnauthorized: false },
    application_name: 'huong-spa-backend',
  };
}
