import express, { Express } from 'express';
import cors from 'cors';
import { Database } from 'sqlite';
import { receptTapertekSzamitas, RecipeItem, Macros } from './utils/nutritionCalculator.js';

export function createApp(db: Database): Express {
    const app = express();
    app.use(cors());
    app.use(express.json());

    const DEMO_USER_ID = 1;

    let isTransactionActive = false;
    async function withTransaction(fn: () => Promise<void>) {
        while (isTransactionActive) {
            await new Promise(resolve => setTimeout(resolve, 10)); 
        }
        isTransactionActive = true;
        try {
            await db.run('BEGIN TRANSACTION');
            await fn();
            await db.run('COMMIT');
        } catch (error) {
            try {
                await db.run('ROLLBACK');
            } catch (rollbackError) {
                console.error('Végzetes hiba a ROLLBACK során:', rollbackError);
            }
            throw error;
        } finally {
            isTransactionActive = false;
        }
    }

    function isValidDate(dateString: string): boolean {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
        const d = new Date(dateString);
        return !isNaN(d.getTime()) && d.toISOString().split('T')[0] === dateString;
    }

    async function validateRecipeInput(reqBody: any): Promise<{ valid: boolean, error?: string }> {
        const { nev, alap_adagszam, hozzavalok } = reqBody;

        if (!nev || typeof nev !== 'string' || nev.trim() === '') {
            return { valid: false, error: 'A recept neve nem lehet üres!' };
        }
        if (!Number.isInteger(alap_adagszam) || alap_adagszam <= 0) {
            return { valid: false, error: 'Az alap adagszámnak pozitív egész számnak kell lennie!' };
        }
        if (!Array.isArray(hozzavalok) || hozzavalok.length === 0) {
            return { valid: false, error: 'A receptnek legalább egy hozzávalót tartalmaznia kell!' };
        }

        for (let i = 0; i < hozzavalok.length; i++) {
            const h = hozzavalok[i];
            if (!h || typeof h !== 'object' || Array.isArray(h)) {
                return { valid: false, error: `A(z) ${i + 1}. hozzávaló érvénytelen formátumú!` };
            }
            if (typeof h.mennyiseg_grammban !== 'number' || isNaN(h.mennyiseg_grammban) || h.mennyiseg_grammban <= 0) {
                return { valid: false, error: `A(z) ${i + 1}. hozzávaló mennyisége szigorúan pozitív szám kell legyen!` };
            }
            if (!h.ingredient_id || typeof h.ingredient_id !== 'string') {
                return { valid: false, error: `A(z) ${i + 1}. hozzávalónál hiányzik vagy érvénytelen az ingredient_id!` };
            }
            
            const exists = await db.get('SELECT id FROM ingredients WHERE id = ?', [h.ingredient_id]);
            if (!exists) {
                return { valid: false, error: `A megadott alapanyag (ID: ${h.ingredient_id}) nem létezik az adatbázisban!` };
            }
        }
        return { valid: true };
    }


    app.get('/api/ingredients', async (req, res) => {
        try {
            const ingredients = await db.all('SELECT * FROM ingredients');
            res.json(ingredients);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/recipes', async (req, res) => {
        try {
            const recipes = await db.all('SELECT id, nev, alap_adagszam FROM recipes WHERE user_id = ? ORDER BY id DESC', [DEMO_USER_ID]);
            const result = [];
            for (const r of recipes) {
                const ingredientsRaw = await db.all(`
                    SELECT ri.mennyiseg_grammban, i.* 
                    FROM recipe_ingredients ri
                    JOIN ingredients i ON ri.ingredient_id = i.id
                    WHERE ri.recipe_id = ? ORDER BY ri.id ASC
                `, [r.id]);
                
                const calcInput: RecipeItem[] = ingredientsRaw.map(ing => ({
                    alapanyag: ing as any, mennyisegGrammban: ing.mennyiseg_grammban
                }));

                try {
                    const nutrition = receptTapertekSzamitas(calcInput, r.alap_adagszam);
                    result.push({
                        id: r.id, nev: r.nev, alap_adagszam: r.alap_adagszam,
                        adagonkent: { kaloria: nutrition.adagonkent.kaloria, feherje: nutrition.adagonkent.feherje },
                        hianyzoAdat: { kaloria: nutrition.hianyzoAdat.kaloria, feherje: nutrition.hianyzoAdat.feherje }
                    });
                } catch (err) {
                    console.error(`Számítási hiba a receptnél (ID: ${r.id})`);
                }
            }
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/recipes/:id', async (req, res): Promise<any> => {
        try {
            const recipe = await db.get('SELECT * FROM recipes WHERE id = ? AND user_id = ?', [req.params.id, DEMO_USER_ID]);
            if (!recipe) return res.status(404).json({ error: 'Recept nem található (vagy nincs jogosultságod).' });

            const ingredientsRaw = await db.all(`
                SELECT ri.ingredient_id, i.nev, ri.mennyiseg_grammban, i.kaloria, i.feherje, i.szenhidrat, i.zsir 
                FROM recipe_ingredients ri
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ? ORDER BY ri.id ASC
            `, [recipe.id]);

            const calcInput: RecipeItem[] = ingredientsRaw.map(ing => ({
                alapanyag: { id: ing.ingredient_id, nev: ing.nev, kaloria: ing.kaloria, feherje: ing.feherje, szenhidrat: ing.szenhidrat, zsir: ing.zsir },
                mennyisegGrammban: ing.mennyiseg_grammban
            }));

            let nutrition;
            try {
                nutrition = receptTapertekSzamitas(calcInput, recipe.alap_adagszam);
            } catch (calcError: any) {
                return res.status(400).json({ error: `Hiba a tápérték számításakor: ${calcError.message}` });
            }

            res.json({ id: recipe.id, nev: recipe.nev, alap_adagszam: recipe.alap_adagszam, hozzavalok: ingredientsRaw, tapertek: nutrition });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.post('/api/recipes', async (req, res): Promise<any> => {
        const validation = await validateRecipeInput(req.body);
        if (!validation.valid) return res.status(400).json({ error: validation.error });

        const { nev, alap_adagszam, hozzavalok } = req.body;
        let recipeId: number | undefined;

        try {
            await withTransaction(async () => {
                const result = await db.run('INSERT INTO recipes (user_id, nev, alap_adagszam) VALUES (?, ?, ?)', [DEMO_USER_ID, nev.trim(), alap_adagszam]);
                recipeId = result.lastID;
                const stmt = await db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, mennyiseg_grammban) VALUES (?, ?, ?)');
                for (const h of hozzavalok) {
                    await stmt.run(recipeId, h.ingredient_id, h.mennyiseg_grammban);
                }
                await stmt.finalize();
            });
            res.status(201).json({ id: recipeId, nev: nev.trim(), message: 'Recept sikeresen mentve.' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/recipes/:id', async (req, res): Promise<any> => {
        const validation = await validateRecipeInput(req.body);
        if (!validation.valid) return res.status(400).json({ error: validation.error });

        const { nev, alap_adagszam, hozzavalok } = req.body;

        try {
            let found = true;
            await withTransaction(async () => {
                const updateResult = await db.run('UPDATE recipes SET nev = ?, alap_adagszam = ? WHERE id = ? AND user_id = ?', 
                    [nev.trim(), alap_adagszam, req.params.id, DEMO_USER_ID]);
                
                if (updateResult.changes === 0) {
                    found = false;
                    return;
                }
                await db.run('DELETE FROM recipe_ingredients WHERE recipe_id = ?', [req.params.id]);
                const stmt = await db.prepare('INSERT INTO recipe_ingredients (recipe_id, ingredient_id, mennyiseg_grammban) VALUES (?, ?, ?)');
                for (const h of hozzavalok) {
                    await stmt.run(req.params.id, h.ingredient_id, h.mennyiseg_grammban);
                }
                await stmt.finalize();
            });

            if (!found) return res.status(404).json({ error: 'Recept nem található (vagy nincs jogosultságod).' });
            res.json({ message: 'Recept sikeresen módosítva.' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/recipes/:id', async (req, res): Promise<any> => {
        try {
            const deleteResult = await db.run('DELETE FROM recipes WHERE id = ? AND user_id = ?', [req.params.id, DEMO_USER_ID]);
            if (deleteResult.changes === 0) return res.status(404).json({ error: 'Recept nem található (vagy nincs jogosultságod).' });
            res.json({ message: 'Recept törölve.' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });



    app.post('/api/diary', async (req, res): Promise<any> => {
        const { recipe_id, consumed_adag, date } = req.body;
        
        if (!recipe_id || !consumed_adag || typeof consumed_adag !== 'number' || consumed_adag <= 0 || !date || !isValidDate(date)) {
            return res.status(400).json({ error: 'Érvénytelen bemenet. Érvényes dátum (YYYY-MM-DD), pozitív consumed_adag és recipe_id kötelező.' });
        }

        try {
            const recipe = await db.get('SELECT * FROM recipes WHERE id = ? AND user_id = ?', [recipe_id, DEMO_USER_ID]);
            if (!recipe) return res.status(404).json({ error: 'Recept nem található.' });

            const ingredientsRaw = await db.all(`
                SELECT ri.ingredient_id, i.nev, ri.mennyiseg_grammban, i.kaloria, i.feherje, i.szenhidrat, i.zsir 
                FROM recipe_ingredients ri
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ?
            `, [recipe.id]);

            const calcInput: RecipeItem[] = ingredientsRaw.map(ing => ({
                alapanyag: { id: ing.ingredient_id, nev: ing.nev, kaloria: ing.kaloria, feherje: ing.feherje, szenhidrat: ing.szenhidrat, zsir: ing.zsir },
                mennyisegGrammban: ing.mennyiseg_grammban
            }));
            
            let nutrition;
            try {
                nutrition = receptTapertekSzamitas(calcInput, recipe.alap_adagszam);
            } catch (calcErr: any) {
                return res.status(400).json({ error: `Számítási hiba: ${calcErr.message}` });
            }

            const snapshotData = {
                recipe_name: recipe.nev,
                alap_adagszam: recipe.alap_adagszam,
                hozzavalok: ingredientsRaw.map(i => ({ nev: i.nev, mennyiseg_grammban: i.mennyiseg_grammban })),
                tapertek: nutrition 
            };

            const result = await db.run(
                'INSERT INTO diary_entries (user_id, recipe_id, date, consumed_adag, snapshot_data) VALUES (?, ?, ?, ?, ?)',
                [DEMO_USER_ID, recipe.id, date, consumed_adag, JSON.stringify(snapshotData)]
            );

            res.status(201).json({ id: result.lastID, message: 'Étkezés naplózva a historikus pillanatképpel.' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.get('/api/diary', async (req, res): Promise<any> => {
        const { date } = req.query;
        if (!date || typeof date !== 'string' || !isValidDate(date)) {
            return res.status(400).json({ error: 'A dátum paraméter kötelező és érvényes YYYY-MM-DD kell legyen.' });
        }

        try {
            const entries = await db.all('SELECT * FROM diary_entries WHERE user_id = ? AND date = ?', [DEMO_USER_ID, date]);
            
            const napiOsszesito = {
                kaloria: 0, feherje: 0, szenhidrat: 0, zsir: 0,
                hianyzoAdat: { kaloria: false, feherje: false, szenhidrat: false, zsir: false }
            };

            const responseEntries = entries.map(entry => {
                const snapshot = JSON.parse(entry.snapshot_data);
                const arany = entry.consumed_adag;
                
                const fogyasztottMakrok = {
                    kaloria: snapshot.tapertek.hianyzoAdat.kaloria ? null : (snapshot.tapertek.ismertAdagonkent.kaloria * arany),
                    feherje: snapshot.tapertek.hianyzoAdat.feherje ? null : (snapshot.tapertek.ismertAdagonkent.feherje * arany),
                    szenhidrat: snapshot.tapertek.hianyzoAdat.szenhidrat ? null : (snapshot.tapertek.ismertAdagonkent.szenhidrat * arany),
                    zsir: snapshot.tapertek.hianyzoAdat.zsir ? null : (snapshot.tapertek.ismertAdagonkent.zsir * arany)
                };

                const ismertFogyasztott = {
                    kaloria: snapshot.tapertek.ismertAdagonkent.kaloria * arany,
                    feherje: snapshot.tapertek.ismertAdagonkent.feherje * arany,
                    szenhidrat: snapshot.tapertek.ismertAdagonkent.szenhidrat * arany,
                    zsir: snapshot.tapertek.ismertAdagonkent.zsir * arany
                };

                ['kaloria', 'feherje', 'szenhidrat', 'zsir'].forEach(m => {
                    const makro = m as keyof Macros;
                    if (snapshot.tapertek.hianyzoAdat[makro]) Object.assign(napiOsszesito.hianyzoAdat, { [makro]: true });
                    napiOsszesito[makro] += ismertFogyasztott[makro];
                });

                return {
                    id: entry.id, recipe_id: entry.recipe_id, recipe_name: snapshot.recipe_name, consumed_adag: entry.consumed_adag,
                    fogyasztottMakrok, ismertFogyasztott, 
                    hianyzoAdat: snapshot.tapertek.hianyzoAdat, hianyosAlapanyagok: snapshot.tapertek.hianyosAlapanyagok,
                    hozzavalok: snapshot.hozzavalok 
                };
            });

            res.json({ date, napiOsszesito, bejegyzesek: responseEntries });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/diary/:id', async (req, res): Promise<any> => {
        const { consumed_adag, date } = req.body;
        if (!consumed_adag || typeof consumed_adag !== 'number' || consumed_adag <= 0 || !date || !isValidDate(date)) {
            return res.status(400).json({ error: 'Érvénytelen bemenet. Érvényes date és pozitív consumed_adag kötelező.' });
        }

        try {
            const updateResult = await db.run('UPDATE diary_entries SET consumed_adag = ?, date = ? WHERE id = ? AND user_id = ?', 
                [consumed_adag, date, req.params.id, DEMO_USER_ID]);
            
            if (updateResult.changes === 0) return res.status(404).json({ error: 'Naplóbejegyzés nem található (vagy nincs jogosultságod).' });
            res.json({ message: 'Naplóbejegyzés frissítve.' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    app.delete('/api/diary/:id', async (req, res): Promise<any> => {
        try {
            const deleteResult = await db.run('DELETE FROM diary_entries WHERE id = ? AND user_id = ?', [req.params.id, DEMO_USER_ID]);
            if (deleteResult.changes === 0) return res.status(404).json({ error: 'Naplóbejegyzés nem található.' });
            res.json({ message: 'Naplóbejegyzés törölve.' });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    });

    return app;
}