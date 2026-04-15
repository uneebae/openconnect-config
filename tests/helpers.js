/**
 * Test helper — shared setup for API tests.
 * Provides a fresh SQLite DB + Express app for each test suite.
 */
import { app, init } from '../server/index.js';
import { getDb, resetDb, initSchema, seedDemoData } from '../server/db.js';
import * as dynamicDb from '../server/dynamic-db.js';
import supertest from 'supertest';

export function createTestClient() {
  return supertest(app);
}

export async function setupTestDb() {
  // Ensure schema exists
  initSchema();
  // Clear all data for a clean state
  resetDb();
}

export async function setupTestDbWithSeed() {
  initSchema();
  resetDb();
  seedDemoData();
}

export async function teardownTestDb() {
  // Ensure dynamic connections are closed
  await dynamicDb.disconnect();
}

export { app, init, getDb, resetDb, initSchema, seedDemoData, dynamicDb };
