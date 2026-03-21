// Final status check — is everything alive?
import http from "http";
import { writeFileSync } from "fs";

const get = (url) =>
  new Promise((r) => {
    const req = http.get(url, { timeout: 10000 }, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          r(JSON.parse(d));
        } catch {
          r({ raw: d.substring(0, 200) });
        }
      });
    });
    req.on("error", (e) => r({ error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      r({ error: "timeout" });
    });
  });

const r = {};

// Crucix health
r.crucix = await get("http://localhost:3117/api/health");

// sms-bridge health
r.smsBridge = await get("http://localhost:3200/health");

// Crucix proxy through sms-bridge
const cx = await get("http://localhost:3200/api/dashboard/crucix");
r.crucixProxy = cx.error
  ? { error: cx.error }
  : {
      ok: true,
      keys: Object.keys(cx).length,
      news: cx.newsFeed?.length,
      ideas: cx.ideas?.length,
    };

// Gas + DeFi
const defi = await get("http://localhost:3200/api/dashboard/defi");
r.gas = defi.gas;
r.defi = {
  protocols: defi.defi?.protocols?.length,
  tvl: defi.defi?.totalTVL,
  error: defi.defi?.error,
};

// Crypto
const crypto = await get("http://localhost:3200/api/dashboard/crypto");
r.crypto = { coins: crypto.coins?.length, btc: crypto.analysis?.btcPrice };

// Auto-start file check
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
const startupBat = join(
  homedir(),
  "AppData",
  "Roaming",
  "Microsoft",
  "Windows",
  "Start Menu",
  "Programs",
  "Startup",
  "Crucix-AutoStart.bat",
);
r.autoStart = existsSync(startupBat) ? "INSTALLED" : "MISSING";

writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\live-status.json",
  JSON.stringify(r, null, 2),
);
console.log("WROTE");
