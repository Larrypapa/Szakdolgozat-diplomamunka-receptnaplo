import { openDb } from './db/connection.js';
import { createApp } from './app.js';

const PORT = 3000;

async function startServer() {
    try {
        const db = await openDb();
        console.log('Adatbázis kapcsolat sikeres.');

        const app = createApp(db);

        app.listen(PORT, () => {
            console.log(`\nSzerver fut a http://localhost:${PORT} címen (CTRL+C a leállításhoz)\n`);
        });
    } catch (err) {
        console.error('Nem sikerült elindítani a szervert adatbázis hiba miatt:', err);
        process.exit(1);
    }
}

startServer();