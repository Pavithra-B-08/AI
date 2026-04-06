import React, { useState, useEffect, useCallback, useRef } from 'react';

// ── Config ─────────────────────────────────────────────────────────────────────
const BASE       = process.env.REACT_APP_API_BASE || 'http://localhost:5000';
const REFRESH_MS = 60_000;

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n, d = 2, fallback = '—') => {
  if (n == null || n === '' || isNaN(Number(n))) return fallback;
  return Number(n).toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
};
const fmtINR = (n, d = 2) => (n == null || isNaN(Number(n))) ? '—' : `₹${fmt(n, d)}`;
const fmtUSD = (n, d = 2) => (n == null || isNaN(Number(n))) ? '—' : `$${fmt(n, d)}`;
const fmtPct = (n) => {
  if (n == null || isNaN(Number(n))) return '—';
  const v = Number(n);
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
};
const fmtVol = (v) => {
  if (!v || v <= 0) return '—';
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  return v.toLocaleString('en-IN');
};
const fmtMktCap = (v) => {
  if (!v) return '—';
  if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9)  return `₹${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e7)  return `₹${(v / 1e7).toFixed(1)}Cr`;
  return `₹${v.toLocaleString('en-IN')}`;
};

// ── Color map ──────────────────────────────────────────────────────────────────
const trendColor = (trend) => ({
  Bullish:    '#10b981',
  Bearish:    '#ef4444',
  Sideways:   '#f59e0b',
  Overbought: '#f97316',
  Oversold:   '#8b5cf6',
}[trend] || '#9ca3af');

const trendBg = (trend) => ({
  Bullish:    'rgba(16,185,129,0.12)',
  Bearish:    'rgba(239,68,68,0.12)',
  Sideways:   'rgba(245,158,11,0.12)',
  Overbought: 'rgba(249,115,22,0.12)',
  Oversold:   'rgba(139,92,246,0.12)',
}[trend] || 'rgba(156,163,175,0.12)');

const chgColor = (v) => Number(v) >= 0 ? '#10b981' : '#ef4444';
const chgBg   = (v) => Number(v) >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';

// ── Sparkline ──────────────────────────────────────────────────────────────────
const Sparkline = ({ data, color, width = 80, height = 32 }) => {
  if (!data || data.length < 2) return null;
  const closes = data.map(d => d.close).filter(Boolean);
  if (closes.length < 2) return null;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const pts = closes.map((c, i) => {
    const x = (i / (closes.length - 1)) * width;
    const y = height - ((c - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color || '#60a5fa'} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

// ── RSI Gauge ──────────────────────────────────────────────────────────────────
const RsiGauge = ({ value }) => {
  if (!value) return null;
  const v   = Number(value);
  const pct = Math.min(100, Math.max(0, v));
  const col = v > 70 ? '#ef4444' : v < 30 ? '#8b5cf6' : '#10b981';
  const label = v > 70 ? 'Overbought' : v < 30 ? 'Oversold' : 'Neutral';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
      <span style={{ fontSize: 11, color: '#6b7280', minWidth: 26 }}>RSI</span>
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: 3, height: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: col, borderRadius: 3, transition: 'width 0.6s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: col, minWidth: 54, textAlign: 'right' }}>
        {v.toFixed(0)} · {label}
      </span>
    </div>
  );
};

// ── Pill ───────────────────────────────────────────────────────────────────────
const Pill = ({ label, color, bg }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
    borderRadius: 4, fontSize: 11, fontWeight: 700,
    color: color || '#9ca3af', background: bg || 'rgba(156,163,175,0.12)',
  }}>{label}</span>
);

// ── ChangePill ─────────────────────────────────────────────────────────────────
const ChangePill = ({ value }) => {
  if (value == null || isNaN(Number(value))) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 7px',
      borderRadius: 4, fontSize: 11, fontWeight: 700,
      color: chgColor(value), background: chgBg(value),
    }}>
      {Number(value) >= 0 ? '▲' : '▼'} {fmtPct(value)}
    </span>
  );
};

const FORECAST_SYMBOLS = ['RELIANCE', 'TCS', 'INFY', 'TSLA', 'MSFT'];

// ── Section ────────────────────────────────────────────────────────────────────
const Section = ({ icon, title, children }) => (
  <div style={{ marginBottom: 28 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9ca3af' }}>{title}</h2>
    </div>
    {children}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// STOCK CARD
// ══════════════════════════════════════════════════════════════════════════════
const StockCard = ({ symbol, data, currency = 'INR' }) => {
  const [expanded, setExpanded] = useState(false);
  const hasData = data && data.current_price != null && !data.error;
  const priceFmt = currency === 'INR' ? fmtINR : fmtUSD;

  return (
    <div
      onClick={() => hasData && setExpanded(e => !e)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '14px 16px',
        cursor: hasData ? 'pointer' : 'default',
        transition: 'border-color 0.2s, background 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => { if (hasData) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
    >
      {/* Live dot */}
      {hasData && data.source === 'yfinance_live' && (
        <span style={{
          position: 'absolute', top: 10, right: 10,
          width: 7, height: 7, borderRadius: '50%', background: '#10b981',
          boxShadow: '0 0 0 2px rgba(16,185,129,0.3)',
        }} title="Live data" />
      )}

      {/* Top row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: '0.02em' }}>
              {symbol.replace('.NS', '')}
            </span>
            {hasData && <Pill label={data.trend || 'N/A'} color={trendColor(data.trend)} bg={trendBg(data.trend)} />}
          </div>
          {data?.name && (
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.3 }}>{data.name}</div>
          )}
          {data?.sector && (
            <div style={{ fontSize: 10, color: '#4b5563', marginTop: 1 }}>{data.sector}</div>
          )}
        </div>
        {hasData && (
          <Sparkline data={data.ohlcv} color={chgColor(data.price_change_percent)} />
        )}
      </div>

      {hasData ? (
        <>
          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {priceFmt(data.current_price)}
            </span>
            <ChangePill value={data.price_change_percent} />
          </div>

          {/* OHLV */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
            {[
              ['O', priceFmt(data.day_open)],
              ['H', priceFmt(data.day_high)],
              ['L', priceFmt(data.day_low)],
              ['Vol', fmtVol(data.volume)],
            ].map(([k, v]) => (
              <span key={k} style={{ fontSize: 11, color: '#6b7280' }}>
                {k}&nbsp;<strong style={{ color: '#d1d5db', fontWeight: 600 }}>{v}</strong>
              </span>
            ))}
          </div>

          {/* 5-day */}
          {data.trend_5d_pct != null && (
            <div style={{ fontSize: 11, color: chgColor(data.trend_5d_pct), marginBottom: 6 }}>
              5-day: {fmtPct(data.trend_5d_pct)} &nbsp;·&nbsp; Prev close: {priceFmt(data.prev_close)}
            </div>
          )}

          <RsiGauge value={data.rsi} />

          {/* Expanded detail */}
          {expanded && (
            <div style={{
              marginTop: 12, paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.07)',
              fontSize: 11, color: '#6b7280', lineHeight: 1.8,
            }}>
              {data.market_cap && <div>Market cap: <strong style={{ color: '#d1d5db' }}>{fmtMktCap(data.market_cap)}</strong></div>}
              {data['52w_high'] && <div>52W High: <strong style={{ color: '#10b981' }}>{priceFmt(data['52w_high'])}</strong>  &nbsp; 52W Low: <strong style={{ color: '#ef4444' }}>{priceFmt(data['52w_low'])}</strong></div>}
              {data.exchange && <div>Exchange: <strong style={{ color: '#d1d5db' }}>{data.exchange}</strong></div>}
              <div style={{ marginTop: 6, color: '#4b5563', fontSize: 10 }}>
                Updated: {data.last_updated}  ·  Tap to collapse
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic', marginTop: 8 }}>
          {data?.error === 'unavailable' ? 'Data unavailable — check backend' : 'Loading…'}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// COMMODITY / GOLD / SILVER CARD
// ══════════════════════════════════════════════════════════════════════════════
const CommodityCard = ({ label, icon, data, showInr = false }) => {
  const hasData = data && data.current_price != null && !data.error;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span style={{ fontSize: 18 }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
            {hasData && <Pill label={data.trend || 'N/A'} color={trendColor(data.trend)} bg={trendBg(data.trend)} />}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>COMEX Futures</div>
        </div>
        {hasData && <Sparkline data={data.ohlcv} color={chgColor(data.price_change_percent)} />}
      </div>

      {hasData ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>
              {fmtUSD(data.current_price, 2)}
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 4 }}>/oz</span>
            </span>
            <ChangePill value={data.price_change_percent} />
          </div>

          {showInr && data.price_inr_per_gram && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: '#fbbf24' }}>
                {fmtINR(data.price_inr_per_gram, 0)}
              </span>
              <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 4 }}>/ gram (India)</span>
              {data.inr_per_usd && (
                <span style={{ fontSize: 10, color: '#4b5563', marginLeft: 8 }}>
                  USD/INR: ₹{fmt(data.inr_per_usd, 2)}
                </span>
              )}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>
            H: {fmtUSD(data.day_high)} · L: {fmtUSD(data.day_low)} · 5d: <span style={{ color: chgColor(data.trend_5d_pct) }}>{fmtPct(data.trend_5d_pct)}</span>
          </div>
          <RsiGauge value={data.rsi} />
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic', marginTop: 8 }}>
          {data?.error ? 'Unavailable' : 'Loading…'}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// CRYPTO CARD
// ══════════════════════════════════════════════════════════════════════════════
const CryptoCard = ({ symbol, data }) => {
  const hasData = data && data.current_price != null && !data.error;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
            {symbol === 'BTC' ? '₿' : 'Ξ'} {data?.name || symbol}
          </div>
          {hasData && <Pill label={data.trend || 'N/A'} color={trendColor(data.trend)} bg={trendBg(data.trend)} />}
        </div>
        {hasData && <Sparkline data={data.ohlcv} color={chgColor(data.price_change_percent)} />}
      </div>

      {hasData ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 700 }}>{fmtUSD(data.current_price, 0)}</span>
            <ChangePill value={data.price_change_percent} />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            5d: <span style={{ color: chgColor(data.trend_5d_pct) }}>{fmtPct(data.trend_5d_pct)}</span>
          </div>
          <RsiGauge value={data.rsi} />
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic', marginTop: 8 }}>Unavailable</div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// INDEX CARD
// ══════════════════════════════════════════════════════════════════════════════
const IndexCard = ({ symbol, data }) => {
  const hasData = data && data.current_price != null && !data.error;
  return (
    <div style={{
      background: 'rgba(99,102,241,0.06)',
      border: '1px solid rgba(99,102,241,0.2)',
      borderRadius: 12,
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{data?.name || symbol}</div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{data?.region}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {hasData && <Pill label={data.trend || 'N/A'} color={trendColor(data.trend)} bg={trendBg(data.trend)} />}
          {hasData && <Sparkline data={data.ohlcv} color={chgColor(data.price_change_percent)} width={70} height={28} />}
        </div>
      </div>

      {hasData ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
              {Number(data.current_price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
            <ChangePill value={data.price_change_percent} />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            5-day: <span style={{ color: chgColor(data.trend_5d_pct), fontWeight: 600 }}>{fmtPct(data.trend_5d_pct)}</span>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic', marginTop: 6 }}>
          {data?.error ? 'Unavailable' : 'Loading…'}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// REIT CARD
// ══════════════════════════════════════════════════════════════════════════════
const ReitCard = ({ symbol, data }) => {
  const hasData = data && data.current_price != null && !data.error;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{data?.name || symbol}</div>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 8 }}>Real Estate · NSE Listed REIT</div>

      {hasData ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 20, fontWeight: 700 }}>{fmtINR(data.current_price)}</span>
            <ChangePill value={data.price_change_percent} />
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>
            H: {fmtINR(data.day_high)} · L: {fmtINR(data.day_low)}
            &nbsp;·&nbsp; 5d: <span style={{ color: chgColor(data.trend_5d_pct) }}>{fmtPct(data.trend_5d_pct)}</span>
          </div>
          <RsiGauge value={data.rsi} />
        </>
      ) : (
        <div style={{ fontSize: 12, color: '#4b5563', fontStyle: 'italic', marginTop: 6 }}>
          {data?.error ? 'REIT data unavailable' : 'Loading…'}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// INSIGHT CARD
// ══════════════════════════════════════════════════════════════════════════════
const urgencyBorder = { high: '#ef4444', medium: '#f59e0b', information: '#6366f1', low: '#10b981' };
const urgencyBg     = { high: 'rgba(239,68,68,0.06)', medium: 'rgba(245,158,11,0.06)', information: 'rgba(99,102,241,0.06)', low: 'rgba(16,185,129,0.06)' };

const InsightCard = ({ rec }) => (
  <div style={{
    borderLeft: `3px solid ${urgencyBorder[rec.urgency] || '#6b7280'}`,
    background: urgencyBg[rec.urgency] || 'rgba(107,114,128,0.06)',
    borderRadius: '0 10px 10px 0',
    padding: '12px 14px',
  }}>
    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{rec.title}</div>
    <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.65 }}>{rec.detail}</div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// MARKET SUMMARY BAR
// ══════════════════════════════════════════════════════════════════════════════
const SummaryBar = ({ insights }) => {
  if (!insights) return null;
  const { market_trend: mt, breadth: b, avg_change_percent: avg } = insights;
  const mColor = trendColor(mt);
  return (
    <div style={{
      display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
      padding: '10px 16px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      marginBottom: 24,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: mColor }}>
        {mt === 'Bullish' ? '📈' : mt === 'Bearish' ? '📉' : '➡️'} Market: {mt}
      </span>
      <span style={{ color: '#374151', fontSize: 12 }}>·</span>
      <span style={{ fontSize: 12, color: '#10b981' }}>↑ {b?.bullish || 0} bullish</span>
      <span style={{ fontSize: 12, color: '#ef4444' }}>↓ {b?.bearish || 0} bearish</span>
      <span style={{ fontSize: 12, color: '#9ca3af' }}>→ {b?.neutral || 0} sideways</span>
      <span style={{ color: '#374151', fontSize: 12 }}>·</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: chgColor(avg) }}>
        Avg: {fmtPct(avg)}
      </span>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// COUNTDOWN RING
// ══════════════════════════════════════════════════════════════════════════════
const CountdownRing = ({ value, total }) => {
  const pct = (value / total) * 100;
  const r = 12, cx = 14, cy = 14;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={28} height={28} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#60a5fa" strokeWidth="2"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${cx}px ${cy}px`, fontSize: 8, fontWeight: 700, fill: '#9ca3af' }}>
        {value}
      </text>
    </svg>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// FOREX STRIP
