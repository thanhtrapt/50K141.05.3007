import { connectDatabase } from './database.js';

/** Connects to the existing Supabase database; it never migrates or seeds data. */
export function ensureDatabase() {
  return connectDatabase();
}
