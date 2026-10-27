'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PhoneCall,
  ShoppingBag,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Users,
  Target,
  Share2,
  ShieldCheck,
  Server,
  Zap,
  Filter,
  Download,
  Calendar,
  ExternalLink,
  ChevronRight,
  Info,
  Radio,
  RefreshCw,
  Eye,
  Check,
  Copy,
  Terminal,
} from 'lucide-react';
import { logiStore } from '@/lib/store';

interface UTMRow {
  source: string;
  sourceType: 'facebook' | 'tiktok' | 'google' | 'organic';
  campaign: string;
  clicks: number;
  checkouts: number;
  orders: number;
  confirmed: number;
  conversionRate: string;
  revenue: number;
  spend: number;
  roas: string;
}

const UTM_DATA: UTMRow[] = [
  {
    source: 'Facebook Ads',
    sourceType: 'facebook',
    campaign: 'fb_retargeting_titan_pro_v3',
    clicks: 14200,
    checkouts: 1350,
    orders: 580,
    confirmed: 504,
    conversionRate: '4.08%',
    revenue: 69540000,
    spend: 14200000,
    roas: '4.89x',
  },
  {
    source: 'TikTok Ads',
    sourceType: 'tiktok',
    campaign: 'tt_spark_creators_unboxing',
    clicks: 18900,
    checkouts: 1420,
    orders: 490,
    confirmed: 402,
    conversionRate: '2.59%',
    revenue: 58750000,
    spend: 12500000,
    roas: '4.70x',
  },
  {
    source: 'Google Search Ads',
    sourceType: 'google',
    campaign: 'g_search_reloj_contraentrega',
    clicks: 8400,
    checkouts: 710,
    orders: 260,
    confirmed: 228,
    conversionRate: '3.10%',
    revenue: 33280000,
    spend: 6800000,
    roas: '4.89x',
  },
  {
    source: 'Instagram Orgánico',
    sourceType: 'organic',
    campaign: 'reels_viral_resistencia_agua',
    clicks: 6750,
    checkouts: 380,
    orders: 152,
    confirmed: 120,
    conversionRate: '2.25%',
    revenue: 18270000,
    spend: 0,
    roas: '∞ Org.',
  },
];

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d' | 'month'>('30d');
  const [selectedChannel, setSelectedChannel] = useState<string>('all');
  const [isSimulatingEvent, setIsSimulatingEvent] = useState(false);
  const [simulationResponse, setSimulationResponse] = useState<any | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Formatter for Colombian Pesos
  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const sampleCapiPayload = {
    event_name: 'Purchase',
    event_time: Math.floor(Date.now() / 1000),
    event_id: 'LP_ORD_9821_CAPI',
    event_source_url: 'https://smartwatch.mitienda.co/titan-pro',
    action_source: 'website',
    user_data: {
      em: '2a4b8...fe90c (SHA-256)',
      ph: '6b12a...98df1 (SHA-256)',
      fn: '1e58a...33cd8 (SHA-256)',
      ct: '5029a...88ff2 (SHA-256)',
      client_ip_address: '181.134.12.90',
      client_user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4)...',
      fbp: 'fb.1.1719842109.9823412',
      fbc: 'fb.1.1719842109.IwAR34...',
    },
    custom_data: {
      currency: 'COP',
      value: 249900,
      content_type: 'product',
      contents: [{ id: 'lp-titan-pro-01', quantity: 3, item_price: 83300 }],
      delivery_category: 'cash_on_delivery',
      ai_confirmed: true,
      confirmation_agent: 'Valentina Neural Voice',
    },
  };

  const handleSimulateCAPI = () => {
    setIsSimulatingEvent(true);
    setSimulationResponse(null);

    setTimeout(() => {
      setSimulationResponse({
        status: '200 OK',
        endpoint: 'https://graph.facebook.com/v19.0/{pixel_id}/events',
        events_received: 1,
        messages: [],
        fbtrace_id: 'Fbx98' + Math.random().toString(36).substring(2, 9),
        deduplication_status: 'verified_unique (no collision with browser pixel)',
        emq_score: '9.4 / 10 (High Quality Attribution)',
        timestamp: new Date().toLocaleTimeString(),
      });
      setIsSimulatingEvent(false);
    }, 900);
  };

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(JSON.stringify(sampleCapiPayload, null, 2));
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const filteredUtmData =
    selectedChannel === 'all'
      ? UTM_DATA
      : UTM_DATA.filter((row) => row.sourceType === selectedChannel);

  const totalClicks = UTM_DATA.reduce((a, b) => a + b.clicks, 0);
  const totalOrders = UTM_DATA.reduce((a, b) => a + b.orders, 0);
  const totalRevenue = UTM_DATA.reduce((a, b) => a + b.revenue, 0);
  const totalConfirmed = UTM_DATA.reduce((a, b) => a + b.confirmed, 0);

  return (
    <div className="space-y-6">
      {/* Top Banner & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Rendimiento de tus ventas
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Conversión de tus landings, confirmaciones por IA y resultados por campaña.
          </p>
        </div>

        {/* Time Filter & Export */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === '7d' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              7 Días
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === '30d' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              30 Días
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                timeRange === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
              }`}
            >
              Este Mes
            </button>
          </div>

          <button
            onClick={() => alert('Descarga de reporte consolidado en CSV iniciada')}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* 6 Key Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: Total Pedidos */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Total Pedidos</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">1,482</div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-2">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+18.4% vs mes ant.</span>
          </div>
        </div>

        {/* Card 2: Pedidos Confirmados por IA */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Confirmados IA</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">1,254</div>
          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>84.6% de efectividad</span>
          </div>
        </div>

        {/* Card 3: Tasa de Confirmación */}
        <div className="bg-gradient-to-br from-white to-orange-50/40 rounded-2xl p-5 border border-orange-200/60 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold text-orange-950">
              Tasa Confirmación
            </span>
            <div className="p-2 rounded-lg bg-orange-100 text-brand-orange">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-brand-orange">84.6%</div>
          <div className="text-xs font-semibold text-slate-600 mt-2">
            +14.2% vs llamadas manuales
          </div>
        </div>

        {/* Card 4: Ingresos Proyectados */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Ingresos Facturados</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">$179.8M</div>
          <div className="text-xs font-semibold text-slate-500 mt-2">
            Ticket prom: $121,340
          </div>
        </div>

        {/* Card 5: Llamadas IA Realizadas */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Llamadas IA</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">1,620</div>
          <div className="text-xs font-semibold text-purple-700 mt-2">
            Duración prom: 48s
          </div>
        </div>

        {/* Card 6: Tiempo Promedio de Respuesta */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold">Tiempo Respuesta</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">1.8 min</div>
          <div className="text-xs font-semibold text-emerald-600 mt-2">
            Instantáneo post-checkout
          </div>
        </div>
      </div>

      {/* Grid: Conversion Funnel & Call Center IA Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Visual Conversion Funnel (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Embudo de Conversión & Despacho COD
                </h3>
                <p className="text-xs text-slate-500">
                  Flujo de compra desde la visita a la landing hasta el paquete despachado con guía.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Retención Final: 80.4%
              </span>
            </div>

            {/* Funnel Steps */}
            <div className="space-y-4 my-4">
              {/* Step 1: Visitas */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[11px]">
                      1
                    </span>
                    Visitas a Landing Pages
                  </span>
                  <span className="text-slate-900 font-bold">48,250 (100%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-slate-400 h-full rounded-full transition-all duration-500"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              {/* Step 2: Checkout Iniciado */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[11px]">
                      2
                    </span>
                    Formulario / Checkout Iniciado
                  </span>
                  <span className="text-slate-900 font-bold">
                    3,860 <span className="text-slate-400 font-normal">(8.0% visitas)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full transition-all duration-500"
                    style={{ width: '55%' }}
                  />
                </div>
              </div>

              {/* Step 3: Pedido Creado */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[11px]">
                      3
                    </span>
                    Pedido Creado en Sistema (COD)
                  </span>
                  <span className="text-slate-900 font-bold">
                    1,482 <span className="text-slate-400 font-normal">(38.4% formularios)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: '38%' }}
                  />
                </div>
              </div>

              {/* Step 4: Confirmado por Voz IA */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-emerald-700 flex items-center gap-2 font-bold">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[11px]">
                      4
                    </span>
                    Confirmado por Valentina IA (Voz)
                  </span>
                  <span className="text-emerald-700 font-bold">
                    1,254 <span className="text-emerald-600 font-medium">(84.6% confirmación)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
                    style={{ width: '32%' }}
                  />
                </div>
              </div>

              {/* Step 5: Despachado */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1">
                  <span className="text-slate-700 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[11px]">
                      5
                    </span>
                    Guía Generada & Despacho Efectivo
                  </span>
                  <span className="text-slate-900 font-bold">
                    1,192 <span className="text-slate-400 font-normal">(95.1% de confirmados)</span>
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-slate-900 h-full rounded-full transition-all duration-500"
                    style={{ width: '30%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Savings / COD Profit protection callout */}
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Ahorro en Devoluciones & Fletes:</span> Al filtrar
              pedidos falsos y corroborar direcciones con Valentina IA, se evitaron{' '}
              <strong>228 devoluciones en bodega</strong>, ahorrando aproximadamente{' '}
              <strong>$4,560,000 COP</strong> en fletes perdidos este mes.
            </div>
          </div>
        </div>

        {/* Right: Call Center IA Performance (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rendimiento de Call Center IA
                </h3>
                <p className="text-xs text-slate-500">
                  Resultados del bot telefónico (Valentina Neural)
                </p>
              </div>
              <div className="p-2 rounded-lg bg-red-50 text-brand-red">
                <PhoneCall className="w-4 h-4" />
              </div>
            </div>

            {/* Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs font-semibold text-slate-500">Llamadas Contestadas</div>
                <div className="text-2xl font-bold text-slate-900 mt-0.5">88%</div>
                <div className="text-[11px] text-emerald-600 font-medium">1,425 llamadas</div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs font-semibold text-emerald-800">
                  Confirmada en 1er Intento
                </div>
                <div className="text-2xl font-bold text-emerald-700 mt-0.5">72%</div>
                <div className="text-[11px] text-emerald-700 font-medium">Sin esperas</div>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-xs font-semibold text-amber-800">
                  Rescatadas en Reintento
                </div>
                <div className="text-2xl font-bold text-amber-700 mt-0.5">18%</div>
                <div className="text-[11px] text-amber-700 font-medium">+45 min post-fallo</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="text-xs font-semibold text-slate-500">Canceladas / Descarte</div>
                <div className="text-2xl font-bold text-slate-700 mt-0.5">6%</div>
                <div className="text-[11px] text-slate-500 font-medium">Cliente se arrepintió</div>
              </div>
            </div>

            {/* Sentiment Meter */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">
                Sentimiento del Cliente Detectado por IA
              </div>
              <div className="flex h-3 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: '86%' }}
                  title="Positivo (86%)"
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: '9%' }}
                  title="Dudas / Preguntas (9%)"
                />
                <div
                  className="bg-red-400 transition-all"
                  style={{ width: '5%' }}
                  title="Rechazo (5%)"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-medium">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 86% Aceptación Total
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> 9% Con Preguntas
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400"></span> 5% Rechazo
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Proveedor de Voz: Neural LatAm HD</span>
            <span className="font-semibold text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Sistema
              Operativo
            </span>
          </div>
        </div>
      </div>

      {/* UTM Campaigns Attribution Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Atribución de Ventas por Campañas & Canales UTM
              </h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-brand-red/10 text-brand-red">
                Pixel + CAPI Server
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Identifica exactamente qué anuncio de Meta, TikTok o Google generó los pedidos más rentables.
            </p>
          </div>

          {/* Channel Filter Pill Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'facebook', label: 'Facebook' },
              { id: 'tiktok', label: 'TikTok' },
              { id: 'google', label: 'Google' },
              { id: 'organic', label: 'Orgánico' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedChannel(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  selectedChannel === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-bold text-slate-500">
                <th className="py-3 px-5">Canal / Fuente</th>
                <th className="py-3 px-4">Campaña UTM</th>
                <th className="py-3 px-4 text-right">Clics</th>
                <th className="py-3 px-4 text-right">Pedidos</th>
                <th className="py-3 px-4 text-right">Confirmados</th>
                <th className="py-3 px-4 text-right">Tasa Conv.</th>
                <th className="py-3 px-4 text-right">Inversión (Spend)</th>
                <th className="py-3 px-4 text-right">Facturación Total</th>
                <th className="py-3 px-5 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredUtmData.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-5 font-bold text-slate-900">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          row.sourceType === 'facebook'
                            ? 'bg-blue-600'
                            : row.sourceType === 'tiktok'
                            ? 'bg-black'
                            : row.sourceType === 'google'
                            ? 'bg-red-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span>{row.source}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                    {row.campaign}
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                    {row.clicks.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                    {row.orders}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                    {row.confirmed}
                  </td>
                  <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                    {row.conversionRate}
                  </td>
                  <td className="py-3.5 px-4 text-right text-slate-500">
                    {row.spend > 0 ? formatCOP(row.spend) : '$0'}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {formatCOP(row.revenue)}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {row.roas}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Table Footer Totals */}
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-xs text-slate-900">
                <td className="py-3.5 px-5">Total Consolidado</td>
                <td className="py-3.5 px-4 text-slate-500">4 Fuentes</td>
                <td className="py-3.5 px-4 text-right">{totalClicks.toLocaleString()}</td>
                <td className="py-3.5 px-4 text-right">{totalOrders}</td>
                <td className="py-3.5 px-4 text-right text-emerald-600">{totalConfirmed}</td>
                <td className="py-3.5 px-4 text-right">3.07%</td>
                <td className="py-3.5 px-4 text-right">{formatCOP(33500000)}</td>
                <td className="py-3.5 px-4 text-right font-bold">{formatCOP(totalRevenue)}</td>
                <td className="py-3.5 px-5 text-right font-bold text-emerald-700">5.36x</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Meta Pixel & CAPI & GA4 Real-time Status Monitor Cards */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                Monitor en Tiempo Real: Meta CAPI, Browser Pixel & GA4
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Doble capa de rastreo (Server-side + Client-side) para evadir bloqueadores de anuncios y garantizar 100% de match de compra.
            </p>
          </div>

          <button
            onClick={handleSimulateCAPI}
            disabled={isSimulatingEvent}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-gradient hover:opacity-95 text-white font-bold rounded-xl text-xs transition transform active:scale-95 disabled:opacity-50 self-start md:self-auto"
          >
            {isSimulatingEvent ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Simulando CAPI...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 text-amber-200 fill-amber-200" />
                <span>Simular Evento CAPI Verificado</span>
              </>
            )}
          </button>
        </div>

        {/* 4 Integration Status Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Meta CAPI */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600">Meta Conversions API</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                ACTIVO
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">9.4 / 10 EMQ</div>
            <p className="text-xs text-slate-500 mt-1">
              Event Match Quality excelente con SHA-256 de teléfono y correo.
            </p>
          </div>

          {/* Meta Browser Pixel */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600">Meta Browser Pixel</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                SINCRONIZADO
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">Deduplicación OK</div>
            <p className="text-xs text-slate-500 mt-1">
              Usa <code className="text-amber-600">event_id</code> idéntico para evitar duplicidad de compras.
            </p>
          </div>

          {/* Google Analytics 4 */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600">GA4 Measurement Protocol</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                CONECTADO
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">Enhanced Ecommerce</div>
            <p className="text-xs text-slate-500 mt-1">
              Stream web y compras registradas con valor en COP.
            </p>
          </div>

          {/* TikTok Events API */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-700/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-600">TikTok Events API</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-600 border border-blue-500/30">
                EN LÍNEA
              </span>
            </div>
            <div className="text-lg font-bold text-slate-900">PlaceAnOrder</div>
            <p className="text-xs text-slate-500 mt-1">
              Optimización de Spark Ads con webhook de servidor.
            </p>
          </div>
        </div>

        {/* Live Payload Viewer / Simulation Result Drawer */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 font-mono text-xs">
          <div className="flex items-center justify-between mb-3 text-slate-500 border-b border-slate-200 pb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-600" />
              <span className="text-slate-700 font-bold">
                Payload de Ejemplo CAPI (Server-Side Verified Event)
              </span>
            </div>
            <button
              onClick={handleCopyPayload}
              className="flex items-center gap-1 text-xs hover:text-slate-900 transition"
            >
              {copiedPayload ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar JSON</span>
                </>
              )}
            </button>
          </div>

          <pre className="text-slate-700 overflow-x-auto p-3 bg-white border border-slate-200 rounded-lg text-xs leading-relaxed">
            {JSON.stringify(sampleCapiPayload, null, 2)}
          </pre>

          {/* Simulation Response Result */}
          {simulationResponse && (
            <div className="mt-4 p-3 rounded-lg bg-emerald-950/50 border border-emerald-200 text-emerald-700 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center justify-between font-bold text-xs">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Respuesta Servidor Meta
                  Graph API ({simulationResponse.status})
                </span>
                <span className="text-[11px] text-slate-500">
                  {simulationResponse.timestamp}
                </span>
              </div>
              <div className="mt-2 text-xs space-y-1 text-slate-600">
                <div>
                  <strong className="text-slate-900">Trace ID:</strong> {simulationResponse.fbtrace_id}
                </div>
                <div>
                  <strong className="text-slate-900">Eventos Recibidos:</strong>{' '}
                  {simulationResponse.events_received}
                </div>
                <div>
                  <strong className="text-slate-900">Deduplicación:</strong>{' '}
                  {simulationResponse.deduplication_status}
                </div>
                <div>
                  <strong className="text-slate-900">Calidad Atribución:</strong>{' '}
                  <span className="text-emerald-600 font-bold">
                    {simulationResponse.emq_score}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
