import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { openDb, DB_PATH } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INGREDIENTS_PATH = path.join(__dirname, '../ingredients.json');

async function setupDatabase() {
    try {
        await fs.unlink(DB_PATH);
        console.log(`Régi adatbázisfájl törölve: ${DB_PATH}`);
    } catch (err: any) {
        if (err.code !== 'ENOENT') {
            throw err;
        }
    }

    const db = await openDb();
    console.log("Adatbázis kapcsolat sikeres. Foreign keys bekapcsolva.");

    await db.exec(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL
        );

        CREATE TABLE ingredients (
            id TEXT PRIMARY KEY,
            nev TEXT NOT NULL,
            kaloria REAL,
            feherje REAL,
            szenhidrat REAL,
            zsir REAL
        );

        CREATE TABLE recipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            nev TEXT NOT NULL,
            alap_adagszam INTEGER NOT NULL CHECK (alap_adagszam > 0),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        CREATE TABLE recipe_ingredients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            recipe_id INTEGER NOT NULL,
            ingredient_id TEXT NOT NULL,
            mennyiseg_grammban REAL NOT NULL CHECK (mennyiseg_grammban > 0),
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
            FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
        );

        CREATE TABLE diary_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recipe_id INTEGER,
            date TEXT NOT NULL,
            consumed_adag REAL NOT NULL CHECK (consumed_adag > 0),
            snapshot_data TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL
        );
    `);
    console.log("Adatbázis séma (táblák) nulláról létrehozva a CHECK szabályokkal.");

    await db.run(`INSERT INTO users (id, username) VALUES (1, 'demo_user')`);
    console.log("Demo felhasználó (id: 1) sikeresen létrehozva.");

    const rawData = await fs.readFile(INGREDIENTS_PATH, 'utf8');
    let ingredients;
    
    try {
        ingredients = JSON.parse(rawData);
    } catch (e) {
        throw new Error("Az ingredients.json fájl nem érvényes JSON formátumú!");
    }

    if (!Array.isArray(ingredients)) {
        throw new Error("Hiba: Az ingredients.json tartalmának egy tömbnek (Array) kell lennie!");
    }

    const insertStmt = await db.prepare(`
        INSERT INTO ingredients (id, nev, kaloria, feherje, szenhidrat, zsir)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        if (!ing.id || !ing.nev) {
            throw new Error(`Hiba az alapanyag beolvasásakor (index: ${i}): Hiányzik az 'id' vagy 'nev' mező. Adat: ${JSON.stringify(ing)}`);
        }
        await insertStmt.run(ing.id, ing.nev, ing.kaloria, ing.feherje, ing.szenhidrat, ing.zsir);
    }
    await insertStmt.finalize();

    console.log(`Sikeresen beolvasva és adatbázisba mentve ${ingredients.length} alapanyag.`);
    console.log("Adatbázis inicializálás és seedelés KÉSZ.");
}

setupDatabase().catch(err => {
    console.error("Végzetes hiba az adatbázis beállításakor:", err.message);
    process.exit(1);
});