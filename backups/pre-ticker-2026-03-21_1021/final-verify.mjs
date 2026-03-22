// Final end-to-end dashboard verification
import http from "http";
import { writeFileSync } from "fs";

const get = (url) =>
  new Promise((r) => {
    const req = http.get(url, { timeout: 15000 }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          r(JSON.parse(d));
        } catch {
          r({ raw: d.substring(0, 300) });
        }
      });
    });
    req.on("error", (e) => r({ error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      r({ error: "timeout" });
    });
  });

const BASE = "http://localhost:3200";
const report = {};

// 1. CRYPTO TAB
const crypto = await get(`${BASE}/api/dashboard/crypto`);
report.crypto = {
  ok: !!crypto.coins,
  coins: crypto.coins?.length || 0,
  analysis: crypto.analysis
    ? {
        btcPrice: crypto.analysis.btcPrice,
        ethPrice: crypto.analysis.ethPrice,
        btcDominance: crypto.analysis.btcDominance,
        sentiment: crypto.analysis.sentiment,
      }
    : "MISSING",
};

// 2. MARKETS TAB (depends on crucix + defi)
const cx = await get(`${BASE}/api/dashboard/crucix`);
const defi = await get(`${BASE}/api/dashboard/defi`);
const signals = await get(`${BASE}/api/dashboard/signals`);
report.markets = {
  crucixOk: !cx.error && !!cx.markets,
  vix: cx.markets?.vix?.value ?? "MISSING",
  indexes: cx.markets?.indexes?.length ?? 0,
  rates: cx.markets?.rates?.length ?? 0,
  commodities: cx.markets?.commodities?.length ?? 0,
  energy: {
    wti: cx.energy?.wti?.price,
    brent: cx.energy?.brent?.price,
    natgas: cx.energy?.natgas?.price,
  },
  fredKeys: cx.fred ? Object.keys(cx.fred).length : 0,
  blsKeys: cx.bls ? Object.keys(cx.bls).length : 0,
  treasury: cx.treasury?.totalDebt
    ? "$" + (cx.treasury.totalDebt / 1e12).toFixed(2) + "T"
    : "MISSING",
  gscpi: cx.gscpi?.value ?? "MISSING",
  gas:
    defi.gas?.standard !== null ? `${defi.gas.standard} Gwei` : "UNAVAILABLE",
  defiTVL: defi.defi?.totalTVL
    ? "$" + (defi.defi.totalTVL / 1e9).toFixed(0) + "B"
    : "MISSING",
  defiProtocols: defi.defi?.protocols?.length ?? 0,
  ideas: cx.ideas?.length ?? 0,
  ideasSource: cx.ideasSource,
};

// 3. TECH TAB
const techNews = await get(`${BASE}/api/tech-news`);
report.tech = {
  newsItems: techNews.items?.length ?? 0,
  sample:
    techNews.items?.slice(0, 2).map((n) => n.title?.substring(0, 60)) || [],
};

// 4. ELON TAB (depends on crucix newsFeed)
const elonRe = /musk|tesla|spacex|xai|x\.com|doge|neuralink/i;
const allNews = cx.newsFeed || [];
const elonNews = allNews.filter((n) =>
  elonRe.test(n.title || n.text || n.headline || ""),
);
report.elon = {
  totalNewsFeed: allNews.length,
  elonRelated: elonNews.length,
  note:
    elonNews.length === 0
      ? "No Elon-related news in current cycle (normal)"
      : undefined,
  sample: elonNews
    .slice(0, 3)
    .map((n) => (n.title || n.text || n.headline || "").substring(0, 80)),
};

// 5. INTEL TAB (depends on crucix + osint)
const osint = await get(`${BASE}/api/dashboard/osint`);
report.intel = {
  healthSources: cx.health?.length ?? 0,
  delta: cx.delta?.changes?.length ?? 0,
  airRegions: cx.air?.length ?? 0,
  nukeEvents: cx.nuke?.length ?? 0,
  spaceEvents: cx.space?.length ?? 0,
  defenseContracts: cx.defense?.length ?? 0,
  ideas: cx.ideas?.length ?? 0,
  osintBriefing: osint.briefing?.length ?? 0,
};

// 6. NEWS TICKER
report.ticker = {
  items: allNews.length,
  sample: allNews
    .slice(0, 2)
    .map((n) => (n.title || n.text || n.headline || "").substring(0, 80)),
};

// 7. CHAT
report.chat = { note: "Chat uses Anthropic API — tested separately" };

// SUMMARY
const issues = [];
if (report.crypto.coins === 0) issues.push("No crypto coins");
if (!report.markets.crucixOk) issues.push("Crucix proxy failed");
if (report.markets.vix === "MISSING") issues.push("VIX missing");
if (report.markets.indexes === 0) issues.push("No indexes");
if (report.markets.gas === "UNAVAILABLE") issues.push("Gas unavailable");
if (report.markets.defiProtocols === 0) issues.push("No DeFi data");
if (report.tech.newsItems === 0) issues.push("No tech news");
if (report.intel.healthSources === 0) issues.push("No health sources");
if (report.ticker.items === 0) issues.push("No news for ticker");

report.summary = {
  totalIssues: issues.length,
  issues,
  verdict:
    issues.length === 0 ? "ALL TABS WORKING" : `${issues.length} issues found`,
};

writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\final-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report.summary));
console.log("WROTE final-report.json");
