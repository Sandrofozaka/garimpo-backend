require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const { fetchAllML }     = require('./scrapers/mercadolivre');
const { fetchAllAmazon } = require('./scrapers/amazon');
const { saveProducts, getProducts, getStats } = require('./db/supabase');

const app = express();
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// ROTAS DA API
// ─────────────────────────────────────────────

// Saúde do servidor
app.get('/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Retorna produtos (com filtros opcionais)
// GET /api/products?marketplace=Mercado+Livre&category=Casa&min_sales=1000
app.get('/api/products', async (req, res) => {
  try {
    const filters = {
      marketplace: req.query.marketplace,
      category:    req.query.category,
      min_price:   req.query.min_price   ? +req.query.min_price   : undefined,
      max_price:   req.query.max_price   ? +req.query.max_price   : undefined,
      min_sales:   req.query.min_sales   ? +req.query.min_sales   : undefined,
      search:      req.query.search,
      limit:       req.query.limit       ? +req.query.limit        : 50,
    };
    const products = await getProducts(filters);
    res.json({ ok: true, count: products.length, data: products });
  } catch (err) {
    console.error('[/api/products]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Estatísticas do dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json({ ok: true, data: stats });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Dispara coleta manual (útil para testar)
app.post('/api/sync', async (req, res) => {
  const secret = req.headers['x-sync-secret'];
  if (secret !== process.env.SYNC_SECRET && process.env.NODE_ENV === 'production') {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  res.json({ ok: true, message: 'Sync iniciado em background' });
  runSync(); // não aguarda — responde imediato
});

// ─────────────────────────────────────────────
// SINCRONIZAÇÃO
// ─────────────────────────────────────────────

let syncRunning = false;

async function runSync() {
  if (syncRunning) {
    console.log('[sync] Já rodando, pulando...');
    return;
  }
  syncRunning = true;
  const start = Date.now();
  console.log(`\n[sync] ===== Iniciando sync ${new Date().toLocaleString('pt-BR')} =====`);

  try {
    // Mercado Livre
    console.log('[sync] Buscando Mercado Livre...');
    const mlProducts = await fetchAllML();
    console.log(`[sync] ML: ${mlProducts.length} produtos encontrados`);

    // Amazon
    console.log('[sync] Buscando Amazon...');
    const amzProducts = await fetchAllAmazon();
    console.log(`[sync] Amazon: ${amzProducts.length} produtos encontrados`);

    const allProducts = [...mlProducts, ...amzProducts];
    if (allProducts.length > 0) {
      await saveProducts(allProducts);
      console.log(`[sync] ✅ ${allProducts.length} produtos salvos no Supabase`);
    }
  } catch (err) {
    console.error('[sync] ❌ Erro:', err.message);
  } finally {
    syncRunning = false;
    console.log(`[sync] Finalizado em ${((Date.now()-start)/1000).toFixed(1)}s\n`);
  }
}

// ─────────────────────────────────────────────
// CRON: a cada 6 horas
// ─────────────────────────────────────────────
// 0 */6 * * *  = meia-noite, 6h, 12h, 18h
cron.schedule('0 */6 * * *', () => {
  console.log('[cron] Disparando sync agendado...');
  runSync();
}, { timezone: 'America/Sao_Paulo' });

// ─────────────────────────────────────────────
// INICIAR
// ─────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`\n🛒 Garimpo Campeão Backend rodando na porta ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Produtos: http://localhost:${PORT}/api/products`);

  // Primeira sincronização ao subir (com delay de 3s pra DB conectar)
  setTimeout(runSync, 3000);
});
