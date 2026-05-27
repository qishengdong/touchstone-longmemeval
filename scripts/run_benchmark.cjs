#!/usr/bin/env node
/**
 * Touchstone LongMemEval — Generic Benchmark Runner (In-Context Mode)
 *
 * Tests any OpenAI-compatible chat completion API against the Linda V2 fixture.
 * 46-turn conversation history is stuffed into the message array as `chat history`,
 * then each of 100 questions is asked as the final user turn.
 *
 * Usage:
 *   PROVIDER_API_URL=https://api.openai.com/v1 \
 *   PROVIDER_API_KEY=sk-... \
 *   PROVIDER_MODEL=gpt-4o \
 *   node scripts/run_benchmark.cjs --output=results/my_run.json
 *
 * Or for OpenAI-compatible alternatives:
 *   PROVIDER_API_URL=https://api.deepseek.com/v1   # DeepSeek
 *   PROVIDER_API_URL=https://ark.cn-beijing.volces.com/api/v3   # 豆包 (Doubao)
 *   PROVIDER_API_URL=https://api.moonshot.cn/v1   # Kimi
 *
 * Sivon-specific run:
 *   PROVIDER_API_URL=https://your-sivon.example.com/api/openclaw/v1 \
 *   PROVIDER_USER=LINDA_FIXTURE_USER_ID \
 *   node scripts/run_benchmark.cjs --mode=native_memory --output=results/sivon.json
 *
 * Modes:
 *   - in_context (default): all 46 turns + system prompt sent in single call.
 *     Tests pure long-context recall, works on any chat API.
 *   - native_memory: 46 turns sent over multiple sessions to system's memory,
 *     then questions asked. Only works on systems with cross-session memory
 *     (Sivon, ChatGPT memory, Mem0, Letta, etc).
 */

const fs = require('fs');
const path = require('path');

const PROVIDER_API_URL = process.env.PROVIDER_API_URL;
const PROVIDER_API_KEY = process.env.PROVIDER_API_KEY || '';
const PROVIDER_MODEL = process.env.PROVIDER_MODEL || 'gpt-4o';
const PROVIDER_USER = process.env.PROVIDER_USER || 'touchstone_eval_user';
const MODE = (process.argv.find(a => a.startsWith('--mode=')) || '--mode=in_context').split('=')[1];
const OUTPUT = (process.argv.find(a => a.startsWith('--output=')) || '--output=results/run.json').split('=')[1];
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0');
const VERBOSE = process.argv.includes('--verbose');

if (!PROVIDER_API_URL) {
  console.error('ERROR: PROVIDER_API_URL env required');
  console.error('Example: PROVIDER_API_URL=https://api.openai.com/v1');
  process.exit(1);
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const fixture = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'fixture_linda_v2.json'), 'utf8'));
const questions = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'questions.json'), 'utf8'));

console.log(`# Touchstone LongMemEval — ${MODE} mode`);
console.log(`# Provider: ${PROVIDER_API_URL} | Model: ${PROVIDER_MODEL} | Temp: ${TEMPERATURE}`);
console.log(`# Fixture: ${fixture.session_count} sessions, ${fixture.total_turns} turns over ${fixture.day_span} days`);
console.log(`# Questions: ${questions.length}`);
console.log(`# Output: ${OUTPUT}`);
console.log('');

function buildSystemPrompt() {
  return `你是 Linda 的 AI 健康助理. 下面是你过去 ${fixture.day_span} 天 (${fixture.date_range}) 跟 Linda 的真完整对话历史 (按时间顺序).

她现在会问你一个问题. 凭这段历史诚实回答:
- 如果历史里有真细节, 直接引用 ("你 X 月 Y 日说过 ...")
- 如果历史里没有这个信息, 诚实说 "我不知道, 你没告诉过我"
- 不要瞎猜, 不要编造日期/数字/事件

回答简洁, 直接, 不超过 200 字.`;
}

function buildInContextMessages(question) {
  const msgs = [{ role: 'system', content: buildSystemPrompt() }];
  // Inject all 46 turns as prior chat history, with [date] prefix on each turn
  for (const session of fixture.sessions) {
    for (const turn of session.turns) {
      // Prepend [date] to user messages to give temporal anchor
      const content = turn.role === 'user'
        ? `[${session.date}] ${turn.content}`
        : turn.content;
      msgs.push({ role: turn.role, content });
    }
  }
  // Final question
  const today = '2026-05-27'; // benchmark "today"
  msgs.push({ role: 'user', content: `[${today}] ${question.q}` });
  return msgs;
}

async function callProvider(messages) {
  const url = `${PROVIDER_API_URL.replace(/\/$/, '')}/chat/completions`;
  const body = JSON.stringify({
    model: PROVIDER_MODEL,
    messages,
    temperature: TEMPERATURE,
    max_tokens: 500,
  });
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PROVIDER_API_KEY}`,
  };
  if (PROVIDER_USER) headers['x-user-id'] = PROVIDER_USER;

  const start = Date.now();
  const res = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(60000) });
  const ms = Date.now() - start;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Provider HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  const reply = json.choices?.[0]?.message?.content || '';
  return { reply, latency_ms: ms, raw: VERBOSE ? json : undefined };
}

async function main() {
  const startedAt = new Date().toISOString();
  const results = {
    metadata: {
      benchmark: 'touchstone-longmemeval-v1',
      mode: MODE,
      provider_url: PROVIDER_API_URL,
      provider_model: PROVIDER_MODEL,
      temperature: TEMPERATURE,
      fixture: { sessions: fixture.session_count, turns: fixture.total_turns, day_span: fixture.day_span },
      started_at: startedAt,
      completed_at: null,
      total_questions: questions.length,
      total_latency_ms: 0,
    },
    questions: [],
  };

  let i = 0;
  for (const q of questions) {
    i++;
    try {
      let reply, latency_ms;
      if (MODE === 'in_context') {
        const messages = buildInContextMessages(q);
        ({ reply, latency_ms } = await callProvider(messages));
      } else if (MODE === 'native_memory') {
        // Native memory mode requires fixture pre-injection (separate script).
        // Here we just send the question as a new chat turn.
        const msgs = [
          { role: 'system', content: 'You are continuing a long-term conversation with the user.' },
          { role: 'user', content: q.q },
        ];
        ({ reply, latency_ms } = await callProvider(msgs));
      } else {
        throw new Error(`Unknown mode: ${MODE}`);
      }
      results.questions.push({
        id: q.id, dim: q.dim, q: q.q, expect: q.expect,
        reply, latency_ms,
      });
      results.metadata.total_latency_ms += latency_ms;
      if (i % 5 === 0 || VERBOSE) {
        process.stdout.write(`${new Date().toISOString()} ${i}/${questions.length}\n`);
      }
    } catch (err) {
      console.error(`[${q.id}] FAILED: ${err.message}`);
      results.questions.push({
        id: q.id, dim: q.dim, q: q.q, expect: q.expect,
        reply: '', error: err.message,
      });
    }
  }

  results.metadata.completed_at = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.questions.length} replies to ${OUTPUT}`);
  console.log('Now run: node scripts/judge.cjs --input=' + OUTPUT);
}

main().catch(e => { console.error(e); process.exit(1); });
