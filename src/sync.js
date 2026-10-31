/**
 * sync.js — Script de sincronização standalone
 * Roda pelo GitHub Actions a cada 6 horas
 * Uso: node src/sync.js
 */

require('dotenv').config();
const { fetchAllML } = require('./scrapers/mercadolivre');
const { saveProducts } = require('./db/supabase');

async function run() {
  console.log('🚀 Garimpo Campeão — Sync iniciado em', new Date().toISOString());

  // Mercado Livre
  if (process.env.ML_APP_ID && process.env.ML_SECRET) {
    console.log('\n📦 Buscando produtos do Mercado Livre...');
    try {
      const mlProducts = await fetchAllML();
      console.log(`✅ ML: ${mlProducts.length} produtos coletados`);

      if (mlProducts.length > 0) {
        const saved = await saveProducts(mlProducts);
        console.log(`💾 ML: ${saved} produtos salvos no Supabase`);
      }
    } catch (err) {
      console.error('❌ Erro no Mercado Livre:', err.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️  ML_APP_ID ou ML_SECRET não configurados — pulando ML');
  }

  console.log('\n✅ Sync concluído em', new Date().toISOString());
}

run().catch(err => {
  console.error('❌ Sync falhou:', err);
  process.exit(1);
});
