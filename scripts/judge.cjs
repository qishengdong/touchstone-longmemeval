#!/usr/bin/env node
/**
 * Touchstone LongMemEval — LLM-as-Judge Runner
 *
 * Reads benchmark results, scores each (q, expect, reply) with an LLM judge,
 * tallies pass/fail by 6 dimensions.
 *
 * Usage:
 *   JUDGE_API_URL=https://api.openai.com/v1 \
 *   JUDGE_API_KEY=sk-... \
 *   JUDGE_MODEL=gpt-4o \
 *   node scripts/judge.cjs --input=results/my_run.json
 *
 * Or use DeepSeek (cheaper, supports zh-CN well):
 *   JUDGE_API_URL=https://api.deepseek.com/v1
 *   JUDGE_API_KEY=sk-...
 *   JUDGE_MODEL=deepseek-chat
 */

const fs = require('fs');
const path = require('path');

const JUDGE_API_URL = process.env.JUDGE_API_URL;
const JUDGE_API_KEY = process.env.JUDGE_API_KEY || '';
const JUDGE_MODEL = process.env.JUDGE_MODEL || 'gpt-4o';
const INPUT = (process.argv.find(a => a.startsWith('--input=')) || '--input=results/run.json').split('=')[1];
const OUTPUT = (process.argv.find(a => a.startsWith('--output=')) || `--output=${INPUT}`).split('=')[1];

if (!JUDGE_API_URL) {
  console.error('ERROR: JUDGE_API_URL env required');
  process.exit(1);
}
if (!fs.existsSync(INPUT)) {
  console.error(`ERROR: input file not found: ${INPUT}`);
  process.exit(1);
}

const judgePrompt = fs.readFileSync(path.join(__dirname, '..', 'data', 'judge_prompt.txt'), 'utf8');
const data = JSON.parse(fs.readFileSync(INPUT, 'utf8'));

async function judgeOne(q) {
  const userMsg = `问题: ${q.q}\n\n标准答案: ${q.expect}\n\nSivon 回答: ${q.reply}\n\n维度: ${q.dim}`;
  const url = `${JUDGE_API_URL.replace(/\/$/, '')}/chat/completions`;
  const body = JSON.stringify({
    model: JUDGE_MODEL,
    messages: [
      { role: 'system', content: judgePrompt },
      { role: 'user', content: userMsg },
    ],
    temperature: 0,
    max_tokens: 200,
  });
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${JUDGE_API_KEY}`,
  };
  const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Judge HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const raw = json.choices?.[0]?.message?.content || '';
  // Parse pass/fail + reason
  let parsed;
  try {
    const m = raw.match(/\{[\s\S]*\}/);
    parsed = m ? JSON.parse(m[0]) : { pass: false, reason: 'judge no valid JSON' };
  } catch (e) {
    parsed = { pass: false, reason: 'judge parse error: ' + e.message };
  }
  return { pass: !!parsed.pass, reason: String(parsed.reason || '').slice(0, 200), raw };
}

async function main() {
  console.log(`# Judging ${data.questions.length} questions with ${JUDGE_MODEL}`);
  let i = 0;
  for (const q of data.questions) {
    i++;
    if (!q.reply || q.error) {
      q.judge = { pass: false, reason: 'no reply or error in run' };
      continue;
    }
    try {
      q.judge = await judgeOne(q);
    } catch (e) {
      q.judge = { pass: false, reason: 'judge error: ' + e.message };
    }
    if (i % 10 === 0) {
      process.stdout.write(`${new Date().toISOString()} ${i}/${data.questions.length}\n`);
    }
  }
  // Tally
  const byDim = {};
  let total = 0;
  for (const q of data.questions) {
    byDim[q.dim] = byDim[q.dim] || { pass: 0, total: 0 };
    byDim[q.dim].total++;
    if (q.judge.pass) { byDim[q.dim].pass++; total++; }
  }
  data.tally = {
    total_pass: total,
    total_questions: data.questions.length,
    score_percent: ((total / data.questions.length) * 100).toFixed(1),
    by_dimension: Object.fromEntries(Object.entries(byDim).map(([k, v]) => [k, `${v.pass}/${v.total} = ${((v.pass/v.total)*100).toFixed(0)}%`])),
  };
  data.metadata.judge_model = JUDGE_MODEL;
  data.metadata.judge_url = JUDGE_API_URL;
  data.metadata.judged_at = new Date().toISOString();
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
  console.log('\n==== 6 DIMENSION ====');
  for (const [dim, score] of Object.entries(data.tally.by_dimension)) {
    console.log(`  ${dim}: ${score}`);
  }
  console.log(`==== TOTAL: ${total}/${data.questions.length} = ${data.tally.score_percent}% ====`);
  console.log(`Saved: ${OUTPUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