// ══════════════════════════════════════════════════════════════════════════════
const ForexStrip = ({ data }) => {
  if (!data || data.error || !data.current_price) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px',
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10,
      marginBottom: 24,
      flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>USD/INR</span>
      <span style={{ fontSize: 18, fontWeight: 700 }}>₹{fmt(data.current_price, 2)}</span>
      <ChangePill value={data.price_change_percent} />
      <span style={{ fontSize: 11, color: '#4b5563' }}>5d: {fmtPct(data.trend_5d_pct)}</span>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
// GRID HELPER
// ══════════════════════════════════════════════════════════════════════════════
const Grid = ({ cols = 4, children }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${cols === 2 ? '280px' : cols === 3 ? '220px' : '180px'}, 1fr))`,
    gap: 12,
    marginBottom: 8,
  }}>
    {children}
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// SETUP ERROR PANEL
// ══════════════════════════════════════════════════════════════════════════════
const SetupPanel = ({ error, onRetry }) => (
  <div style={{
    padding: 32,
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 14,
    maxWidth: 600,
    margin: '0 auto',
  }}>
    <div style={{ fontSize: 22, marginBottom: 12 }}>⚙️ Backend not reachable</div>
    <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 18, lineHeight: 1.8 }}>{error}</div>
    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, fontWeight: 600 }}>Quick setup:</div>
    <div style={{
      background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 14,
      fontFamily: 'monospace', fontSize: 12, color: '#93c5fd', lineHeight: 2, marginBottom: 18,
    }}>
      pip install flask flask-cors yfinance curl_cffi pandas numpy<br/>
      python app.py
    </div>
    <button
      onClick={onRetry}
      style={{
        padding: '8px 18px', borderRadius: 8,
        background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)',
        color: '#60a5fa', cursor: 'pointer', fontSize: 13, fontWeight: 600,
      }}
    >
      Retry connection ↺
    </button>
    <div style={{ marginTop: 16, fontSize: 11, color: '#4b5563' }}>
      Tip: Verify with <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 3 }}>
      curl http://localhost:5000/api/health</code>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
export default function MarketOverview() {
  const [data,      setData]      = useState(null);
  const [insights,  setInsights]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [updated,   setUpdated]   = useState('');
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [count,     setCount]     = useState(0);
  const [fromCache, setFromCache] = useState(false);
  const [forecastSymbol, setForecastSymbol] = useState('RELIANCE');
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(true);
  const [forecastError, setForecastError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/market_overview`, {
        signal: AbortSignal.timeout(120_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      const json = await res.json();
      setData(json.data         || {});
      setInsights(json.insights || null);
      setUpdated(json.last_updated || new Date().toLocaleTimeString('en-IN'));
      setCount(json.count || 0);
      setFromCache(!!json.from_cache);
      setError('');
      setCountdown(REFRESH_MS / 1000);
    } catch (e) {
      setError(
        e.name === 'TimeoutError'
          ? 'Request timed out (first load can take ~30s — yfinance is downloading live OHLCV data). Retrying…'
          : `Cannot reach backend at ${BASE}. Make sure Flask is running.\n\nError: ${e.message}`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchForecast = useCallback(async (symbol) => {
    setForecastLoading(true);
    setForecastError('');
    try {
      const res = await fetch(`${BASE}/api/stock_prediction/${symbol}`, {
        signal: AbortSignal.timeout(120_000),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || res.statusText || 'Prediction failed');
      }
      setForecast(json.data);
    } catch (err) {
      setForecastError(err.message || 'Unable to fetch predictions');
      setForecast(null);
    } finally {
      setForecastLoading(false);
    }
  }, [BASE]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    const iv = setInterval(fetchAll, REFRESH_MS);
    return () => clearInterval(iv);
  }, [fetchAll]);
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [updated]);

  useEffect(() => {
    fetchForecast(forecastSymbol);
  }, [fetchForecast, forecastSymbol]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading && !data) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
      <div style={{
        width: 48, height: 48, border: '3px solid rgba(255,255,255,0.1)',
        borderTop: '3px solid #60a5fa', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 16, fontWeight: 500 }}>Fetching live market data…</div>
      <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 380, textAlign: 'center', lineHeight: 1.7 }}>
        First load takes 15–30 seconds. yfinance is downloading OHLCV data
        for all symbols (stocks · indices · gold · silver · crude · crypto · REITs).
      </div>
    </div>
  );

  if (error && !data) return (
    <div style={{ padding: '32px 16px' }}>
      <SetupPanel error={error} onRetry={fetchAll} />
    </div>
  );

  const d    = data || {};
  const recs = insights?.recommendations || [];

  const INDIAN_SYMS  = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'BAJFINANCE', 'WIPRO', 'TATAMOTORS', 'ADANIPORTS'];
  const GLOBAL_SYMS  = ['AMZN', 'TSLA', 'MSFT', 'GOOGL'];
  const INDEX_SYMS   = ['NSEI', 'BSESN', 'GSPC', 'DJI'];
  const REIT_SYMS    = ['EMBASSY', 'MINDSPACE', 'NEXUS'];

  return (
    <div style={{ padding: '24px 0', maxWidth: 1200, margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Market Overview
          </h1>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            {count} instruments&nbsp;·&nbsp;{updated}
            {fromCache && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· cached</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {loading && (
            <div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #60a5fa', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          )}
          <CountdownRing value={countdown} total={REFRESH_MS / 1000} />
          <button
            onClick={fetchAll}
            disabled={loading}
            style={{
              padding: '6px 14px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#d1d5db', cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 600, opacity: loading ? 0.5 : 1,
            }}
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {error && data && (
        <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, fontSize: 12, color: '#fbbf24', marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── Key ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#6b7280', marginBottom: 18 }}>
        <span>🟢 Live = fetched from Yahoo Finance</span>
        <span>· RSI &lt;30 = oversold (potential buy)</span>
        <span>· RSI &gt;70 = overbought (caution)</span>
        <span>· Tap stock cards for details</span>
      </div>

      {/* ── Forex ────────────────────────────────────────────────────────── */}
      <ForexStrip data={d['USDINR']} />

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <SummaryBar insights={insights} />

      <Section icon="📈" title="AI-Powered Stock Forecast">
        <div style={{
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14,
          padding: 16,
          background: 'rgba(255,255,255,0.02)',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', letterSpacing: '0.08em' }}>Live stock forecast</div>
              <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{forecastSymbol} · Next close</div>
            </div>
            <select
              value={forecastSymbol}
              onChange={(e) => setForecastSymbol(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: '#ffffff',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {FORECAST_SYMBOLS.map(sym => (
                <option key={sym} value={sym} style={{ background: '#0f0f23', color: '#f9fafb' }}>
                  {sym}
                </option>
              ))}
            </select>
          </div>

          {forecastLoading && (
            <div style={{ marginTop: 14, fontSize: 13, color: '#9ca3af' }}>
              Forecasting hedged next close… (updates every minute)
            </div>
          )}

          {!forecastLoading && forecast && (
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Current price</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{(forecast.currency === 'USD' ? fmtUSD(forecast.current_price) : fmtINR(forecast.current_price) )}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Predicted close</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: trendColor(forecast.trend) }}>{(forecast.currency === 'USD' ? fmtUSD(forecast.predicted_price) : fmtINR(forecast.predicted_price))}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Model confidence</div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>{forecast.confidence}%</div>
              </div>
            </div>
          )}

          {!forecastLoading && !forecast && forecastError && (
            <div style={{ marginTop: 14, fontSize: 12, color: '#fbbf24' }}>
              ⚠ {forecastError}
            </div>
          )}

          {!forecastLoading && forecast && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <ChangePill value={forecast.change_percent} />
              <div style={{ fontSize: 11, color: '#4b5563' }}>
                Trend: <strong style={{ color: trendColor(forecast.trend) }}>{forecast.trend}</strong> · Last updated {forecast.last_updated}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ── Indices ──────────────────────────────────────────────────────── */}
      <Section icon="📊" title="Market Indices">
        <Grid cols={4}>
          {INDEX_SYMS.map(s => <IndexCard key={s} symbol={s} data={d[s]} />)}
        </Grid>
      </Section>

      {/* ── Indian Stocks ─────────────────────────────────────────────────── */}
      <Section icon="🇮🇳" title="Indian Stocks (NSE)">
        <Grid cols={4}>
          {INDIAN_SYMS.map(s => <StockCard key={s} symbol={s} data={d[s]} currency="INR" />)}
        </Grid>
      </Section>

      {/* ── Global Stocks ─────────────────────────────────────────────────── */}
      <Section icon="🌐" title="Global Stocks (NYSE / NASDAQ)">
        <Grid cols={3}>
          {GLOBAL_SYMS.map(s => <StockCard key={s} symbol={s} data={d[s]} currency="USD" />)}
        </Grid>
      </Section>

      {/* ── Precious Metals ───────────────────────────────────────────────── */}
      <Section icon="🪙" title="Commodities">
        <Grid cols={3}>
          <CommodityCard label="Gold" icon="🥇" data={d['GOLD']} showInr />
          <CommodityCard label="Silver" icon="🥈" data={d['SILVER']} showInr />
          <CommodityCard label="Crude Oil (WTI)" icon="🛢️" data={d['CRUDE']} />
        </Grid>
      </Section>

      {/* ── Crypto ────────────────────────────────────────────────────────── */}
      <Section icon="₿" title="Cryptocurrency">
        <Grid cols={3}>
          <CryptoCard symbol="BTC" data={d['BTC']} />
          <CryptoCard symbol="ETH" data={d['ETH']} />
        </Grid>
      </Section>

      {/* ── Real Estate REITs ──────────────────────────────────────────────── */}
      <Section icon="🏗️" title="Real Estate (Listed REITs — NSE)">
        <Grid cols={3}>
          {REIT_SYMS.map(s => <ReitCard key={s} symbol={s} data={d[s]} />)}
        </Grid>
      </Section>

      {/* ── AI Insights ───────────────────────────────────────────────────── */}
      {recs.length > 0 && (
        <Section icon="🤖" title="AI Insights & Recommendations">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {recs.map((r, i) => <InsightCard key={i} rec={r} />)}
          </div>
        </Section>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.07)', fontSize: 11, color: '#4b5563', lineHeight: 1.8 }}>
        <strong style={{ color: '#6b7280' }}>Data sources:</strong> Yahoo Finance via yfinance (curl_cffi session) · Indices: ^NSEI, ^BSESN, ^GSPC, ^DJI · Commodities: GC=F (Gold), SI=F (Silver), CL=F (Crude) · Crypto: BTC-USD, ETH-USD · REITs: Embassy, Mindspace, Nexus<br/>
        <strong style={{ color: '#6b7280' }}>Disclaimer:</strong> For informational purposes only. Not investment advice. Data may be delayed. Always verify with your broker before trading.
      </div>
    </div>
  );
}
