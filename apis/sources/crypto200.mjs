// CoinGecko Top 200 Crypto — Live market data (no API key required)
// Pulls price, 24h change, market cap, volume, ATH, and rank for top 200 coins by market cap
// Free public API — rate limit: 10-30 calls/min, well within Crucix's 15-min sweep cycle

import { safeFetch } from "../utils/fetch.mjs";

const BASE = "https://api.coingecko.com/api/v3";

// Fetch in two batches of 100 to stay within per_page limits
async function fetchPage(page) {
  const url =
    `${BASE}/coins/markets` +
    `?vs_currency=usd` +
    `&order=market_cap_desc` +
    `&per_page=100` +
    `&page=${page}` +
    `&sparkline=false` +
    `&price_change_percentage=1h%2C24h%2C7d`;

  return safeFetch(url, {
    timeout: 20000,
    retries: 2,
    headers: {
      Accept: "application/json",
      "User-Agent": "Crucix/1.0 (OSINT Intelligence Terminal)",
    },
  });
}

function formatCoin(coin, rank) {
  const price = coin.current_price ?? 0;
  const change24h = coin.price_change_percentage_24h ?? 0;
  const change7d = coin.price_change_percentage_7d_in_currency ?? 0;
  const change1h = coin.price_change_percentage_1h_in_currency ?? 0;
  const ath = coin.ath ?? 0;
  const athPct = ath > 0 ? ((price - ath) / ath) * 100 : 0;

  return {
    rank,
    id: coin.id,
    symbol: coin.symbol?.toUpperCase(),
    name: coin.name,
    price,
    change1h: Math.round(change1h * 100) / 100,
    change24h: Math.round(change24h * 100) / 100,
    change7d: Math.round(change7d * 100) / 100,
    marketCap: coin.market_cap ?? 0,
    volume24h: coin.total_volume ?? 0,
    circulatingSupply: coin.circulating_supply ?? 0,
    ath,
    athPct: Math.round(athPct * 100) / 100, // % below ATH (negative = below)
    athDate: coin.ath_date ?? null,
    high24h: coin.high_24h ?? 0,
    low24h: coin.low_24h ?? 0,
    image: coin.image ?? null,
    lastUpdated: coin.last_updated ?? null,
  };
}

export async function collect() {
  // Fetch both pages in parallel
  const [page1, page2] = await Promise.all([fetchPage(1), fetchPage(2)]);

  const rawCoins = [
    ...(Array.isArray(page1) ? page1 : []),
    ...(Array.isArray(page2) ? page2 : []),
  ];

  if (rawCoins.length === 0) {
    return {
      coins: [],
      summary: {
        count: 0,
        error: "No data returned from CoinGecko",
        timestamp: new Date().toISOString(),
      },
    };
  }

  const coins = rawCoins.map((c, i) => formatCoin(c, i + 1));

  // Build summary stats
  const gainers = [...coins]
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 10);
  const losers = [...coins]
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, 10);
  const highVol = [...coins]
    .sort((a, b) => b.volume24h - a.volume24h)
    .slice(0, 10);

  // Market-wide sentiment
  const withChange = coins.filter((c) => c.change24h !== 0);
  const bullCount = withChange.filter((c) => c.change24h > 0).length;
  const bearCount = withChange.filter((c) => c.change24h < 0).length;
  const avgChange = withChange.length
    ? Math.round(
        (withChange.reduce((s, c) => s + c.change24h, 0) / withChange.length) *
          100,
      ) / 100
    : 0;

  // Total market cap (sum of top 200)
  const totalMarketCap = coins.reduce((s, c) => s + c.marketCap, 0);
  const totalVolume = coins.reduce((s, c) => s + c.volume24h, 0);

  // Bitcoin / Ethereum dominance
  const btc = coins.find((c) => c.id === "bitcoin");
  const eth = coins.find((c) => c.id === "ethereum");
  const btcDominance =
    btc && totalMarketCap > 0
      ? Math.round((btc.marketCap / totalMarketCap) * 10000) / 100
      : null;
  const ethDominance =
    eth && totalMarketCap > 0
      ? Math.round((eth.marketCap / totalMarketCap) * 10000) / 100
      : null;

  return {
    coins,
    summary: {
      count: coins.length,
      bullCount,
      bearCount,
      avgChange24h: avgChange,
      marketSentiment:
        avgChange > 1 ? "BULLISH" : avgChange < -1 ? "BEARISH" : "NEUTRAL",
      totalMarketCapUSD: totalMarketCap,
      totalVolume24hUSD: totalVolume,
      btcDominancePct: btcDominance,
      ethDominancePct: ethDominance,
      top3: coins
        .slice(0, 3)
        .map((c) => `${c.symbol} $${c.price.toLocaleString()}`),
      timestamp: new Date().toISOString(),
    },
    gainers24h: gainers.map((c) => `${c.symbol} +${c.change24h}%`),
    losers24h: losers.map((c) => `${c.symbol} ${c.change24h}%`),
    highestVolume: highVol.map(
      (c) => `${c.symbol} $${(c.volume24h / 1e6).toFixed(0)}M`,
    ),
  };
}

export async function briefing() {
  return collect();
}
