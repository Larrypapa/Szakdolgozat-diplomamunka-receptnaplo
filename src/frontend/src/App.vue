<template>
  <div class="app-container">
    <header>
      <h1>Szakdoga Receptnapló (MVP2)</h1>
      <nav>
        <button @click="aktualisNezet = 'osszeallito'" :class="{ active: aktualisNezet === 'osszeallito' }">Új Recept</button>
        <button @click="aktualisNezet = 'naplo'" :class="{ active: aktualisNezet === 'naplo' }">Étkezésnapló & Lista</button>
      </nav>
    </header>

    <main>
      <ReceptOsszeallito 
        v-if="aktualisNezet === 'osszeallito'" 
        @receptMentve="aktualisNezet = 'naplo'" 
      />
      <NaploNezet 
        v-if="aktualisNezet === 'naplo'" 
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ReceptOsszeallito from './components/ReceptOsszeallito.vue';
import NaploNezet from './components/NaploNezet.vue';

const aktualisNezet = ref('osszeallito');
</script>

<style>
body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4;}
.app-container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
header { border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
nav button { margin-right: 10px; padding: 10px 15px; border: 1px solid #ccc; background: white; cursor: pointer; font-size: 16px;}
nav button.active { background: #42b983; color: white; border-color: #42b983; }
</style>