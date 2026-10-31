require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fetchML() {
  const tokenRes = await axios.post('https://api.mercadolibre.com/oauth/token', {
    grant_type: 'client_credentials',
    client_id: process.env.ML_APP_ID,
    client_secret: process.env.ML_SECRET
  });
  const token = tokenRes.data.access_token;

  const res = await axios.get('https://api.mercadolibre.com/sites/MLB/search?category=MLB1648&sort=sold_quantity_desc&limit=50', {
    headers: { Authorization: `Bearer ${token}` }
  });

  return res.data.results.map(p => ({
    external_id: p.id,
    title: p.title,
    price: p.price,
    original_price: p.original_price,
    sold_count: p.sold_quantity,
    rating: p.reviews?.rating_average || null,
    image_url: p.thumbnail,
    product_url: p.permalink,
    marketplace: 'mercadolivre',
    category: p.category_id
  }));
}

async function run() {
  console.log('Sync iniciado em', new Date().toISOString());
  try {
    const products = await fetchML();
    console.log(`ML: ${products.length} produtos coletados`);
    const { error } = await supabase.from('products').upsert(products, { onConflict: 'external_id' });
    if (error) throw error;
    console.log('Produtos salvos no Supabase!');
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

run();