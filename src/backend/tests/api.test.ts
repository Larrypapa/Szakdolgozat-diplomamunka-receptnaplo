import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import { createApp } from '../src/app.js';
import fs from 'fs/promises';
import path from 'path';

let db: Database;
let app: any;

beforeAll(async () => {
    db = await open({ filename: ':memory:', driver: sqlite3.Database });
    await db.exec('PRAGMA foreign_keys = ON;');

    await db.exec(`
        CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL);
        CREATE TABLE ingredients (id TEXT PRIMARY KEY, nev TEXT NOT NULL, kaloria REAL, feherje REAL, szenhidrat REAL, zsir REAL);
        CREATE TABLE recipes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, nev TEXT NOT NULL, alap_adagszam INTEGER NOT NULL CHECK (alap_adagszam > 0), FOREIGN KEY (user_id) REFERENCES users(id));
        CREATE TABLE recipe_ingredients (id INTEGER PRIMARY KEY AUTOINCREMENT, recipe_id INTEGER NOT NULL, ingredient_id TEXT NOT NULL, mennyiseg_grammban REAL NOT NULL CHECK (mennyiseg_grammban > 0), FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE, FOREIGN KEY (ingredient_id) REFERENCES ingredients(id));
        CREATE TABLE diary_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, recipe_id INTEGER, date TEXT NOT NULL, consumed_adag REAL NOT NULL CHECK (consumed_adag > 0), snapshot_data TEXT NOT NULL, FOREIGN KEY (user_id) REFERENCES users(id), FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE SET NULL);
    `);
    await db.run(`INSERT INTO users (id, username) VALUES (1, 'demo_user')`);

    const rawData = await fs.readFile(path.resolve(__dirname, '../src/ingredients.json'), 'utf8');
    const ingredients = JSON.parse(rawData);
    const insertStmt = await db.prepare('INSERT INTO ingredients (id, nev, kaloria, feherje, szenhidrat, zsir) VALUES (?, ?, ?, ?, ?, ?)');
    for (const ing of ingredients) {
        await insertStmt.run(ing.id, ing.nev, ing.kaloria, ing.feherje, ing.szenhidrat, ing.zsir);
    }
    await insertStmt.finalize();

    app = createApp(db);
});

afterAll(async () => {
    await db.close(); 
});

describe('Étkezésnapló API Integrációs Tesztek (Historikus védelem)', () => {
    let letrehozottReceptId: number;
    let letrehozottNaploId: number;
    const tesztDatum = '2026-11-06';
    let eredetiKaloria: number;

    it('1. Recept létrehozása és naplózása (Snapshot teszt előkészítése)', async () => {

        const recipeRes = await request(app).post('/api/recipes').send({
            nev: 'Teszt Tojás', alap_adagszam: 1,
            hozzavalok: [{ ingredient_id: '01123', mennyiseg_grammban: 100 }]
        });
        expect(recipeRes.status).toBe(201);
        letrehozottReceptId = recipeRes.body.id;

        const diaryRes = await request(app).post('/api/diary').send({
            recipe_id: letrehozottReceptId, consumed_adag: 1, date: tesztDatum
        });
        expect(diaryRes.status).toBe(201);
        letrehozottNaploId = diaryRes.body.id;

        const checkRes = await request(app).get(`/api/diary?date=${tesztDatum}`);
        eredetiKaloria = checkRes.body.napiOsszesito.kaloria;
        expect(eredetiKaloria).toBe(143.0); 
    });

    it('2. A recept utólagos módosítása NEM változtatja meg a már elmentett napló tápértékét (Szakdolgozat magja!)', async () => {
   
        const updateRes = await request(app).put(`/api/recipes/${letrehozottReceptId}`).send({
            nev: 'Teszt Tojás Módosított', alap_adagszam: 1,
            hozzavalok: [{ ingredient_id: '01123', mennyiseg_grammban: 1000 }]
        });
        expect(updateRes.status).toBe(200);

        const checkRes = await request(app).get(`/api/diary?date=${tesztDatum}`);
        expect(checkRes.body.napiOsszesito.kaloria).toBe(eredetiKaloria);
        expect(checkRes.body.bejegyzesek[0].recipe_name).toBe('Teszt Tojás'); 
    });

    it('3. Napló szerkesztése és törlése frissíti a napi összesítést', async () => {
       
        const putRes = await request(app).put(`/api/diary/${letrehozottNaploId}`).send({
            consumed_adag: 2, date: tesztDatum
        });
        expect(putRes.status).toBe(200);

        let checkRes = await request(app).get(`/api/diary?date=${tesztDatum}`);
    
        expect(checkRes.body.napiOsszesito.kaloria).toBe(286.0);

        const delRes = await request(app).delete(`/api/diary/${letrehozottNaploId}`);
        expect(delRes.status).toBe(200);

        checkRes = await request(app).get(`/api/diary?date=${tesztDatum}`);
        expect(checkRes.body.napiOsszesito.kaloria).toBe(0);
        expect(checkRes.body.bejegyzesek.length).toBe(0);
    });
});