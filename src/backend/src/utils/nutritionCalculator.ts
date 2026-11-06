export interface Macros {
    kaloria: number | null;
    feherje: number | null;
    szenhidrat: number | null;
    zsir: number | null;
}

export interface Ingredient extends Macros {
    id: string;
    nev: string;
}

export interface RecipeItem {
    alapanyag: Ingredient | undefined;
    mennyisegGrammban: number;
}

export interface CalculationResult {
    osszesen: Macros;
    adagonkent: Macros;
    ismertReszosszeg: Macros;
    ismertAdagonkent: Macros;
    hianyzoAdat: {
        kaloria: boolean;
        feherje: boolean;
        szenhidrat: boolean;
        zsir: boolean;
    };
    hianyosAlapanyagok: string[];
}

export function receptTapertekSzamitas(receptHozzavalok: RecipeItem[], adagokSzama: number = 1): CalculationResult {
    if (!Array.isArray(receptHozzavalok) || receptHozzavalok.length === 0) {
        throw new Error("A recept nem tartalmaz hozzávalókat!");
    }
    if (adagokSzama <= 0) {
        throw new Error("Az adagok száma csak szigorúan pozitív szám lehet!");
    }

    const nyersOsszesen = { kaloria: 0, feherje: 0, szenhidrat: 0, zsir: 0 };
    const hianyzoAdat = { kaloria: false, feherje: false, szenhidrat: false, zsir: false };
    const hianyosAlapanyagokSet = new Set<string>();

    const makrok: (keyof Macros)[] = ['kaloria', 'feherje', 'szenhidrat', 'zsir'];

    for (const tetel of receptHozzavalok) {
        if (!tetel.alapanyag) {
            throw new Error("Érvénytelen vagy hiányzó alapanyag a receptben!");
        }
        if (tetel.mennyisegGrammban <= 0) {
            throw new Error(`A mennyiség szigorúan pozitív kell legyen! (Hiba itt: ${tetel.alapanyag.nev})`);
        }

        const szorzo = tetel.mennyisegGrammban / 100;
        let hasMissingMacro = false;

        for (const makro of makrok) {
            const ertek = tetel.alapanyag[makro];
            if (ertek === null || ertek === undefined) {
                hianyzoAdat[makro] = true;
                hasMissingMacro = true;
            } else {
                nyersOsszesen[makro] += (ertek as number) * szorzo;
            }
        }

        if (hasMissingMacro) {
            hianyosAlapanyagokSet.add(tetel.alapanyag.nev);
        }
    }

    const osszesen: Macros = { kaloria: null, feherje: null, szenhidrat: null, zsir: null };
    const adagonkent: Macros = { kaloria: null, feherje: null, szenhidrat: null, zsir: null };
    const ismertReszosszeg: Macros = { kaloria: null, feherje: null, szenhidrat: null, zsir: null };
    const ismertAdagonkent: Macros = { kaloria: null, feherje: null, szenhidrat: null, zsir: null };

    const round = (num: number) => Math.round(num * 100) / 100;

    // Kerekítés csak a legvégén, és az adagonkénti értéket is a nyers összegből számoljuk
    for (const makro of makrok) {
        const reszosszeg = nyersOsszesen[makro];
        const adagErtek = reszosszeg / adagokSzama;

        ismertReszosszeg[makro] = round(reszosszeg);
        ismertAdagonkent[makro] = round(adagErtek);

        if (hianyzoAdat[makro]) {
            osszesen[makro] = null;
            adagonkent[makro] = null;
        } else {
            osszesen[makro] = ismertReszosszeg[makro];
            adagonkent[makro] = ismertAdagonkent[makro];
        }
    }

    return {
        osszesen,
        adagonkent,
        ismertReszosszeg,
        ismertAdagonkent,
        hianyzoAdat,
        hianyosAlapanyagok: Array.from(hianyosAlapanyagokSet)
    };
}