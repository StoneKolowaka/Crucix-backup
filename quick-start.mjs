// Quick-start Crucix + verify — writes to quick-result.json
import { execSync, spawn } from "child_process";
import { writeFileSync, existsSync } from "fs";
import http from "http";

const result = { timestamp: new Date().toISOString(), steps: [] };
const log = (step, ok, msg) => {
  result.steps.push({ step, ok, msg });
  console.log(`${ok ? "✓" : "✗"} ${step}: ${msg}`);
};

// 1. Check if Crucix already running
try {
  const tasklist = execSync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV', {
    encoding: "utf8",
  });
  const nodeProcs = tasklist.split("\n").filter((l) => l.includes("node.exe"));
  log("check-processes", true, `${nodeProcs.length} node processes found`);
} catch (e) {
  log("check-processes", false, e.message);
}

// 2. Test if port 3117 is already responding
function testPort(port) {
  return new Promise((resolve) => {
    const req = http.get(
      `http://localhost:${port}/api/health`,
      { timeout: 3000 },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ ok: res.statusCode === 200, data }));
      },
    );
    req.on("error", () => resolve({ ok: false, data: null }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, data: null });
    });
  });
}

const health = await testPort(3117);
if (health.ok) {
  log("crucix-alive", true, `Already running: ${health.data}`);
} else {
  log("crucix-alive", false, "Not running — starting now...");

  // 3. Start Crucix detached
  try {
    const child = spawn("node", ["server.mjs"], {
      cwd: "C:\\Users\\MARK KEKUA\\Documents\\Crucix",
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();
    log("start-crucix", true, `Spawned detached PID ${child.pid}`);

    // Wait for it to come up
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const h = await testPort(3117);
      if (h.ok) {
        log("wait-startup", true, `Crucix responding after ${(i + 1) * 2}s`);
        break;
      }
      if (i === 14) log("wait-startup", false, "Timed out after 30s");
    }
  } catch (e) {
    log("start-crucix", false, e.message);
  }
}

// 4. Test sms-bridge proxy to crucix
const proxy = await testPort(3200).then(() => {
  return new Promise((resolve) => {
    const req = http.get(
      "http://localhost:3200/api/dashboard/crucix",
      { timeout: 10000 },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          resolve({
            ok: res.statusCode === 200,
            status: res.statusCode,
            preview: data.substring(0, 300),
          }),
        );
      },
    );
    req.on("error", (e) => resolve({ ok: false, error: e.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, error: "timeout" });
    });
  });
});
log(
  "proxy-test",
  proxy.ok,
  proxy.ok
    ? `${proxy.status} — ${proxy.preview}`
    : `Failed: ${proxy.error || proxy.status}`,
);

// 5. Register scheduled task
try {
  const check = execSync(
    'schtasks /Query /TN "Crucix Intelligence Engine" /FO CSV 2>&1',
    { encoding: "utf8" },
  );
  if (check.includes("Crucix Intelligence Engine")) {
    log("scheduled-task", true, "Already registered");
  } else {
    throw new Error("Not found");
  }
} catch {
  try {
    execSync(
      `schtasks /Create /TN "Crucix Intelligence Engine" /TR "wscript.exe \\"C:\\Users\\MARK KEKUA\\Documents\\Crucix\\start-crucix.vbs\\"" /SC ONLOGON /RL HIGHEST /F`,
      { encoding: "utf8" },
    );
    log("scheduled-task", true, "Registered successfully");
  } catch (e) {
    log("scheduled-task", false, `Registration failed: ${e.message}`);
  }
}

// 6. Test /api/data (crucix full data)
const dataTest = await new Promise((resolve) => {
  const req = http.get(
    "http://localhost:3117/api/data",
    { timeout: 10000 },
    (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          const j = JSON.parse(data);
          const keys = Object.keys(j);
          resolve({
            ok: true,
            keys,
            newsCount: j.newsFeed?.length || 0,
            ideasCount: j.ideas?.length || 0,
            sourcesOk: j.health?.filter((h) => h.ok)?.length || 0,
          });
        } catch {
          resolve({ ok: true, raw: data.substring(0, 200) });
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
log("crucix-data", dataTest.ok, JSON.stringify(dataTest));

// Write results
writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\quick-result.json",
  JSON.stringify(result, null, 2),
);
console.log("\n✅ Results written to quick-result.json");
