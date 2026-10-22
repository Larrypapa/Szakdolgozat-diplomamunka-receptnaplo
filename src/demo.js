const fs = require('fs');
const path = require('path');

// A __dirname az aktuális mappa (src), így a vele egy mappában lévő JSON-t keresi
const adatUtvonal = path.join(__dirname, 'ingredients.json');
const nyersAdat = fs.readFileSync(adatUtvonal, 'utf8');
const alapanyagAdatbazis = JSON.parse(nyersAdat);

function receptTapertekSzamitas(receptHozzavalok, adagokSzama = 1) {
    if (adagokSzama <= 0) throw new Error("Az adagok száma csak pozitív szám lehet!");

    let osszesen = { kaloria: 0, feherje: 0, szenhidrat: 0, zsir: 0 };
    let hianyzoAdat = { kaloria: false, feherje: false, szenhidrat: false, zsir: false };

    for (const tetel of receptHozzavalok) {
        if (tetel.mennyisegGrammban < 0) throw new Error(`A mennyiség nem lehet negatív! (Hiba itt: ${tetel.alapanyag.nev})`);

        const szorzo = tetel.mennyisegGrammban / 100;
        const alapanyagAdat = tetel.alapanyag;

        ['kaloria', 'feherje', 'szenhidrat', 'zsir'].forEach(makro => {
            if (alapanyagAdat[makro] === null || alapanyagAdat[makro] === undefined) {
                hianyzoAdat[makro] = true;
            } else if (!hianyzoAdat[makro]) {
                osszesen[makro] += alapanyagAdat[makro] * szorzo;
            }
        });
    }

    let adagonkent = {};
    ['kaloria', 'feherje', 'szenhidrat', 'zsir'].forEach(makro => {
        if (hianyzoAdat[makro]) {
            osszesen[makro] = null;
            adagonkent[makro] = null; 
        } else {
            osszesen[makro] = Math.round(osszesen[makro] * 100) / 100;
            adagonkent[makro] = Math.round((osszesen[makro] / adagokSzama) * 100) / 100;
        }
    });

    return { osszesen, adagonkent, hianyzoAdat };
}

// 3. Tesztesetek
const alapanyagKereses = (id) => alapanyagAdatbazis.find(i => i.id === id);

console.log("--- 1. TESZT: Vajas rántotta (Helyes számítás, 2 adag) ---");
const normalRecept = [
    { alapanyag: alapanyagKereses("01123"), mennyisegGrammban: 150 }, // Tojás
    { alapanyag: alapanyagKereses("01001"), mennyisegGrammban: 10 },  // Vaj
    { alapanyag: alapanyagKereses("02047"), mennyisegGrammban: 2 }    // Só
];
console.dir(receptTapertekSzamitas(normalRecept, 2), { depth: null });

console.log("\n--- 2. TESZT: Feketebors hozzáadása (Hiányzó adat kezelése) ---");
const receptHianyzoAdattal = [
    ...normalRecept,
    { alapanyag: alapanyagKereses("02030"), mennyisegGrammban: 5 } // Bors (nincs szénhidrát és zsír adat)
];
const hianyosEredmeny = receptTapertekSzamitas(receptHianyzoAdattal, 2);
console.log("Eredmény (figyeld a szenhidrat és zsir értékeket, amik null-ra váltottak):");
console.dir(hianyosEredmeny, { depth: null });

console.log("\n--- 3. TESZT: Hibás bemenet (Negatív mennyiség) ---");
const hibasRecept = [
    { alapanyag: alapanyagKereses("01001"), mennyisegGrammban: -10 } 
];
try {
    receptTapertekSzamitas(hibasRecept, 1);
} catch (error) {
    console.error("Elkapott hibaüzenet:", error.message);
}