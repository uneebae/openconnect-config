import Database from 'better-sqlite3';

const db = new Database('server/demo.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();

console.log('=== DEMO DATABASE CONTENTS ===\n');
console.log('Tables:', tables.map(t => t.name).join(', '));
console.log('');

tables.forEach(t => {
  const rows = db.prepare('SELECT * FROM ' + t.name).all();
  console.log('--- ' + t.name + ' (' + rows.length + ' rows) ---');
  if (rows.length > 0) {
    console.table(rows);
  } else {
    console.log('  (empty)');
  }
  console.log('');
});

db.close();
