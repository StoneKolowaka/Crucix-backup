// Full dashboard verification — tests every data path
import http from "http";
import { writeFileSync } from "fs";

const get = (url) =>
  new Promise((r) => {
    const req = http.get(url, { timeout: 15000 }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          r({ status: res.statusCode, data: JSON.parse(d) });
        } catch {
          r({ status: res.statusCode, raw: d.substring(0, 300) });
        }
      });
    });
    req.on("error", (e) => r({ error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      r({ error: "timeout" });
    });
  });

const results = {};

// 1. Crucix direct
const cx = await get("http://localhost:3117/api/data");
results.crucixDirect = cx.error
  ? { error: cx.error }
  : {
      ok: true,
      keys: Object.keys(cx.data),
      newsCount: cx.data.newsFeed?.length,
      ideasCount: cx.data.ideas?.length,
      marketsKeys: cx.data.markets ? Object.keys(cx.data.markets) : [],
      vix: cx.data.markets?.vix,
      indexes: cx.data.markets?.indexes
        ? Object.keys(cx.data.markets.indexes)
        : [],
      rates: cx.data.markets?.rates ? Object.keys(cx.data.markets.rates) : [],
      commodities: cx.data.markets?.commodities
        ? Object.keys(cx.data.markets.commodities)
        : [],
      energyWTI: cx.data.energy?.wti?.price,
      energyBrent: cx.data.energy?.brent?.price,
      fredKeys: cx.data.fred ? Object.keys(cx.data.fred) : [],
      blsKeys: cx.data.bls ? Object.keys(cx.data.bls) : [],
      treasuryKeys: cx.data.treasury ? Object.keys(cx.data.treasury) : [],
      gscpi: cx.data.gscpi,
      defenseContracts: cx.data.defense?.length,
      spaceEvents: cx.data.space?.length,
      healthSources:
        cx.data.health?.filter((h) => h.ok)?.length +
        "/" +
        cx.data.health?.length,
    };

// 2. sms-bridge proxy
const proxy = await get("http://localhost:3200/api/dashboard/crucix");
results.proxyWorks = !proxy.error && proxy.status === 200;

// 3. Markets tab dependencies
results.markets = {
  vix: cx.data?.markets?.vix ?? "MISSING",
  sp500: cx.data?.markets?.indexes?.sp500 ?? "MISSING",
  nasdaq: cx.data?.markets?.indexes?.nasdaq ?? "MISSING",
  dow: cx.data?.markets?.indexes?.dow ?? "MISSING",
  fed: cx.data?.markets?.rates?.fed ?? "MISSING",
  gold: cx.data?.markets?.commodities?.gold ?? "MISSING",
  wti: cx.data?.energy?.wti?.price ?? "MISSING",
  brent: cx.data?.energy?.brent?.price ?? "MISSING",
  natgas: cx.data?.energy?.natgas?.price ?? "MISSING",
};

// 4. Elon tab — check newsFeed for Elon-related items
const elonKeywords = /musk|tesla|spacex|xai|x\.com|doge|neuralink/i;
const elonNews =
  cx.data?.newsFeed?.filter((n) =>
    elonKeywords.test(n.title || n.text || ""),
  ) || [];
results.elon = {
  totalNews: cx.data?.newsFeed?.length,
  elonRelated: elonNews.length,
  sample: elonNews
    .slice(0, 3)
    .map((n) => (n.title || n.text || "").substring(0, 100)),
};

// 5. Intel tab dependencies
results.intel = {
  healthSources: cx.data?.health?.length,
  deltaChanges: cx.data?.delta?.changes?.length,
  airRegions: cx.data?.air?.length,
  nukeEvents: cx.data?.nuke?.length,
  spaceEvents: cx.data?.space?.length,
  defenseContracts: cx.data?.defense?.length,
  ideas: cx.data?.ideas?.length,
  ideasSource: cx.data?.ideasSource,
};

// 6. News ticker
results.ticker = {
  newsItems: cx.data?.newsFeed?.length,
  sample: cx.data?.newsFeed
    ?.slice(0, 2)
    .map((n) => (n.title || n.text || "").substring(0, 80)),
};

// 7. Other endpoints
const crypto = await get("http://localhost:3200/api/dashboard/crypto");
results.crypto = {
  ok: !crypto.error,
  coins: crypto.data?.coins?.length,
  analysis: !!crypto.data?.analysis,
};

const signals = await get("http://localhost:3200/api/dashboard/signals");
results.signals = { ok: !signals.error, data: signals.data };

const defi = await get("http://localhost:3200/api/dashboard/defi");
results.defi = defi.data || { error: defi.error };

const osint = await get("http://localhost:3200/api/dashboard/osint");
results.osint = osint.data || { error: osint.error };

writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\dashboard-verify.json",
  JSON.stringify(results, null, 2),
);
console.log("WROTE dashboard-verify.json");
