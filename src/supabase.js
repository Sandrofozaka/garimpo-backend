import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Produtos ────────────────────────────────────────────────────────────────
export async function getProducts(filters = {}) {
  let query = supabase
    .from('products')
    .select('*')
    .order('sales_month', { ascending: false })
    .limit(filters.limit || 60)

  if (filters.marketplace) query = query.eq('marketplace', filters.marketplace)
  if (filters.category)    query = query.eq('category', filters.category)
  if (filters.min_price)   query = query.gte('price', Number(filters.min_price))
  if (filters.max_price)   query = query.lte('price', Number(filters.max_price))
  if (filters.min_sales)   query = query.gte('sales_month', Number(filters.min_sales))
  if (filters.search)      query = query.ilike('name', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error
  return data || []
}

// ─── Estatísticas ─────────────────────────────────────────────────────────────
export async function getStats() {
  const { data, error } = await supabase.rpc('get_dashboard_stats')
  if (error) {
    // fallback manual
    const { data: products } = await supabase
      .from('products')
      .select('sales_month, growth_7d, est_margin')
    if (!products) return {}
    return {
      total_products:    products.length,
      total_sales_month: products.reduce((s, p) => s + (p.sales_month || 0), 0),
      best_margin:       Math.max(...products.map(p => p.est_margin || 0)),
      trending_count:    products.filter(p => (p.growth_7d || 0) > 70).length,
    }
  }
  return data?.[0] || {}
}

// ─── Favoritos ────────────────────────────────────────────────────────────────
export async function getFavorites() {
  const { data, error } = await supabase
    .from('favorites')
    .select('product_id, products(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(f => f.products).filter(Boolean)
}

export async function toggleFavorite(productId, isFav) {
  if (isFav) {
    await supabase.from('favorites').delete().eq('product_id', productId)
  } else {
    await supabase.from('favorites').insert({ product_id: productId, user_id: 'default' })
  }
}

// ─── Histórico de preços ──────────────────────────────────────────────────────
export async function getPriceHistory(productId) {
  const { data, error } = await supabase
    .from('price_history')
    .select('price, sales, recorded_at')
    .eq('product_id', productId)
    .order('recorded_at', { ascending: true })
    .limit(30)
  if (error) throw error
  return data || []
}
