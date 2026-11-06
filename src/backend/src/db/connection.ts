import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../../data');
export const DB_PATH = path.join(DATA_DIR, 'database.sqlite');

export async function openDb(): Promise<Database> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    await db.exec('PRAGMA foreign_keys = ON;');
    
    return db;
}