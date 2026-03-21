// Force-kill Crucix on port 3117, restart with fresh .env
import { execSync, spawn } from "child_process";
import http from "http";
import { writeFileSync } from "fs";

// 1. Find the actual PID using port 3117
try {
  const netstat = execSync(
    'netstat -ano | findstr ":3117" | findstr "LISTENING"',
    { encoding: "utf8" },
  );
  console.log("Port 3117 held by:", netstat.trim());
  const pid = netstat.trim().split(/\s+/).pop();
  if (pid && /^\d+$/.test(pid)) {
    console.log(`Killing PID ${pid}...`);
    execSync(`taskkill /PID ${pid} /F`, { encoding: "utf8" });
    console.log("✓ Killed");
  }
} catch (e) {
  console.log("No process on 3117 or kill failed:", e.message);
}

// Wait for port to free up
await new Promise((r) => setTimeout(r, 3000));

// 2. Verify port is free
try {
  const check = execSync(
    'netstat -ano | findstr ":3117" | findstr "LISTENING"',
    { encoding: "utf8" },
  );
  console.log("⚠ Port still in use:", check.trim());
} catch {
  console.log("✓ Port 3117 is free");
}

// 3. Start fresh Crucix
console.log("Starting fresh Crucix...");
const child = spawn("node", ["server.mjs"], {
  cwd: "C:\\Users\\MARK KEKUA\\Documents\\Crucix",
  detached: true,
  stdio: "ignore",
});
child.unref();
console.log(`Spawned PID ${child.pid}`);

// 4. Wait for startup + first sweep
console.log("Waiting for health...");
for (let i = 0; i < 25; i++) {
  await new Promise((r) => setTimeout(r, 2000));
  const h = await new Promise((resolve) => {
    const req = http.get(
      "http://localhost:3117/api/health",
      { timeout: 3000 },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
  if (h) {
    console.log(
      `✓ Alive — refresh: ${h.refreshIntervalMinutes}min, sweep: ${h.sweepInProgress ? "in progress" : "done"}, sources: ${h.sourcesOk}/${h.sourcesOk + h.sourcesFailed}`,
    );
    if (!h.sweepInProgress && h.lastSweep) {
      console.log(`  Last sweep: ${h.lastSweep}`);
      console.log(`  Next sweep: ${h.nextSweep}`);

      // Write final result
      writeFileSync(
        "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\force-restart-result.json",
        JSON.stringify(
          {
            pid: child.pid,
            refreshIntervalMinutes: h.refreshIntervalMinutes,
            sourcesOk: h.sourcesOk,
            sourcesFailed: h.sourcesFailed,
            lastSweep: h.lastSweep,
            nextSweep: h.nextSweep,
          },
          null,
          2,
        ),
      );
      console.log("\n✅ DONE");
      break;
    }
  }
  if (i === 24) console.log("Timed out");
}
