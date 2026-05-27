#!/usr/bin/env node
/**
 * Touchstone LongMemEval — Multi-system Comparison Runner
 *
 * Reads a systems.json config, runs the benchmark + judge against each.
 *
 * systems.json example:
 * [
 *   { "name": "openai-gpt4o", "url": "https://api.openai.com/v1", "model": "gpt-4o", "key_env": "OPENAI_API_KEY" },
 *   { "name": "deepseek-chat", "url": "https://api.deepseek.com/v1", "model": "deepseek-chat", "key_env": "DEEPSEEK_API_KEY" },
 *   { "name": "doubao-pro", "url": "https://ark.cn-beijing.volces.com/api/v3", "model": "doubao-pro-32k", "key_env": "VOLC_API_KEY" },
 *   { "name": "kimi-k2", "url": "https://api.moonshot.cn/v1", "model": "moonshot-v1-32k", "key_env": "MOONSHOT_API_KEY" },
 *   { "name": "yuanbao-hunyuan", "url": "https://api.hunyuan.cloud.tencent.com/v1", "model": "hunyuan-large", "key_env": "HUNYUAN_API_KEY" }
 * ]
 *
 * Judge env (same as judge.cjs):
 *   JUDGE_API_URL, JUDGE_API_KEY, JUDGE_MODEL
 *
 * Usage:
 *   node scripts/compare_systems.cjs --systems=systems.json --output-dir=results/comparison-2026-05-27/
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SYSTEMS_FILE = (process.argv.find(a => a.startsWith('--systems=')) || '--systems=systems.json').split('=')[1];
const OUTPUT_DIR = (process.argv.find(a => a.startsWith('--output-dir=')) || '--output-dir=results/comparison').split('=')[1];

const systems = JSON.parse(fs.readFileSync(SYSTEMS_FILE, 'utf8'));
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function runScript(script, env, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n=== ${label} ===`);
    const p = spawn('node', [script], { env: { ...process.env, ...env }, stdio: 'inherit' });
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
  });
}

(async () => {
  const summary = [];
  for (const sys of systems) {
    const out = path.join(OUTPUT_DIR, `${sys.name}.json`);
    try {
      await runScript(
        path.join(__dirname, 'run_benchmark.cjs'),
        { PROVIDER_API_URL: sys.url, PROVIDER_API_KEY: process.env[sys.key_env] || '', PROVIDER_MODEL: sys.model },
        `Running ${sys.name} (${sys.model})`
      );
      // Move latest run.json to system name
      fs.renameSync('results/run.json', out);
      await runScript(
        path.join(__dirname, 'judge.cjs'),
        { },
        `Judging ${sys.name}`
      );
      const result = JSON.parse(fs.readFileSync(out, 'utf8'));
      summary.push({ name: sys.name, model: sys.model, score: result.tally?.score_percent, by_dim: result.tally?.by_dimension });
    } catch (e) {
      console.error(`[${sys.name}] FAILED:`, e.message);
      summary.push({ name: sys.name, model: sys.model, error: e.message });
    }
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'SUMMARY.json'), JSON.stringify(summary, null, 2));
  console.log('\n=== SUMMARY ===');
  for (const s of summary) {
    if (s.error) console.log(`  ${s.name}: ERROR ${s.error}`);
    else console.log(`  ${s.name} (${s.model}): ${s.score}%`);
  }
})();
