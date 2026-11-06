<template>
  <div class="osszeallito-content">
    <h2>Új Recept Összeállítása</h2>
    
    <div class="form-grid">
      <div class="form-group">
        <label>Recept neve:</label>
        <input v-model="nev" type="text" placeholder="pl. Vajas rántotta" />
      </div>
      
      <div class="form-group adag-group">
        <label>Alap adagszám:</label>
        <input v-model.number="alap_adagszam" type="number" min="1" />
      </div>
    </div>

    <h3>Hozzávalók</h3>
    <div class="hozzavalok-lista">
      <div v-for="(h, index) in hozzavalok" :key="index" class="hozzavalo-sor">
        <select v-model="h.ingredient_id" class="input-alapanyag">
          <option value="" disabled>Válassz alapanyagot...</option>
          <option v-for="a in alapanyagok" :key="a.id" :value="a.id">
            {{ a.nev }}
          </option>
        </select>
        
        <input v-model.number="h.mennyiseg_grammban" type="number" placeholder="Gramm" min="1" class="input-gramm" />
        <button @click="torolHozzavalo(index)" class="btn-danger">Törlés</button>
      </div>
    </div>
    
    <button @click="ujHozzavalo" class="btn-secondary">+ Hozzávaló hozzáadása</button>

    <div class="elo-kalkulacio" v-if="hozzavalok.length > 0">
      <h4>Élő Makrókalkulátor (Teljes receptre)</h4>
      <ul class="makro-grid">
        <li><strong>Kalória:</strong> {{ eloKalkulacio.kaloria }} kcal</li>
        <li><strong>Fehérje:</strong> {{ eloKalkulacio.feherje }} g</li>
        <li>
          <strong>Szénhidrát:</strong> 
          <span v-if="eloKalkulacio.hianyzo.szenhidrat" class="figyelmeztetes">
            min. {{ eloKalkulacio.szenhidrat }} g (Hiányzó adat!)
          </span>
          <span v-else>{{ eloKalkulacio.szenhidrat }} g</span>
        </li>
        <li>
          <strong>Zsír:</strong> 
          <span v-if="eloKalkulacio.hianyzo.zsir" class="figyelmeztetes">
            min. {{ eloKalkulacio.zsir }} g (Hiányzó adat!)
          </span>
          <span v-else>{{ eloKalkulacio.zsir }} g</span>
        </li>
      </ul>
      <p v-if="eloKalkulacio.hianyosAlapanyagok.length > 0" class="figyelmeztetes hianyos-szöveg">
        Hiányos adattal rendelkező alapanyagok: {{ eloKalkulacio.hianyosAlapanyagok.join(', ') }}
      </p>
    </div>

    <div class=" akcio-gombok">
      <button @click="mentes" class="btn-primary" :disabled="mentesFolyamatban">Recept Mentése</button>
    </div>
    
    <p v-if="hiba" class="hiba-uzenet">{{ hiba }}</p>
    <p v-if="siker" class="siker-uzenet">{{ siker }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api from '../api';

const alapanyagok = ref<any[]>([]);
const nev = ref('');
const alap_adagszam = ref(1);
const hozzavalok = ref([{ ingredient_id: '', mennyiseg_grammban: 100 }]);

const hiba = ref('');
const siker = ref('');
const mentesFolyamatban = ref(false);

const emit = defineEmits(['receptMentve']);

onMounted(async () => {
  try {
    alapanyagok.value = await api.getIngredients();
  } catch (e: any) {
    hiba.value = "Nem sikerült betölteni az alapanyagokat.";
  }
});

const ujHozzavalo = () => {
  hozzavalok.value.push({ ingredient_id: '', mennyiseg_grammban: 100 });
};

const torolHozzavalo = (index: number) => {
  hozzavalok.value.splice(index, 1);
};

const eloKalkulacio = computed(() => {
  let kaloria = 0, feherje = 0, szenhidrat = 0, zsir = 0;
  let hianyzo = { kaloria: false, feherje: false, szenhidrat: false, zsir: false };
  let hianyosAlapanyagok = new Set<string>();

  hozzavalok.value.forEach(h => {
    const alapanyag = alapanyagok.value.find(a => a.id === h.ingredient_id);
    if (!alapanyag || !h.mennyiseg_grammban) return;

    const szorzo = h.mennyiseg_grammban / 100;
    
    ['kaloria', 'feherje', 'szenhidrat', 'zsir'].forEach(makro => {
      if (alapanyag[makro] === null || alapanyag[makro] === undefined) {
        hianyzo[makro as keyof typeof hianyzo] = true;
        hianyosAlapanyagok.add(alapanyag.nev);
      } else {
        if (makro === 'kaloria') kaloria += alapanyag.kaloria * szorzo;
        if (makro === 'feherje') feherje += alapanyag.feherje * szorzo;
        if (makro === 'szenhidrat') szenhidrat += alapanyag.szenhidrat * szorzo;
        if (makro === 'zsir') zsir += alapanyag.zsir * szorzo;
      }
    });
  });

  return {
    kaloria: (Math.round(kaloria * 100) / 100).toFixed(2),
    feherje: (Math.round(feherje * 100) / 100).toFixed(2),
    szenhidrat: (Math.round(szenhidrat * 100) / 100).toFixed(2),
    zsir: (Math.round(zsir * 100) / 100).toFixed(2),
    hianyzo,
    hianyosAlapanyagok: Array.from(hianyosAlapanyagok)
  };
});

const mentes = async () => {
  hiba.value = ''; siker.value = '';
  mentesFolyamatban.value = true;
  try {
    await api.createRecipe({
      nev: nev.value,
      alap_adagszam: alap_adagszam.value,
      hozzavalok: hozzavalok.value
    });
    siker.value = "Recept sikeresen mentve!";
    nev.value = '';
    hozzavalok.value = [{ ingredient_id: '', mennyiseg_grammban: 100 }];
    alap_adagszam.value = 1;
    emit('receptMentve');
  } catch (e: any) {
    hiba.value = e.response?.data?.error || "Hiba történt a mentés során.";
  } finally {
    mentesFolyamatban.value = false;
  }
};
</script>

<style scoped>
.osszeallito-content { 
  padding: 10px 0; 
}
h2 { margin-bottom: 20px; font-size: 22px; }
h3 { margin: 25px 0 12px 0; font-size: 18px; border-bottom: 1px solid #eee; padding-bottom: 5px; }

.form-grid {
  display: flex;
  gap: 20px;
}
.form-group { 
  margin-bottom: 15px; 
  flex: 1;
}
.form-group.adag-group {
  max-width: 150px;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  color: #333;
}
.form-group input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 15px;
  box-sizing: border-box;
}

.hozzavalo-sor { 
  display: flex; 
  gap: 10px; 
  margin-bottom: 10px; 
  align-items: center;
}
.input-alapanyag {
  flex: 3;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
  font-size: 15px;
}
.input-gramm {
  flex: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 15px;
}

.btn-primary { background: #42b983; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; width: 100%; margin-top: 15px;}
.btn-primary:hover { background: #3aa876; }
.btn-secondary { background: #f0f0f0; color: #333; border: 1px solid #ccc; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-size: 14px; margin-top: 5px;}
.btn-secondary:hover { background: #e4e4e4; }
.btn-danger { background: #ff4d4d; color: white; border: none; padding: 10px 14px; border-radius: 6px; cursor: pointer; }
.btn-danger:hover { background: #e04343; }

.elo-kalkulacio { 
  background: #f8f9fa; 
  padding: 15px 20px; 
  margin: 20px 0; 
  border-radius: 8px;
  border-left: 5px solid #42b983; 
  border: 1px solid #e9ecef;
}
.elo-kalkulacio h4 { margin-top: 0; margin-bottom: 10px; color: #2c3e50; }
.makro-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.makro-grid li {
  font-size: 15px;
  color: #495057;
}

.figyelmeztetes { color: #e67e22; font-weight: bold; }
.hianyos-szöveg { margin-top: 10px; font-size: 14px; }
.hiba-uzenet { color: #d9534f; margin-top: 10px; font-weight: bold; }
.siker-uzenet { color: #5cb85c; margin-top: 10px; font-weight: bold; }
</style>
[cite: 19, 22, 24]