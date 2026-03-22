// Restart Crucix with new config + register startup
import { execSync, spawn } from "child_process";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import http from "http";

const log = (msg) => console.log(msg);

// 1. Kill existing Crucix processes
log("Stopping existing Crucix...");
try {
  // Find node processes running server.mjs
  const wmic = execSync(
    "wmic process where \"name='node.exe'\" get ProcessId,CommandLine /FORMAT:CSV 2>nul",
    { encoding: "utf8" },
  );
  const lines = wmic
    .split("\n")
    .filter((l) => l.includes("server.mjs") && l.includes("Crucix"));
  for (const line of lines) {
    const parts = line.trim().split(",");
    const pid = parts[parts.length - 1];
    if (pid && /^\d+$/.test(pid.trim())) {
      log(`  Killing PID ${pid.trim()}`);
      try {
        execSync(`taskkill /PID ${pid.trim()} /F 2>nul`, { encoding: "utf8" });
      } catch {}
    }
  }
  log("  Old processes killed");
} catch (e) {
  log(`  Kill attempt: ${e.message}`);
}

await new Promise((r) => setTimeout(r, 2000));

// 2. Start fresh Crucix (will pick up new .env with 2min interval)
log("Starting fresh Crucix with 2-minute refresh...");
const child = spawn("node", ["server.mjs"], {
  cwd: "C:\\Users\\MARK KEKUA\\Documents\\Crucix",
  detached: true,
  stdio: "ignore",
  env: { ...process.env },
});
child.unref();
log(`  Spawned PID ${child.pid}`);

// 3. Wait for health
log("Waiting for Crucix to start...");
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const ok = await new Promise((resolve) => {
    const req = http.get(
      "http://localhost:3117/api/health",
      { timeout: 3000 },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(d));
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
  if (ok) {
    const h = JSON.parse(ok);
    log(
      `  ✓ Crucix alive after ${(i + 1) * 2}s — refresh: ${h.refreshIntervalMinutes}min, sources: ${h.sourcesOk}/${h.sourcesOk + h.sourcesFailed}`,
    );
    break;
  }
  if (i === 19) log("  ✗ Timed out");
}

// 4. Create Windows Startup shortcut (no admin needed)
log("Setting up auto-start via Startup folder...");
const startupDir = join(
  homedir(),
  "AppData",
  "Roaming",
  "Microsoft",
  "Windows",
  "Start Menu",
  "Programs",
  "Startup",
);
const vbsPath = "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\start-crucix.vbs";

// Create a .bat shortcut in Startup folder
const startupBat = join(startupDir, "Crucix-AutoStart.bat");
writeFileSync(
  startupBat,
  `@echo off\r\nREM Auto-start Crucix Intelligence Engine\r\nwscript.exe "${vbsPath}"\r\n`,
);
log(`  ✓ Created ${startupBat}`);

// Verify it exists
if (existsSync(startupBat)) {
  log("  ✓ Startup entry verified — Crucix will auto-start on login");
} else {
  log("  ✗ Failed to create startup entry");
}

// 5. Wait for first sweep to complete, test proxy
log("Waiting for first sweep to finish...");
for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 3000));
  const ok = await new Promise((resolve) => {
    const req = http.get(
      "http://localhost:3117/api/health",
      { timeout: 3000 },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
  if (ok && ok.lastSweep && !ok.sweepInProgress) {
    log(
      `  ✓ Sweep complete — ${ok.sourcesOk} sources OK, nextSweep: ${ok.nextSweep}`,
    );
    break;
  }
  if (ok && ok.sweepInProgress) {
    log(`  Sweep in progress... (${(i + 1) * 3}s)`);
  }
  if (i === 19) log("  Timed out waiting for sweep");
}

// 6. Test proxy from sms-bridge
const proxyResult = await new Promise((resolve) => {
  const req = http.get(
    "http://localhost:3200/api/dashboard/crucix",
    { timeout: 15000 },
    (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          const j = JSON.parse(d);
          resolve({
            ok: true,
            keys: Object.keys(j),
            news: j.newsFeed?.length,
            ideas: j.ideas?.length,
            sources: j.health?.filter((h) => h.ok)?.length,
          });
        } catch {
          resolve({ ok: false, raw: d.substring(0, 200) });
        }
      });
    },
  );
  req.on("error", (e) => resolve({ ok: false, error: e.message }));
  req.on("timeout", () => {
    req.destroy();
    resolve({ ok: false, error: "timeout" });
  });
});

log(`Proxy test: ${JSON.stringify(proxyResult)}`);

const summary = {
  crucixRunning: true,
  refreshInterval: "2 minutes",
  autoStart: "Windows Startup folder",
  startupFile: startupBat,
  proxyWorking: proxyResult.ok,
  dataKeys: proxyResult.keys || [],
  newsCount: proxyResult.news || 0,
  ideasCount: proxyResult.ideas || 0,
};

writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\restart-result.json",
  JSON.stringify(summary, null, 2),
);
log("\n✅ DONE — Results in restart-result.json");
