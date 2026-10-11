import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.DATA_DIR || './data';
const file = path.join(dir, 'db.json');
fs.mkdirSync(dir, { recursive: true });

const db = { saved: {}, alerts: [], notifications: {}, push: {} };
try { Object.assign(db, JSON.parse(fs.readFileSync(file, 'utf8'))); } catch {}

let t;
export const save = () => {
  clearTimeout(t);
  t = setTimeout(() => fs.writeFile(file, JSON.stringify(db), () => {}), 300);
};
export default db;
