// Diagnose crypto + elon refresh issues
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
          r({ status: res.statusCode, raw: d.substring(0, 500) });
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

// 1. Test crypto endpoint
console.log("Testing /api/dashboard/crypto...");
const t1 = Date.now();
const crypto = await get("http://localhost:3200/api/dashboard/crypto");
results.crypto = {
  responseTime: Date.now() - t1 + "ms",
  status: crypto.status,
  error: crypto.error,
  coins: crypto.data?.coins?.length ?? 0,
  btcPrice: crypto.data?.analysis?.btcPrice,
  ethPrice: crypto.data?.analysis?.ethPrice,
};
console.log(
  `  ${results.crypto.responseTime} — ${results.crypto.coins} coins, BTC $${results.crypto.btcPrice}`,
);

// 2. Test crucix endpoint (elon depends on this)
console.log("Testing /api/dashboard/crucix...");
const t2 = Date.now();
const crucix = await get("http://localhost:3200/api/dashboard/crucix");
results.crucix = {
  responseTime: Date.now() - t2 + "ms",
  status: crucix.status,
  error: crucix.error,
  newsFeedCount: crucix.data?.newsFeed?.length ?? 0,
};

// Check elon-related news
const feed = crucix.data?.newsFeed || crucix.data?.news || [];
const elonRegex =
  /musk|tesla|spacex|xai|doge|dogecoin|crypto.*musk|musk.*crypto/i;
const teslaRegex = /tesla/i;
const spacexRegex = /spacex|starship|starlink/i;
const elonItems = feed.filter((item) => {
  const text = (item.headline || item.title || "") + (item.source || "");
  return (
    elonRegex.test(text) || teslaRegex.test(text) || spacexRegex.test(text)
  );
});
results.elon = {
  totalFeedItems: feed.length,
  elonRelated: elonItems.length,
  feedItemFields: feed[0] ? Object.keys(feed[0]) : "NO_ITEMS",
  sample: feed.slice(0, 3).map((n) => ({
    headline: n.headline?.substring(0, 80),
    title: n.title?.substring(0, 80),
    source: n.source,
    region: n.region,
  })),
  elonSample: elonItems.slice(0, 3).map((n) => ({
    headline: n.headline?.substring(0, 80),
    title: n.title?.substring(0, 80),
    source: n.source,
  })),
};
console.log(
  `  ${results.crucix.responseTime} — ${feed.length} news, ${elonItems.length} elon-related`,
);

// 3. Test crypto endpoint response headers (check for caching issues)
console.log("Testing crypto cache...");
const crypto2 = await get("http://localhost:3200/api/dashboard/crypto");
results.cryptoCache = {
  btcPrice1: crypto.data?.analysis?.btcPrice,
  btcPrice2: crypto2.data?.analysis?.btcPrice,
  same: crypto.data?.analysis?.btcPrice === crypto2.data?.analysis?.btcPrice,
};

// 4. Check Crucix health for sweep status
const health = await get("http://localhost:3117/api/health");
results.crucixHealth = health.data || health.error;

writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\refresh-diag.json",
  JSON.stringify(results, null, 2),
);
console.log("WROTE refresh-diag.json");
