import http from "http";
import { writeFileSync } from "fs";

const get = (url) =>
  new Promise((r) => {
    const req = http.get(url, { timeout: 8000 }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          r(JSON.parse(d));
        } catch {
          r({ raw: d.substring(0, 500) });
        }
      });
    });
    req.on("error", (e) => r({ error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      r({ error: "timeout" });
    });
  });

const health = await get("http://localhost:3117/api/health");
const proxy = await get("http://localhost:3200/api/dashboard/crucix");

const result = {
  health,
  proxyOk: !proxy.error,
  proxyKeys: proxy.error ? null : Object.keys(proxy),
  newsCount: proxy.newsFeed?.length || 0,
  ideasCount: proxy.ideas?.length || 0,
  marketsKeys: proxy.markets ? Object.keys(proxy.markets) : [],
  energyKeys: proxy.energy ? Object.keys(proxy.energy) : [],
};

writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\status.json",
  JSON.stringify(result, null, 2),
);
console.log("WROTE status.json");
