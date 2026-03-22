// Test gas and defi API fixes
import https from "https";
import { writeFileSync } from "fs";

function request(url, opts = {}) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const reqOpts = {
      method: opts.method || "GET",
      headers: { "User-Agent": "Stone-AI/1.0", ...opts.headers },
    };
    const req = https.request(url, reqOpts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(d) });
        } catch {
          resolve({ status: res.statusCode, data: d.substring(0, 500) });
        }
      });
    });
    req.on("error", (e) => resolve({ error: e.message }));
    setTimeout(() => {
      req.destroy();
      resolve({ error: "timeout" });
    }, 10000);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

const results = {};

// Test 1: Public ETH RPC for gas
console.log("Testing ETH RPC gas price...");
const gasRes = await request("https://eth.llamarpc.com", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "eth_gasPrice",
    params: [],
    id: 1,
  }),
});
if (gasRes.data?.result) {
  const gwei = Math.round(parseInt(gasRes.data.result, 16) / 1e9);
  results.gas = { ok: true, gwei, raw: gasRes.data.result };
  console.log(`  Gas: ${gwei} Gwei`);
} else {
  results.gas = { ok: false, ...gasRes };
  console.log(`  Gas failed: ${JSON.stringify(gasRes)}`);
}

// Test 2: DeFiLlama via llama.fi domain
console.log("Testing DeFiLlama via llama.fi...");
const defiRes = await request("https://api.llama.fi/protocols");
if (defiRes.status === 200 && Array.isArray(defiRes.data)) {
  const top5 = defiRes.data
    .slice(0, 5)
    .map((p) => ({ name: p.name, tvl: p.tvl }));
  results.defi = { ok: true, totalProtocols: defiRes.data.length, top5 };
  console.log(`  DeFi: ${defiRes.data.length} protocols`);
} else {
  results.defi = { ok: false, ...defiRes };
  console.log(`  DeFi failed: ${JSON.stringify(defiRes).substring(0, 200)}`);
}

// Test 3: Original defillama.com (the broken one)
console.log("Testing original defillama.com...");
const oldDefi = await request("https://api.defillama.com/protocols");
results.oldDefi = oldDefi.error
  ? { ok: false, error: oldDefi.error }
  : { ok: true, status: oldDefi.status };
console.log(`  Old domain: ${oldDefi.error || oldDefi.status}`);

writeFileSync(
  "C:\\Users\\MARK KEKUA\\Documents\\Crucix\\api-test.json",
  JSON.stringify(results, null, 2),
);
console.log("\nWROTE api-test.json");
