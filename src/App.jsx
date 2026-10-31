import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  LayoutGrid, Star, TrendingUp, ShoppingBag, Search,
  SlidersHorizontal, RefreshCw, Download, X, ExternalLink,
  ChevronUp, ChevronDown, Heart, Flame, Zap, Package,
  DollarSign, BarChart2, Clock, ChevronRight, AlertCircle,
  Store, Filter
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase, getProducts, getStats, getFavorites, toggleFavorite, getPriceHistory } from './supabase'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = {
  brl: v => v == null ? '—' : `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  num: v => v == null ? '—' : Number(v).toLocaleString('pt-BR'),
  pct: v => v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`,
  date: v => v ? new Date(v).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
}

const MARKETPLACES = ['Todos', 'Mercado Livre', 'Amazon', 'Shopee']
const CATEGORIES   = ['Todas', 'Casa', 'Beleza', 'Pet', 'Carro', 'Eletrônicos', 'Moda']

function marketplaceBadge(mp) {
  if (mp === 'Mercado Livre') return 'badge badge-gold'
  if (mp === 'Amazon')        return 'badge badge-blue'
  if (mp === 'Shopee')        return 'badge badge-red'
  return 'badge badge-muted'
}

function growthColor(v) {
  if (v >= 50)  return 'var(--accent-green)'
  if (v >= 10)  return 'var(--accent-gold)'
  if (v < 0)    return 'var(--accent-red)'
  return 'var(--text-secondary)'
}

// ─── Mock data (usado quando Supabase está vazio) ─────────────────────────────
const MOCK = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  external_id: `MOCK${i}`,
  name: [
    'Organizador de Gaveta Modular', 'Escova Elétrica Rotativa', 'Coleira GPS para Pet',
    'Suporte Celular Veicular', 'Fone Bluetooth TWS', 'Kit Skincare Vitamina C',
    'Tapete Antiderrapante PVC', 'Câmera de Segurança WiFi', 'Ventilador Tower Slim',
    'Mochila Impermeável 30L', 'Lâmpada LED Smart', 'Aspirador Robô',
    'Purificador de Água', 'Jogo de Lençol 400 Fios', 'Panela Elétrica Multiuso',
    'Tênis Masculino Running', 'Bolsa Feminina Couro', 'Carregador Turbo 65W',
    'Suplemento Whey Protein', 'Livro Best-seller Autoajuda',
  ][i],
  price: [49.9, 89.9, 159, 39.9, 129, 79.9, 29.9, 189, 199, 149,
          59.9, 399, 249, 119, 89, 179, 209, 49.9, 89.9, 39.9][i],
  original_price: null,
  marketplace: ['Mercado Livre', 'Amazon', 'Shopee', 'Mercado Livre', 'Amazon',
                'Shopee', 'Mercado Livre', 'Amazon', 'Mercado Livre', 'Amazon',
                'Shopee', 'Mercado Livre', 'Amazon', 'Shopee', 'Mercado Livre',
                'Amazon', 'Shopee', 'Mercado Livre', 'Amazon', 'Shopee'][i],
  category: ['Casa', 'Beleza', 'Pet', 'Carro', 'Eletrônicos', 'Beleza', 'Casa',
             'Eletrônicos', 'Casa', 'Moda', 'Casa', 'Casa', 'Casa', 'Casa',
             'Casa', 'Moda', 'Moda', 'Eletrônicos', 'Beleza', 'Casa'][i],
  image_url: null,
  product_url: '#',
  sales_month: [8420, 5200, 3100, 7800, 4500, 6200, 9100, 2300, 3800, 4100,
                7200, 1900, 2800, 5600, 3300, 4700, 2100, 8800, 3600, 5900][i],
  growth_7d: [85, 42, -5, 120, 18, 67, 33, -12, 55, 28,
              91, 7, 45, 73, -3, 38, 14, 102, 29, 61][i],
  est_margin: [62, 45, 38, 71, 52, 58, 67, 34, 49, 55,
               43, 28, 41, 60, 36, 48, 39, 73, 44, 57][i],
  ali_price: [12, 22, 45, 9, 38, 18, 7, 60, 55, 40,
              14, 110, 70, 28, 22, 50, 60, 11, 25, 10][i],
  fetched_at: new Date().toISOString(),
}))

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

