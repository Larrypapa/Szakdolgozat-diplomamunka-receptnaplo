import { describe, it, expect } from 'vitest';
import { receptTapertekSzamitas, Ingredient } from '../src/utils/nutritionCalculator.js';

const mockIngredients: Ingredient[] = [
    { id: "01123", nev: "Tojás (nyers, egész)", kaloria: 143.0, feherje: 12.56, szenhidrat: 0.72, zsir: 9.51 },
    { id: "01001", nev: "Vaj (sózott)", kaloria: 717.0, feherje: 0.85, szenhidrat: 0.06, zsir: 81.11 },
    { id: "02047", nev: "Só (asztali)", kaloria: 0.0, feherje: 0.0, szenhidrat: 0.0, zsir: 0.0 },
    { id: "02030", nev: "Feketebors (őrölt)", kaloria: 251.0, feherje: 10.39, szenhidrat: null, zsir: null }
];

const getIngredient = (id: string) => mockIngredients.find(i => i.id === id);

describe('receptTapertekSzamitas (Élő Makrókalkulátor)', () => {
    it('1. Helyesen számolja ki a vajas rántottát (2 adag)', () => {
        const recept = [
            { alapanyag: getIngredient("01123"), mennyisegGrammban: 150 },
            { alapanyag: getIngredient("01001"), mennyisegGrammban: 10 },
            { alapanyag: getIngredient("02047"), mennyisegGrammban: 2 }
        ];
        
        const result = receptTapertekSzamitas(recept, 2);
        
        expect(result.osszesen.kaloria).toBe(286.2);
        expect(result.adagonkent.kaloria).toBe(143.1);
        expect(result.hianyzoAdat.kaloria).toBe(false);
        expect(result.hianyosAlapanyagok.length).toBe(0);
    });

    it('2. Hiányzó makrók null-ra propagálódnak, de a meglévő makrók pontosan kiszámolódnak (Feketebors teszt)', () => {
        const recept = [
            { alapanyag: getIngredient("01123"), mennyisegGrammban: 150 }, 
            { alapanyag: getIngredient("02030"), mennyisegGrammban: 5 }   
        ];
        
        const result = receptTapertekSzamitas(recept, 1);
        
        expect(result.osszesen.kaloria).toBe(227.05);
        expect(result.hianyzoAdat.kaloria).toBe(false);
        
        expect(result.osszesen.szenhidrat).toBeNull();
        expect(result.hianyzoAdat.szenhidrat).toBe(true);
        expect(result.ismertReszosszeg.szenhidrat).toBe(1.08); 
        
        expect(result.hianyosAlapanyagok).toContain("Feketebors (őrölt)");
    });

    it('3. Hibát dob üres lista, <=0 adag, <=0 mennyiség, vagy nem létező alapanyag esetén (API 400-as védelem)', () => {
        expect(() => receptTapertekSzamitas([], 1)).toThrow("nem tartalmaz hozzávalókat");
        expect(() => receptTapertekSzamitas([{ alapanyag: getIngredient("01123"), mennyisegGrammban: 150 }], 0)).toThrow("szigorúan pozitív");
        expect(() => receptTapertekSzamitas([{ alapanyag: getIngredient("01123"), mennyisegGrammban: 0 }], 1)).toThrow("szigorúan pozitív kell legyen");
        expect(() => receptTapertekSzamitas([{ alapanyag: undefined, mennyisegGrammban: 100 }], 1)).toThrow("Érvénytelen vagy hiányzó alapanyag");
    });
});