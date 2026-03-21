// Wait for sweep to complete, then verify data
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
          r(null);
        }
      });
    });
    req.on("error", () => r(null));
    req.on("timeout", () => {
      req.destroy();
      r(null);
    });
  });

// Wait for sweep to complete
console.log("Waiting for sweep to complete...");
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const h = await get("http://localhost:3117/api/health");
  if (h) {
    console.log(
      `${(i + 1) * 3}s: sweep=${h.sweepInProgress}, srcs=${h.sourcesOk}/${h.sourcesOk + h.sourcesFailed}`,
    );
    if (!h.sweepInProgress && h.lastSweep) {
      console.log("Sweep done! Checking data...");

      const data = await get("http://localhost:3117/api/data");
      if (data) {
        const result = {
          health: h,
          vix: data.markets?.vix,
          indexes: data.markets?.indexes,
          rates: data.markets?.rates,
          commodities: data.markets?.commodities,
          energy: {
            wti: data.energy?.wti?.price,
            brent: data.energy?.brent?.price,
            natgas: data.energy?.natgas?.price,
          },
          fred: data.fred ? Object.keys(data.fred) : "empty",
          bls: data.bls ? Object.keys(data.bls) : "empty",
          treasury: data.treasury,
          gscpi: data.gscpi,
          newsCount: data.newsFeed?.length,
          newsSample: data.newsFeed
            ?.slice(0, 2)
            .map((n) => (n.title || n.text || "").substring(0, 80)),
          ideasCount: data.ideas?.length,
          ideasSource: data.ideasSource,
          deltaChanges: data.delta?.changes?.length,
          defenseContracts: data.defense?.length,
          spaceEvents: data.space?.length,
          healthSrcOk: data.health?.filter((s) => s.ok)?.length,
          healthSrcTotal: data.health?.length,
        };
        writeFileSync(
          "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\sweep-data.json",
          JSON.stringify(result, null, 2),
        );
        console.log("WROTE sweep-data.json");
      }
      break;
    }
  }
}
