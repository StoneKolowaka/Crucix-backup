// Quick Crucix verification - writes results to setup-result.txt
import { execSync } from "child_process";
import { writeFileSync } from "fs";

const results = [];
const log = (msg) => {
  results.push(msg);
  console.log(msg);
};

// Check scheduled task
try {
  const task = execSync(
    'schtasks /Query /TN "Crucix Intelligence Engine" /FO CSV /NH',
    { encoding: "utf8", timeout: 5000 },
  );
  log("[OK] Scheduled task: " + task.trim().split(",")[2]);
} catch {
  log("[MISSING] Scheduled task not found - will register");
  try {
    execSync(
      "powershell -Command \"Register-ScheduledTask -TaskName 'Crucix Intelligence Engine' -Action (New-ScheduledTaskAction -Execute wscript.exe -Argument '\\\"C:\\Users\\MARK KEKUA\\Documents\\Crucix\\start-crucix.vbs\\\"' -WorkingDirectory 'C:\\Users\\MARK KEKUA\\Documents\\Crucix') -Trigger (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME) -Settings (New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable) -Force\"",
      { encoding: "utf8", timeout: 10000 },
    );
    log("[OK] Task registered");
  } catch (e) {
    log("[FAIL] Task register error: " + e.message);
  }
}

// Check if Crucix is running
try {
  const resp = await fetch("http://localhost:3117/api/health");
  const data = await resp.json();
  log("[OK] Crucix RUNNING: " + JSON.stringify(data).substring(0, 200));
} catch {
  log("[DOWN] Crucix not running, starting...");
  try {
    execSync(
      'wscript.exe "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\start-crucix.vbs"',
      { timeout: 3000, cwd: "C:\\Users\\MARK KEKUA\\Documents\\Crucix" },
    );
  } catch {}
  // Wait for it
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const resp = await fetch("http://localhost:3117/api/health");
      const data = await resp.json();
      log(
        "[OK] Crucix RUNNING after " +
          (i + 1) * 5 +
          "s: " +
          JSON.stringify(data).substring(0, 200),
      );
      break;
    } catch {
      log("[WAIT] Still starting... (" + (i + 1) * 5 + "s)");
    }
  }
}

// Check sms-bridge can reach Crucix
try {
  const resp = await fetch("http://localhost:3200/api/dashboard/crucix");
  const data = await resp.json();
  const keys = Object.keys(data);
  log(
    "[OK] Dashboard->Crucix proxy works: " +
      keys.length +
      " keys: " +
      keys.join(", "),
  );
} catch (e) {
  log("[FAIL] Dashboard->Crucix: " + e.message);
}

writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\setup-result.txt",
  results.join("\n"),
);
log("\nDone. Results saved to setup-result.txt");