// ─── Product Card ─────────────────────────────────────────────────────────────
function ProductCard({ product, isFav, onFav, onClick }) {
  const disc = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100) : 0

  return (
    <div
      onClick={() => onClick(product)}
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-green)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      {/* Image */}
      <div style={{
        height: 160, background: 'var(--bg-hover)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Package size={40} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        )}
        {disc > 0 && (
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'var(--accent-red)', color: '#fff',
            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
          }}>-{disc}%</div>
        )}
        <button
          onClick={e => { e.stopPropagation(); onFav(product.id) }}
          style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 6,
            padding: 6, cursor: 'pointer', display: 'flex',
          }}
        >
          <Heart size={14} style={{ color: isFav ? 'var(--accent-red)' : '#fff', fill: isFav ? 'var(--accent-red)' : 'none' }} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span className={marketplaceBadge(product.marketplace)}>{product.marketplace}</span>
          <span className="badge badge-muted">{product.category}</span>
        </div>

        <p style={{
          margin: 0, fontSize: 13, fontWeight: 500, lineHeight: 1.4,
          color: 'var(--text-primary)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{product.name}</p>

        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-green)' }}>
          {fmt.brl(product.price)}
          {product.original_price && product.original_price > product.price && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: 6, fontWeight: 400 }}>
              {fmt.brl(product.original_price)}
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Stat label="Vendas/mês" value={fmt.num(product.sales_month)} />
          <Stat label="Crescimento" value={fmt.pct(product.growth_7d)}
            valueColor={growthColor(product.growth_7d)} />
          {product.ali_price && <Stat label="AliExpress" value={fmt.brl(product.ali_price)} />}
          {product.est_margin != null && <Stat label="Margem est." value={`${product.est_margin}%`}
            valueColor={product.est_margin >= 50 ? 'var(--accent-green)' : 'var(--text-primary)'} />}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, valueColor }) {
  return (
    <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: valueColor || 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

// ─── Product Modal ─────────────────────────────────────────────────────────────
function ProductModal({ product, isFav, onFav, onClose }) {
  const [tab, setTab] = useState('overview')
  const [history, setHistory] = useState([])

  useEffect(() => {
    if (tab === 'history' && product.id) {
      getPriceHistory(product.id).then(setHistory).catch(() => setHistory([]))
    }
  }, [tab, product.id])

  // Generate mock chart data if no real history
  const chartData = history.length > 0 ? history.map(h => ({
    date: new Date(h.recorded_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
    price: h.price,
    sales: h.sales,
  })) : Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i))
    const jitter = (Math.random() - 0.5) * product.price * 0.08
    return {
      date: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      price: Math.max(1, Number(product.price) + jitter).toFixed(2),
      sales: Math.round((product.sales_month / 30) * (0.7 + Math.random() * 0.6)),
    }
  })

  const disc = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100) : 0

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(4px)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 16, width: '100%', maxWidth: 680,
          maxHeight: '90vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <span className={marketplaceBadge(product.marketplace)}>{product.marketplace}</span>
              <span className="badge badge-muted">{product.category}</span>
              {disc > 0 && <span className="badge badge-red">-{disc}%</span>}
            </div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.4 }}>{product.name}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => onFav(product.id)} style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, color: isFav ? 'var(--accent-red)' : 'var(--text-secondary)',
            }}>
              <Heart size={14} style={{ fill: isFav ? 'var(--accent-red)' : 'none' }} />
            </button>
            {product.product_url && product.product_url !== '#' && (
              <a href={product.product_url} target="_blank" rel="noopener noreferrer" style={{
                background: 'var(--accent-green)', color: '#000',
                borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>
                <ExternalLink size={13} /> Ver produto
              </a>
            )}
            <button onClick={onClose} style={{
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--text-secondary)',
            }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
          {['overview', 'history', 'supplier'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '12px 16px', fontSize: 13, fontWeight: 500,
              color: tab === t ? 'var(--accent-green)' : 'var(--text-secondary)',
              borderBottom: tab === t ? '2px solid var(--accent-green)' : '2px solid transparent',
              transition: 'color 0.15s',
            }}>
              {{ overview: 'Visão Geral', history: 'Histórico', supplier: 'Fornecedor' }[t]}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                {[
                  { icon: DollarSign, label: 'Preço atual', value: fmt.brl(product.price), color: 'var(--accent-green)' },
                  { icon: BarChart2, label: 'Vendas/mês', value: fmt.num(product.sales_month), color: 'var(--accent-blue)' },
                  { icon: TrendingUp, label: 'Crescimento 7d', value: fmt.pct(product.growth_7d), color: growthColor(product.growth_7d) },
                  { icon: Zap, label: 'Margem estimada', value: product.est_margin != null ? `${product.est_margin}%` : '—', color: 'var(--accent-gold)' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} style={{
                    background: 'var(--bg-card)', borderRadius: 10,
                    padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12,
                    border: '1px solid var(--border)',
                  }}>
                    <Icon size={20} style={{ color, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {product.fetched_at && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} /> Atualizado: {fmt.date(product.fetched_at)}
                </div>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>Preço — últimos 14 dias</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} tickFormatter={v => `R$${v}`} width={50} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                      formatter={v => [fmt.brl(v), 'Preço']}
                    />
                    <Area type="monotone" dataKey="price" stroke="var(--accent-green)" strokeWidth={2} fill="url(#gPrice)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-secondary)' }}>Vendas diárias estimadas</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-gold)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--accent-gold)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} width={30} />
                    <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} formatter={v => [v, 'Vendas']} />
                    <Area type="monotone" dataKey="sales" stroke="var(--accent-gold)" strokeWidth={2} fill="url(#gSales)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {history.length === 0 && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                  * Dados simulados — histórico real acumulará após sincronizações
                </p>
              )}
            </div>
          )}

          {tab === 'supplier' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {product.ali_price ? (
                <>
                  <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 18, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Preço AliExpress estimado</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-gold)' }}>{fmt.brl(product.ali_price)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', borderRadius: 10, padding: 18, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Análise de margem</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { label: 'Preço de venda', value: fmt.brl(product.price) },
                        { label: 'Custo AliExpress', value: fmt.brl(product.ali_price) },
                        { label: 'Lucro bruto', value: fmt.brl(product.price - product.ali_price) },
                        { label: 'Margem estimada', value: product.est_margin != null ? `${product.est_margin}%` : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                          <span style={{ fontWeight: 600 }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <a
                    href={`https://pt.aliexpress.com/wholesale?SearchText=${encodeURIComponent(product.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      background: 'var(--accent-gold)', color: '#000',
                      borderRadius: 8, padding: '12px 18px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      fontWeight: 600, fontSize: 13, textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={14} /> Buscar no AliExpress
                  </a>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Package size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>Preço de fornecedor não disponível</p>
                  <a
                    href={`https://pt.aliexpress.com/wholesale?SearchText=${encodeURIComponent(product.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      marginTop: 12, color: 'var(--accent-gold)', fontSize: 13, textDecoration: 'none',
                    }}
                  >
                    <ExternalLink size={12} /> Buscar manualmente no AliExpress
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState('products') // 'products' | 'opportunities' | 'favorites'
  const [products, setProducts] = useState([])
  const [stats, setStats]       = useState({})
  const [favIds, setFavIds]     = useState(new Set())
  const [favProducts, setFavProducts] = useState([])
  const [loading, setLoading]   = useState(true)
  const [syncing, setSyncing]   = useState(false)
  const [isMock, setIsMock]     = useState(false)
  const [selected, setSelected] = useState(null)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch]         = useState('')
  const [marketplace, setMarketplace] = useState('Todos')
  const [category, setCategory]     = useState('Todas')
  const [sortBy, setSortBy]         = useState('sales_month')
  const [minPrice, setMinPrice]     = useState('')
  const [maxPrice, setMaxPrice]     = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const filters = {}
      if (marketplace !== 'Todos') filters.marketplace = marketplace
      if (category !== 'Todas')    filters.category    = category
      if (minPrice) filters.min_price = minPrice
      if (maxPrice) filters.max_price = maxPrice
      if (search)   filters.search    = search

      const [prods, st] = await Promise.all([getProducts(filters), getStats()])

      if (prods.length === 0) {
        setProducts(MOCK)
        setIsMock(true)
      } else {
        setProducts(prods)
        setIsMock(false)
      }
      setStats(st || {})
    } catch (err) {
      console.warn('Supabase não configurado — usando dados de demonstração')
      setProducts(MOCK)
      setIsMock(true)
    } finally {
      setLoading(false)
    }
  }, [marketplace, category, minPrice, maxPrice, search])

  const loadFavs = useCallback(async () => {
    try {
      const favs = await getFavorites()
      setFavProducts(favs)
      setFavIds(new Set(favs.map(f => f.id)))
    } catch { /* silencioso */ }
  }, [])

  useEffect(() => { loadData(); loadFavs() }, [loadData, loadFavs])

  const handleFav = useCallback(async (id) => {
    const isFav = favIds.has(id)
    setFavIds(prev => {
      const next = new Set(prev)
      isFav ? next.delete(id) : next.add(id)
      return next
    })
    try {
      await toggleFavorite(id, isFav)
      await loadFavs()
    } catch { /* silencioso */ }
  }, [favIds, loadFavs])

  // Sort
  const sorted = useMemo(() => {
    const list = tab === 'favorites' ? favProducts : products
    return [...list].sort((a, b) => {
      if (sortBy === 'sales_month') return (b.sales_month || 0) - (a.sales_month || 0)
      if (sortBy === 'growth_7d')   return (b.growth_7d  || 0) - (a.growth_7d  || 0)
      if (sortBy === 'price_asc')   return (a.price || 0) - (b.price || 0)
      if (sortBy === 'price_desc')  return (b.price || 0) - (a.price || 0)
      if (sortBy === 'est_margin')  return (b.est_margin || 0) - (a.est_margin || 0)
      return 0
    })
  }, [products, favProducts, tab, sortBy])

  // Opportunities: trending + good margin
  const opportunities = useMemo(() =>
    [...products]
      .filter(p => (p.growth_7d || 0) > 30 && (p.est_margin || 0) > 40)
      .sort((a, b) => ((b.growth_7d || 0) + (b.est_margin || 0)) - ((a.growth_7d || 0) + (a.est_margin || 0)))
      .slice(0, 20),
    [products]
  )

  const displayProducts = tab === 'opportunities' ? opportunities : sorted

  // CSV export
  const exportCsv = () => {
    const rows = [
      ['Nome', 'Marketplace', 'Categoria', 'Preço', 'Vendas/mês', 'Crescimento 7d', 'Margem%', 'AliExpress', 'URL'],
      ...displayProducts.map(p => [
        `"${p.name}"`, p.marketplace, p.category,
        p.price, p.sales_month, p.growth_7d,
        p.est_margin, p.ali_price, p.product_url,
      ])
    ].map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([rows], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'garimpo-campeao.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // Stats for KPI
  const kpiStats = isMock ? {
    total_products: MOCK.length,
    total_sales_month: MOCK.reduce((s, p) => s + p.sales_month, 0),
    best_margin: Math.max(...MOCK.map(p => p.est_margin)),
    trending_count: MOCK.filter(p => p.growth_7d > 70).length,
  } : stats

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 56,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--accent-green), var(--accent-gold))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>⛏</div>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Garimpo <span style={{ color: 'var(--accent-green)' }}>Campeão</span></span>
          {isMock && (
            <span className="badge badge-gold" style={{ marginLeft: 4 }}>
              <AlertCircle size={10} /> Demo
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={loadData} title="Atualizar" style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center',
          }}>
            <RefreshCw size={14} style={{ animation: loading ? 'spin 0.7s linear infinite' : 'none' }} />
          </button>
          <button onClick={exportCsv} title="Exportar CSV" style={{
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          }}>
            <Download size={14} /> CSV
          </button>
        </div>
      </header>

      <div style={{ flex: 1, padding: '24px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard icon={Package}     label="Produtos rastreados" value={fmt.num(kpiStats.total_products)}    color="var(--accent-green)" />
          <KpiCard icon={BarChart2}   label="Vendas/mês totais"   value={fmt.num(kpiStats.total_sales_month)} color="var(--accent-blue)"  />
          <KpiCard icon={Zap}         label="Melhor margem"        value={kpiStats.best_margin != null ? `${kpiStats.best_margin}%` : '—'} color="var(--accent-gold)" />
          <KpiCard icon={TrendingUp}  label="Em alta (>70%)"       value={fmt.num(kpiStats.trending_count)}   color="var(--accent-red)"   />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {[
            { key: 'products',      icon: LayoutGrid, label: 'Produtos' },
            { key: 'opportunities', icon: Flame,       label: 'Oportunidades' },
            { key: 'favorites',     icon: Heart,       label: `Favoritos${favIds.size > 0 ? ` (${favIds.size})` : ''}` },
          ].map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: 13, fontWeight: 500,
              color: tab === key ? 'var(--accent-green)' : 'var(--text-secondary)',
              borderBottom: tab === key ? '2px solid var(--accent-green)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.15s',
            }}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Filters bar */}
        {tab !== 'favorites' && (
          <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search */}
              <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 0 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  style={{
                    width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 8, padding: '9px 12px 9px 34px', fontSize: 13,
                    color: 'var(--text-primary)', outline: 'none',
                  }}
                />
              </div>

              {/* Marketplace */}
              <select value={marketplace} onChange={e => setMarketplace(e.target.value)} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)',
                cursor: 'pointer', outline: 'none',
              }}>
                {MARKETPLACES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              {/* Category */}
              <select value={category} onChange={e => setCategory(e.target.value)} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)',
                cursor: 'pointer', outline: 'none',
              }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>

              {/* Sort */}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)',
                cursor: 'pointer', outline: 'none',
              }}>
                <option value="sales_month">↓ Mais vendidos</option>
                <option value="growth_7d">↓ Maior crescimento</option>
                <option value="est_margin">↓ Maior margem</option>
                <option value="price_asc">↑ Menor preço</option>
                <option value="price_desc">↓ Maior preço</option>
              </select>

              <button onClick={() => setShowFilters(v => !v)} style={{
                background: showFilters ? 'var(--accent-green)' : 'var(--bg-card)',
                border: '1px solid var(--border)', borderRadius: 8,
                padding: '9px 14px', cursor: 'pointer',
                color: showFilters ? '#000' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
              }}>
                <SlidersHorizontal size={14} /> Filtros
              </button>
            </div>

            {showFilters && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '12px 16px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)' }}>
                {[['Preço mín R$', minPrice, setMinPrice], ['Preço máx R$', maxPrice, setMaxPrice]].map(([label, val, setter]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                    <input type="number" value={val} onChange={e => setter(e.target.value)} placeholder="0"
                      style={{
                        width: 120, background: 'var(--bg-hover)', border: '1px solid var(--border)',
                        borderRadius: 6, padding: '6px 10px', fontSize: 13,
                        color: 'var(--text-primary)', outline: 'none',
                      }} />
                  </div>
                ))}
                <button onClick={() => { setMinPrice(''); setMaxPrice(''); setSearch(''); setMarketplace('Todos'); setCategory('Todas') }}
                  style={{ alignSelf: 'flex-end', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 12px', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Limpar tudo
                </button>
              </div>
            )}
          </div>
        )}

        {/* Products grid */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner" />
          </div>
        ) : displayProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Package size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p>Nenhum produto encontrado.</p>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              {displayProducts.length} produtos
              {tab === 'opportunities' && ' com crescimento acima de 30% e margem acima de 40%'}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 16,
            }}>
              {displayProducts.map(p => (
                <ProductCard
                  key={p.id || p.external_id}
                  product={p}
                  isFav={favIds.has(p.id)}
                  onFav={handleFav}
                  onClick={setSelected}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {selected && (
        <ProductModal
          product={selected}
          isFav={favIds.has(selected.id)}
          onFav={handleFav}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
