"""
FinAI v5 — Multi-Source Live Market Data Backend
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Data Sources (all FREE, no API key needed):
  • Stocks / Indices  → Stooq  (stooq.com/q/d/l/)
  • Forex (USD/INR)   → Frankfurter (api.frankfurter.app)
  • Crypto            → CoinGecko   (api.coingecko.com)
  • Gold/Silver/Oil   → Stooq futures tickers

Install:
  pip install flask flask-cors pandas numpy requests

Run:
  python app.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import requests, time, threading, json
from datetime import datetime, timedelta
from io import StringIO
import yfinance as yf

app = Flask(__name__)
CORS(app, origins="*")

# ══════════════════════════════════════════════════════════════════
# SHARED HTTP SESSION  (persistent connections, realistic headers)
# ══════════════════════════════════════════════════════════════════
SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
})

# ══════════════════════════════════════════════════════════════════
# CACHE  (TTL = 60 s to avoid hammering free APIs)
# ══════════════════════════════════════════════════════════════════
_cache: dict = {}
_cache_lock  = threading.Lock()
CACHE_TTL    = 60   # seconds


def cache_get(key):
    with _cache_lock:
        item = _cache.get(key)
        if item and time.time() - item["ts"] < CACHE_TTL:
            return item["data"]
    return None


def cache_set(key, data):
    with _cache_lock:
        _cache[key] = {"data": data, "ts": time.time()}


# ══════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════
def _rsi(closes: list, period: int = 14) -> float:
    if len(closes) < period + 1:
        return 50.0
    gains, losses = [], []
    for i in range(1, len(closes)):
        d = closes[i] - closes[i - 1]
        gains.append(max(d, 0))
        losses.append(max(-d, 0))
    ag = np.mean(gains[-period:]) if gains else 0
    al = np.mean(losses[-period:]) if losses else 0
    if al == 0:
        return 100.0
    rs = ag / al
    return round(100 - 100 / (1 + rs), 1)


def _trend_label(chg_pct: float, rsi: float) -> str:
    if chg_pct > 0.5 and rsi < 70:
        return "Bullish"
    if chg_pct < -0.5 and rsi > 30:
        return "Bearish"
    if rsi > 70:
        return "Overbought"
    if rsi < 30:
        return "Oversold"
    return "Sideways"


def _safe_round(val, decimals=2):
    try:
        return round(float(val), decimals)
    except (TypeError, ValueError):
        return None


def _normalize_for_yf(symbol):
    sym = (symbol or "").strip().upper()
    if not sym:
        return None
    if sym.endswith(".IN"):
        return sym.replace(".IN", ".NS")
    if sym.endswith(".NS") or sym.endswith(".US"):
        return sym
    if sym in INDIAN_STOCKS:
        return f"{sym}.NS"
    if sym in GLOBAL_STOCKS:
        return f"{sym}.US"
    return sym


def _yfinance_history(symbol, days_back=90, interval="1d"):
    ticker = _normalize_for_yf(symbol)
    if not ticker:
        return None
    cache_key = f"yf:{ticker}:{interval}:{days_back}"
    cached = cache_get(cache_key)
    if cached:
        return cached
    try:
        df = yf.download(
            tickers=ticker,
            period=f"{days_back}d",
            interval=interval,
            auto_adjust=True,
            progress=False,
            threads=False,
        )
        if df.empty:
            return None
        df = df.rename(columns=str.lower).reset_index()
        df = df[df["close"].notna()]
        if df.empty:
            return None
        records = df[["date", "close", "open", "high", "low", "volume"]].to_dict(orient="records")
        cache_set(cache_key, records)
        return records
    except Exception as exc:
        print(f"[yfinance] Error fetching {ticker}: {exc}")
        return None


def _predict_from_history(history):
    if not history or len(history) < 5:
        return None
    closes = np.array([h["close"] for h in history if h.get("close") is not None])
    if len(closes) < 5:
        return None
    x = np.arange(len(closes))
    try:
        coeffs = np.polyfit(x, closes, 2)
        pred = np.polyval(coeffs, len(closes))
    except Exception:
        pred = closes[-1]
    return float(pred)


def _build_prediction(symbol):
    history = _yfinance_history(symbol, days_back=90)
    if not history:
        return None
    last_point = history[-1]
    current_price = last_point["close"]
    predicted_price = _predict_from_history(history)
    if predicted_price is None:
        predicted_price = current_price
    change = predicted_price - current_price
    change_pct = (change / current_price * 100) if current_price else 0
    vol_pct = 0
    closes = [h["close"] for h in history if h.get("close") is not None]
    if len(closes) > 2:
        returns = np.diff(closes) / closes[:-1]
        vol_pct = float(np.std(returns)) * 100
    confidence = round(max(35, min(95, 100 - vol_pct)))
    trend = _trend_label(change_pct, _rsi(closes))

    preview = history[-15:]
    preview = [{"date": h["date"].strftime("%Y-%m-%d"), "close": _safe_round(h["close"])} for h in preview]

    return {
        "symbol":              symbol.upper(),
        "current_price":       _safe_round(current_price),
        "predicted_price":     _safe_round(predicted_price),
        "change_percent":      _safe_round(change_pct, 2),
        "confidence":          confidence,
        "trend":               trend,
        "source":              "yfinance_forecast",
        "history":             preview,
        "model":               "quadratic-trend",
        "last_updated":        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "currency":            "INR" if _normalize_for_yf(symbol).endswith(".NS") else "USD",
    }



# ══════════════════════════════════════════════════════════════════
# SOURCE 1 ─ STOOQ  (stocks, indices, commodities)
# Ticker formats:
#   NSE stocks  →  RELIANCE.IN  (note: .IN not .NS for Stooq)
#   BSE index   →  ^BSE
#   Nifty 50    →  ^NIF
#   US stocks   →  AMZN.US
#   Commodities →  GC.F (gold), SI.F (silver), CL.F (crude)
# ══════════════════════════════════════════════════════════════════
def _stooq_fetch(stooq_sym: str, days_back: int = 35):
    """Download daily OHLCV from Stooq CSV endpoint."""
    cached = cache_get(f"stooq:{stooq_sym}")
    if cached:
        return cached

    end_dt   = datetime.now()
    start_dt = end_dt - timedelta(days=days_back)
    url = (
        "https://stooq.com/q/d/l/"
        f"?s={stooq_sym.lower()}"
        f"&d1={start_dt.strftime('%Y%m%d')}"
        f"&d2={end_dt.strftime('%Y%m%d')}"
        "&i=d"
    )
    try:
        resp = SESSION.get(url, timeout=10)
        if resp.status_code != 200 or "No data" in resp.text or len(resp.text) < 50:
            return None

        df = pd.read_csv(StringIO(resp.text), parse_dates=["Date"])
        df = df.sort_values("Date").dropna(subset=["Close"])
        if df.empty:
            return None

        rows = []
        for _, row in df.iterrows():
            rows.append({
                "date":   row["Date"].strftime("%Y-%m-%d"),
                "open":   _safe_round(row.get("Open",  row["Close"])),
                "high":   _safe_round(row.get("High",  row["Close"])),
                "low":    _safe_round(row.get("Low",   row["Close"])),
                "close":  _safe_round(row["Close"]),
                "volume": int(row["Volume"]) if "Volume" in row and not pd.isna(row["Volume"]) else 0,
            })

        if not rows:
            return None

        last = rows[-1]
        prev = rows[-2] if len(rows) >= 2 else last
        chg     = last["close"] - prev["close"]
        chg_pct = (chg / prev["close"] * 100) if prev["close"] else 0
        first   = rows[0]["close"]
        trend5  = ((last["close"] - first) / first * 100) if first else 0
        closes  = [r["close"] for r in rows]
        rsi_val = _rsi(closes)

        result = {
            "symbol":               stooq_sym,
            "current_price":        last["close"],
            "prev_close":           prev["close"],
            "day_open":             last["open"],
            "day_high":             last["high"],
            "day_low":              last["low"],
            "volume":               last["volume"],
            "price_change":         _safe_round(chg),
            "price_change_percent": _safe_round(chg_pct),
            "trend_5d_pct":         _safe_round(trend5),
            "rsi":                  rsi_val,
            "trend":                _trend_label(chg_pct, rsi_val),
            "ohlcv":                rows[-30:],
            "source":               "stooq",
            "last_updated":         datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        cache_set(f"stooq:{stooq_sym}", result)
        return result

    except Exception as e:
        print(f"[Stooq] ERROR {stooq_sym}: {e}")
        return None


# ══════════════════════════════════════════════════════════════════
# SOURCE 2 ─ FRANKFURTER  (Forex rates, ECB data)
# ══════════════════════════════════════════════════════════════════
def _fetch_forex_frankfurter(base="USD", target="INR"):
    key = f"forex:{base}{target}"
    cached = cache_get(key)
    if cached:
        return cached
    try:
        url  = f"https://api.frankfurter.app/latest?from={base}&to={target}"
        resp = SESSION.get(url, timeout=8)
        data = resp.json()
        rate = data["rates"].get(target)
        if not rate:
            return None

        # Also fetch 5 days of history for trend
        end_dt   = datetime.now()
        start_dt = end_dt - timedelta(days=10)
        hist_url = (
            f"https://api.frankfurter.app/"
            f"{start_dt.strftime('%Y-%m-%d')}..{end_dt.strftime('%Y-%m-%d')}"
            f"?from={base}&to={target}"
        )
        hist_resp = SESSION.get(hist_url, timeout=8)
        hist_data = hist_resp.json()
        hist_rates = sorted(hist_data.get("rates", {}).items())
        prev_rate  = hist_rates[-2][1][target] if len(hist_rates) >= 2 else rate
        chg        = rate - prev_rate
        chg_pct    = (chg / prev_rate * 100) if prev_rate else 0

        result = {
            "symbol":               f"{base}/{target}",
            "current_price":        _safe_round(rate, 4),
            "prev_close":           _safe_round(prev_rate, 4),
            "price_change":         _safe_round(chg, 4),
            "price_change_percent": _safe_round(chg_pct),
            "trend":                _trend_label(chg_pct, 50),
            "source":               "frankfurter",
            "last_updated":         datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }
        cache_set(key, result)
        return result
    except Exception as e:
        print(f"[Frankfurter] ERROR {base}/{target}: {e}")
        return None


# ══════════════════════════════════════════════════════════════════
# SOURCE 3 ─ COINGECKO  (Crypto — free, no key needed)
# ══════════════════════════════════════════════════════════════════
COINGECKO_IDS = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "BNB": "binancecoin",
}

def _fetch_crypto_coingecko(coins: list = None):
    """Fetch multiple coins in one call."""
    if coins is None:
        coins = list(COINGECKO_IDS.keys())

    cached = cache_get("crypto:all")
    if cached:
        return cached

    ids_str = ",".join(COINGECKO_IDS[c] for c in coins if c in COINGECKO_IDS)
    url = (
        "https://api.coingecko.com/api/v3/coins/markets"
        f"?vs_currency=usd&ids={ids_str}"
        "&order=market_cap_desc&per_page=10&page=1"
        "&sparkline=false&price_change_percentage=24h"
    )
    try:
        resp = SESSION.get(url, timeout=10)
        items = resp.json()
        results = {}
        sym_map = {v: k for k, v in COINGECKO_IDS.items()}
        for item in items:
            sym  = sym_map.get(item["id"], item["symbol"].upper())
            chg  = item.get("price_change_percentage_24h") or 0
            price = item.get("current_price") or 0
            results[sym] = {
                "symbol":               sym,
                "name":                 item.get("name", sym),
                "label":                item.get("name", sym),
                "current_price":        _safe_round(price),
                "prev_close":           _safe_round(price / (1 + chg / 100)) if chg != -100 else price,
                "price_change_percent": _safe_round(chg),
                "price_change":         _safe_round(price - price / (1 + chg / 100)) if chg != -100 else 0,
                "market_cap":           item.get("market_cap"),
                "volume":               item.get("total_volume"),
                "day_high":             item.get("high_24h"),
                "day_low":              item.get("low_24h"),
                "trend":                _trend_label(chg, 50),
                "rsi":                  50.0,
                "type":                 "crypto",
                "source":               "coingecko",
                "last_updated":         datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            }
        cache_set("crypto:all", results)
        return results
    except Exception as e:
        print(f"[CoinGecko] ERROR: {e}")
        return {}


# ══════════════════════════════════════════════════════════════════
# SYMBOL MAPS
#   Stooq tickers:
#   • Indian NSE stocks  → e.g. RELIANCE.IN
#   • Nifty 50           → ^NIF  (or ^FW20 — depends on Stooq)
#   • BSE Sensex         → ^BSE
#   • US stocks          → AMZN.US
#   • US indices         → ^SPX (S&P), ^DJI (Dow)
#   • Gold futures       → GC.F
#   • Silver futures     → SI.F
#   • Crude oil WTI      → CL.F
# ══════════════════════════════════════════════════════════════════
INDICES = {
    "^NIF":  {"name": "Nifty 50",   "region": "India",  "display": "NIFTY50"},
    "^BSE":  {"name": "BSE Sensex", "region": "India",  "display": "SENSEX"},
    "^SPX":  {"name": "S&P 500",    "region": "USA",    "display": "S&P500"},
    "^DJI":  {"name": "Dow Jones",  "region": "USA",    "display": "DJIA"},
}

INDIAN_STOCKS = {
    "RELIANCE.IN":  {"name": "Reliance Industries",       "sector": "Energy & Retail"},
    "TCS.IN":       {"name": "Tata Consultancy Services", "sector": "IT Services"},
    "INFY.IN":      {"name": "Infosys",                   "sector": "IT Services"},
    "HDFCBANK.IN":  {"name": "HDFC Bank",                 "sector": "Private Banking"},
    "ICICIBANK.IN": {"name": "ICICI Bank",                "sector": "Private Banking"},
    "SBIN.IN":      {"name": "State Bank of India",       "sector": "PSU Banking"},
    "WIPRO.IN":     {"name": "Wipro",                     "sector": "IT Services"},
    "TATAMOTORS.IN":{"name": "Tata Motors",               "sector": "Automobiles"},
    "BAJFINANCE.IN":{"name": "Bajaj Finance",             "sector": "NBFC"},
    "ADANIPORTS.IN":{"name": "Adani Ports & SEZ",         "sector": "Infrastructure"},
}

GLOBAL_STOCKS = {
    "AMZN.US":  {"name": "Amazon",    "sector": "E-Commerce / Cloud"},
    "TSLA.US":  {"name": "Tesla",     "sector": "Electric Vehicles"},
    "MSFT.US":  {"name": "Microsoft", "sector": "Software / Cloud"},
    "GOOGL.US": {"name": "Alphabet",  "sector": "Technology"},
    "AAPL.US":  {"name": "Apple",     "sector": "Consumer Tech"},
}

COMMODITIES = {
    "GC.F":  {"name": "Gold",             "label": "Gold ($/oz)",          "unit": "USD/oz"},
    "SI.F":  {"name": "Silver",           "label": "Silver ($/oz)",        "unit": "USD/oz"},
    "CL.F":  {"name": "Crude Oil (WTI)",  "label": "Crude Oil WTI ($/bbl)","unit": "USD/bbl"},
    "NG.F":  {"name": "Natural Gas",      "label": "Natural Gas ($/MMBtu)","unit": "USD/MMBtu"},
}

REIT_STOCKS = {
    "EMBASSY.IN":   {"name": "Embassy Office Parks REIT", "sector": "Real Estate"},
    "MINDSPACE.IN": {"name": "Mindspace Business Parks",  "sector": "Real Estate"},
    "NEXUS.IN":     {"name": "Nexus Select Trust REIT",   "sector": "Real Estate"},
}


# ══════════════════════════════════════════════════════════════════
# AI INSIGHTS ENGINE  (unchanged logic, cleaner output)
# ══════════════════════════════════════════════════════════════════
def _generate_insights(all_data: dict) -> dict:
    stocks_data = {
        k: v for k, v in all_data.items()
        if isinstance(v, dict) and "price_change_percent" in v and "error" not in v
    }
    if not stocks_data:
        return {"market_trend": "Neutral", "breadth": {"bullish": 0, "bearish": 0, "neutral": 0},
                "avg_change_percent": 0, "recommendations": []}

    changes   = [v["price_change_percent"] for v in stocks_data.values()
                 if v.get("price_change_percent") is not None]
    trends    = [v.get("trend", "Neutral") for v in stocks_data.values()]
    avg_chg   = round(sum(changes) / len(changes), 2) if changes else 0
    bullish_n = sum(1 for t in trends if t in ("Bullish", "Oversold"))
    bearish_n = sum(1 for t in trends if t in ("Bearish", "Overbought"))
    neutral_n = len(trends) - bullish_n - bearish_n
    mkt_trend = (
        "Bullish" if bullish_n > bearish_n * 1.5
        else "Bearish" if bearish_n > bullish_n * 1.5
        else "Sideways"
    )
    recs = []

    # Top movers
    sorted_by_chg = sorted(
        stocks_data.items(),
        key=lambda x: x[1].get("price_change_percent") or 0,
        reverse=True,
    )
    if sorted_by_chg:
        best_sym, best   = sorted_by_chg[0]
        worst_sym, worst = sorted_by_chg[-1]
        best_chg  = best.get("price_change_percent", 0)  or 0
        worst_chg = worst.get("price_change_percent", 0) or 0
        best_rsi  = best.get("rsi", 50)  or 50
        worst_rsi = worst.get("rsi", 50) or 50

        display_best  = best.get("name",  best_sym.replace(".IN","").replace(".US",""))
        display_worst = worst.get("name", worst_sym.replace(".IN","").replace(".US",""))

        recs.append({
            "title":   f"🚀 Top Gainer: {display_best}",
            "detail":  (f"Up {best_chg:+.2f}% today. RSI {best_rsi:.0f} — "
                        f"{'momentum building' if best_rsi < 65 else 'approaching overbought territory'}."),
            "urgency": "high" if best_chg > 3 else "medium",
        })
        recs.append({
            "title":   f"📉 Top Loser: {display_worst}",
            "detail":  (f"Down {worst_chg:+.2f}% today. RSI {worst_rsi:.0f} — "
                        f"{'potential buy zone' if worst_rsi < 35 else 'watch for further downside'}."),
            "urgency": "high" if worst_chg < -3 else "medium",
        })

    # Oversold signal
    oversold = [(s, v) for s, v in stocks_data.items() if (v.get("rsi") or 50) < 35]
    if oversold:
        sym, val = oversold[0]
        rsi_val  = val.get("rsi", 30) or 30
        disp     = val.get("name", sym.replace(".IN","").replace(".US",""))
        recs.append({
            "title":   f"💡 Oversold Signal: {disp}",
            "detail":  (f"RSI {rsi_val:.0f} — deeply oversold. "
                        "Historically, RSI < 35 precedes a bounce. "
                        "Consider accumulating in small tranches."),
            "urgency": "information",
        })

    # Market breadth
    recs.append({
        "title":   f"📊 Market Breadth: {mkt_trend}",
        "detail":  (
            f"{bullish_n} assets rising, {bearish_n} falling, {neutral_n} sideways. "
            f"Avg daily change: {avg_chg:+.2f}%. "
            + ("Broad-based rally — high-conviction entry." if mkt_trend == "Bullish"
               else "Broad selling pressure — defensive positioning advised." if mkt_trend == "Bearish"
               else "Mixed signals — selective stock-picking over index bets.")
        ),
        "urgency": "information",
    })

    return {
        "market_trend":       mkt_trend,
        "breadth":            {"bullish": bullish_n, "bearish": bearish_n, "neutral": neutral_n},
        "avg_change_percent": avg_chg,
        "recommendations":    recs[:6],
    }


# ══════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════
@app.route("/")
def root():
    return jsonify({
        "name": "FinAI v5",
        "status": "ok",
        "sources": ["Stooq", "CoinGecko", "Frankfurter"],
        "endpoints": {
            "health":          "GET /api/health",
            "market_overview": "GET /api/market_overview",
            "single_stock":    "GET /api/stock/<symbol>",
        },
    })


@app.route("/api/health")
def health():
    tests = {}
    # Test Stooq
    try:
        r = SESSION.get("https://stooq.com/q/d/l/?s=tcs.in&i=d", timeout=5)
        tests["stooq"] = "ok" if r.status_code == 200 and "Close" in r.text else "error"
    except Exception as e:
        tests["stooq"] = f"error: {e}"
    # Test CoinGecko
    try:
        r = SESSION.get("https://api.coingecko.com/api/v3/ping", timeout=5)
        tests["coingecko"] = "ok" if r.status_code == 200 else "error"
    except Exception as e:
        tests["coingecko"] = f"error: {e}"
    # Test Frankfurter
    try:
        r = SESSION.get("https://api.frankfurter.app/latest?from=USD&to=INR", timeout=5)
        tests["frankfurter"] = "ok" if r.status_code == 200 else "error"
    except Exception as e:
        tests["frankfurter"] = f"error: {e}"

    overall = "ok" if all(v == "ok" for v in tests.values()) else "degraded"
    return jsonify({"status": overall, "sources": tests})


@app.route("/api/market_overview")
def market_overview():
    """
    Master endpoint — all asset classes in one JSON response.
    Frontend should poll every 60 seconds.
    """
    try:
        cached = cache_get("market_overview")
        if cached:
            cached["from_cache"] = True
            return jsonify(cached)

        all_data = {}

        # ── Market Indices ──
        for sym, meta in INDICES.items():
            d = _stooq_fetch(sym)
            key = meta["display"]
            if d:
                all_data[key] = {**d, **meta, "type": "index"}
            else:
                all_data[key] = {"symbol": sym, "error": "unavailable", "type": "index", **meta}

        # ── Indian Stocks ──
        for sym, meta in INDIAN_STOCKS.items():
            d = _stooq_fetch(sym)
            key = sym.replace(".IN", "")
            if d:
                all_data[key] = {**d, **meta, "type": "stock", "exchange": "NSE"}
            else:
                all_data[key] = {"symbol": sym, "error": "unavailable", "type": "stock",
                                  "exchange": "NSE", **meta}

        # ── Global Stocks ──
        for sym, meta in GLOBAL_STOCKS.items():
            d = _stooq_fetch(sym)
            key = sym.replace(".US", "")
            if d:
                all_data[key] = {**d, **meta, "type": "stock", "exchange": "NYSE/NASDAQ"}
            else:
                all_data[key] = {"symbol": sym, "error": "unavailable", "type": "stock",
                                  "exchange": "NYSE/NASDAQ", **meta}

        # ── Commodities ──
        forex_data = _fetch_forex_frankfurter("USD", "INR")
        inr_rate   = forex_data["current_price"] if forex_data else 83.5

        for sym, meta in COMMODITIES.items():
            d = _stooq_fetch(sym)
            key = sym.replace(".F", "")
            if d:
                entry = {**d, **meta, "type": "commodity", "currency": "USD"}
                if sym in ("GC.F", "SI.F"):
                    entry["price_inr_per_gram"] = round(
                        d["current_price"] * inr_rate / 31.1035, 0
                    )
                    entry["inr_per_usd"] = round(inr_rate, 2)
                all_data[key] = entry
            else:
                all_data[key] = {"symbol": sym, "error": "unavailable", "type": "commodity", **meta}

        # ── Crypto (CoinGecko) ──
        crypto_data = _fetch_crypto_coingecko()
        for sym, cdata in crypto_data.items():
            all_data[sym] = cdata

        # ── REITs ──
        for sym, meta in REIT_STOCKS.items():
            d = _stooq_fetch(sym)
            key = sym.replace(".IN", "")
            if d:
                all_data[key] = {**d, **meta, "type": "reit", "exchange": "NSE"}
            else:
                all_data[key] = {"symbol": sym, "error": "unavailable", "type": "reit",
                                  "exchange": "NSE", **meta}

        # ── Forex ──
        if forex_data:
            all_data["USDINR"] = {
                **forex_data,
                "name":  "US Dollar / Indian Rupee",
                "label": "USD/INR",
                "type":  "forex",
            }

        for base, target in [("EUR", "INR"), ("GBP", "INR"), ("JPY", "INR")]:
            fd = _fetch_forex_frankfurter(base, target)
            if fd:
                all_data[f"{base}INR"] = {
                    **fd,
                    "name":  f"{base} / INR",
                    "label": f"{base}/INR",
                    "type":  "forex",
                }

        insights = _generate_insights(all_data)
        live_count = sum(1 for v in all_data.values()
                         if isinstance(v, dict) and "error" not in v)

        response = {
            "success":      True,
            "data":         all_data,
            "insights":     insights,
            "last_updated": datetime.now().strftime("%d %b %Y, %H:%M:%S IST"),
            "count":        live_count,
            "from_cache":   False,
        }

        cache_set("market_overview", response)
        return jsonify(response)
    except Exception as exc:
        print(f"[market_overview] ERROR: {exc}")
        return jsonify({
            "success": False,
            "error": "Unable to fetch market overview right now. Check logs."
        }), 503

@app.route("/api/stock/<symbol>")
def single_stock(symbol):
    """
    Fetch a single stock with 30-day history.
    Tries NSE (.IN) first, then US (.US).
    """
    sym = symbol.upper()
    # Try in order: as-is, NSE, US exchange
    candidates = [sym]
    if not (sym.endswith(".IN") or sym.endswith(".US") or sym.startswith("^")):
        candidates = [f"{sym}.IN", f"{sym}.US", sym]

    for candidate in candidates:
        d = _stooq_fetch(candidate, days_back=60)
        if d:
            meta = (
                INDIAN_STOCKS.get(candidate)
                or GLOBAL_STOCKS.get(candidate)
                or {}
            )
            return jsonify({"success": True, "data": {**d, **meta}})

    return jsonify({"success": False, "error": f"No data found for '{symbol}'"}), 404


@app.route("/api/stock_prediction/<symbol>")
def stock_prediction(symbol):
    """
    Predict the next close price using a quick trend model and yfinance history.
    """
    pred = _build_prediction(symbol)
    if not pred:
        return jsonify({"success": False, "error": f"Unable to build prediction for '{symbol}'"}), 404
    return jsonify({"success": True, "data": pred})


@app.route("/api/crypto")
def crypto():
    """Live crypto prices from CoinGecko."""
    data = _fetch_crypto_coingecko()
    return jsonify({"success": True, "data": data, "count": len(data)})


@app.route("/api/commodities")
def commodities():
    """Live commodity prices from Stooq."""
    forex_data = _fetch_forex_frankfurter("USD", "INR")
    inr_rate   = forex_data["current_price"] if forex_data else 83.5
    result     = {}
    for sym, meta in COMMODITIES.items():
        d   = _stooq_fetch(sym)
        key = sym.replace(".F", "")
        if d:
            entry = {**d, **meta, "type": "commodity", "currency": "USD"}
            if sym in ("GC.F", "SI.F"):
                entry["price_inr_per_gram"] = round(d["current_price"] * inr_rate / 31.1035, 0)
                entry["inr_per_usd"]        = round(inr_rate, 2)
            result[key] = entry
        else:
            result[key] = {"symbol": sym, "error": "unavailable", **meta}
    return jsonify({"success": True, "data": result})


@app.route("/api/forex")
def forex_pairs():
    """Live forex rates from Frankfurter."""
    pairs  = [("USD","INR"),("EUR","INR"),("GBP","INR"),("JPY","INR"),("AED","INR")]
    result = {}
    for base, target in pairs:
        fd = _fetch_forex_frankfurter(base, target)
        if fd:
            result[f"{base}{target}"] = {**fd, "label": f"{base}/{target}", "type": "forex"}
    return jsonify({"success": True, "data": result})


# ══════════════════════════════════════════════════════════════════
# IN-MEMORY USER / TRANSACTIONS  (same as v4)
# ══════════════════════════════════════════════════════════════════
USERS = {
    1: {
        "id": 1, "username": "new_user",
        "risk_tolerance": "moderate", "investment_goal": "growth",
        "monthly_income": 0, "investment_term": "medium",
        "investment_type": "mixed", "age": 25, "dependents": 0,
        "current_savings": 0, "emergency_fund": 0,
        "monthly_expenses": 0, "debt": 0, "profile_completed": False,
    }
}
TRANSACTIONS = []


@app.route("/api/user/<int:uid>", methods=["GET"])
def get_user(uid):
    u = USERS.get(uid)
    return (jsonify({"success": True, "user": u}) if u
            else (jsonify({"success": False}), 404))


@app.route("/api/user/<int:uid>/profile", methods=["PUT"])
def update_profile(uid):
    if uid not in USERS:
        return jsonify({"success": False}), 404
    body = request.get_json(silent=True) or {}
    for k in ("risk_tolerance", "investment_goal", "monthly_income", "investment_term",
              "investment_type", "age", "dependents", "current_savings",
              "emergency_fund", "monthly_expenses", "debt"):
        if k in body:
            USERS[uid][k] = body[k]
    USERS[uid]["profile_completed"] = True
    return jsonify({"success": True, "user": USERS[uid]})


@app.route("/api/transactions", methods=["POST"])
def add_txn():
    d = request.get_json(silent=True) or {}
    TRANSACTIONS.append({
        "id":               len(TRANSACTIONS) + 1,
        "user_id":          d.get("user_id"),
        "date":             d.get("date"),
        "transaction_type": d.get("transaction_type"),
        "category":         d.get("category"),
        "amount":           float(d.get("amount", 0)),
        "description":      d.get("description", ""),
        "currency":         "INR",
    })
    return jsonify({"success": True, "transaction_id": len(TRANSACTIONS)})


@app.route("/api/transactions/<int:uid>", methods=["GET"])
def get_txns(uid):
    t = sorted(
        [x for x in TRANSACTIONS if x["user_id"] == uid],
        key=lambda x: x["date"] or "", reverse=True,
    )
    return jsonify({"success": True, "transactions": t, "count": len(t)})


# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  FinAI v5 — Multi-Source Live Market Backend")
    print("=" * 60)
    print("  Install:  pip install flask flask-cors pandas numpy requests")
    print()
    print("  Data Sources:")
    print("    Stocks/Indices/Commodities → Stooq")
    print("    Crypto                     → CoinGecko")
    print("    Forex (USD/INR etc.)        → Frankfurter (ECB)")
    print()
    print("  Endpoints:")
    print("    Health:    http://localhost:5000/api/health")
    print("    Overview:  http://localhost:5000/api/market_overview")
    print("    Stock:     http://localhost:5000/api/stock/TCS")
    print("    Crypto:    http://localhost:5000/api/crypto")
    print("    Forex:     http://localhost:5000/api/forex")
    print("    Commodities: http://localhost:5000/api/commodities")
    print("=" * 60 + "\n")
    app.run(debug=True, host="0.0.0.0", port=5000)
