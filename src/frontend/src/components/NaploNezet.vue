<template>
  <div class="naplo-container">
    <h2>Étkezésnapló és Elmentett Receptek</h2>
    <p class="leiras">Itt láthatod a már rögzített recepteket, és innen tudod majd kiválasztani őket a napi naplózáshoz.</p>

    <div v-if="hiba" class="hiba-uzenet">{{ hiba }}</div>

    <div class="receptek-szekcio">
      <h3>Elmentett Receptek</h3>
      
      <div v-if="receptek.length === 0" class="ures-uzenet">
        Még nincsenek elmentett receptek. H hozz létre egyet az „Új Recept” fülön!
      </div>

      <div class="recept-grid">
        <div v-for="recept in receptek" :key="recept.id" class="recept-kartya">
          <h4>{{ recept.nev }}</h4>
          <p><strong>Alap adagszám:</strong> {{ recept.alap_adagszam }}</p>
          
          <div v-if="recept.hozzavalok && recept.hozzavalok.length > 0" class="hozzavalok-lista">
            <h5>Hozzávalók:</h5>
            <ul>
              <li v-for="(h, idx) in recept.hozzavalok" :key="idx">
                {{ h.mennyiseg_grammban }}g ({{ h.ingredient_nev || 'Alapanyag #' + h.ingredient_id }})
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import api from '../api';

const receptek = ref<any[]>([]);
const hiba = ref('');

onMounted(async () => {
  try {
    receptek.value = await api.getRecipes();
  } catch (e: any) {
    hiba.value = "Nem sikerült betölteni a elmentett recepteket a szerverről.";
  }
});
</script>

<style scoped>
.naplo-container { padding: 10px 0; }
.leiras { margin-bottom: 20px; color: #666; }
.receptek-szekcio { margin-top: 20px; }
.recept-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  margin-top: 15px;
}
.recept-kartya {
  background: #f9f9f9;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.recept-kartya h4 { margin-top: 0; margin-bottom: 8px; color: #2c3e50; }
.recept-kartya p { margin: 4px 0; font-size: 14px; color: #555; }
.recept-kartya h5 { margin: 10px 0 4px 0; font-size: 13px; color: #333; }
.recept-kartya ul { margin: 0; padding-left: 18px; font-size: 13px; color: #666; }
.ures-uzenet { color: #888; font-style: italic; margin-top: 10px; }
.hiba-uzenet { color: #d9534f; margin-bottom: 10px; font-weight: bold; }
</style>