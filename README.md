# Receptnapló

Receptmegosztó és étkezésnapló webalkalmazás automatikus tápérték-számítással.


**Szerző:** [Larbak Bence]
**Témavezető:** [Bilicki Vilmos]

## Probléma és cél

A meglévő receptoldalakon a tápértékadatok általában kézzel megadottak, ezért
megbízhatatlanok, a naplózó alkalmazások pedig ritkán magyar nyelvűek vagy
ingyenesek. A projekt célja egy magyar nyelvű webalkalmazás, ahol a felhasználók
recepteket oszthatnak meg, és a rendszer a hozzávalókból automatikusan kiszámolja
a kalória-, fehérje-, szénhidrát- és zsírtartalmat.

## Tervezett funkciók

- [ ] Regisztráció, bejelentkezés (felhasználó és admin szerepkör)
- [ ] Hozzávaló-adatbázis nyílt adatforrásból
- [ ] Recept létrehozása hozzávalókból, mértékegység-átváltással
- [ ] Automatikus tápérték-számítás (teljes recept és egy adag)
- [ ] Receptlista, receptoldal, megosztás
- [ ] Keresés és szűrés (név, kalória, fehérje)

[2026. Október 22.] - Mérföldkő 1: Alapanyagok és számítási logika

Adatforrás: Szűkített, 10 elemes USDA SR Legacy adatbázis statikus JSON fájlként importálva, a reprodukálhatóság garantálása érdekében.

Számítási elvek: Teljes recept és adagszám szerinti, gramm alapú lineáris arányosítás valósult meg.

Kritikus adatkezelési döntés: A hiányzó (null) tápértékkel rendelkező alapanyagok "fertőzik" a végeredményt. Ha egy hozzávalóból hiányzik a zsír adat, a teljes recept zsírtartalma is null (hiányos) lesz. Ez a szigorú kezelés védi az étkezésnapló napi összesítésének megbízhatóságát, elkerülve a hamis részösszegeket.

Validáció: A negatív bemenetekre és nullával való osztásra a rendszer egyértelmű hibát dob. Egy teszt recept ("Vajas rántotta") gépi és kézi számításának eredménye megegyezett.


## [2026. November] – MVP2: Frontend architektúra, Élő Kalkulátor és Receptlista

* **Vue 3 Komponensstruktúra:** Bevezetésre került a `ReceptOsszeallito.vue` és a `NaploNezet.vue`, valamint az Axios alapú API kommunikációs réteg (`api.ts`).
* **Élő Makrókalkulátor:** Interaktív komponens, amely valós időben kalkulálja a felvett hozzávalók tömege alapján a makrókat, figyelmeztetve a hiányos tápértékű alapanyagokra.
* **Listázás és Navigáció:** A mentett receptek dinamikus megjelenítése kártyás nézetben az étkezésnapló felületén.
