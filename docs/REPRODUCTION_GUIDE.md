# Reproduction Guide

## TL;DR (10 minutes)

```bash
git clone https://github.com/qishengdong/touchstone-longmemeval
cd touchstone-longmemeval
npm install   # only need Node 18+ (uses built-in fetch)

# Set API keys
export PROVIDER_API_URL="https://api.openai.com/v1"
export PROVIDER_API_KEY="sk-..."
export PROVIDER_MODEL="gpt-4o"
export JUDGE_API_URL="https://api.deepseek.com/v1"
export JUDGE_API_KEY="sk-..."
export JUDGE_MODEL="deepseek-chat"

# Run
node scripts/run_benchmark.cjs --output=results/my_run.json
node scripts/judge.cjs --input=results/my_run.json
```

You'll see the 6-dimension breakdown and total score.

---

## Recipes for specific systems

### OpenAI GPT-4o
```bash
export PROVIDER_API_URL="https://api.openai.com/v1"
export PROVIDER_API_KEY="sk-..."
export PROVIDER_MODEL="gpt-4o"
```

### Anthropic Claude 3.5 Sonnet
The runner uses OpenAI-compatible chat completions. For Claude, use an adapter like LiteLLM proxy or write a small wrapper:
```bash
# Option A: LiteLLM proxy (recommended)
litellm --model claude-3-5-sonnet-20241022 &
export PROVIDER_API_URL="http://localhost:4000"
export PROVIDER_API_KEY="anything"
export PROVIDER_MODEL="claude-3-5-sonnet-20241022"
```

### DeepSeek
```bash
export PROVIDER_API_URL="https://api.deepseek.com/v1"
export PROVIDER_API_KEY="sk-..."
export PROVIDER_MODEL="deepseek-chat"  # or deepseek-reasoner
```

### 豆包 Doubao (Volcengine / ByteDance)
```bash
export PROVIDER_API_URL="https://ark.cn-beijing.volces.com/api/v3"
export PROVIDER_API_KEY="..."   # Volcengine ARK key
export PROVIDER_MODEL="doubao-pro-32k"
```
Note: Doubao has a 32K context window. The fixture + question fit within this comfortably.

### Kimi (Moonshot AI)
```bash
export PROVIDER_API_URL="https://api.moonshot.cn/v1"
export PROVIDER_API_KEY="sk-..."
export PROVIDER_MODEL="moonshot-v1-32k"   # or moonshot-v1-128k for longer
```

### 元宝 Yuanbao (Tencent Hunyuan)
Yuanbao consumer app doesn't expose a direct API. Use the underlying Hunyuan model:
```bash
export PROVIDER_API_URL="https://api.hunyuan.cloud.tencent.com/v1"
export PROVIDER_API_KEY="..."   # Tencent Cloud Hunyuan key
export PROVIDER_MODEL="hunyuan-large"   # or hunyuan-large-longcontext for 32K+
```

### Sivon (this benchmark's reference system)
Sivon runs against its own production endpoint with a fixture user `LME_LINDA_V2_BENCHMARK`. Reproducing Sivon's exact score requires:
1. Inject fixture into Sivon's `relationship_messages` table (see `scripts/sivon_native_adapter.cjs` — Sivon-specific, not generic)
2. Call Sivon's `/api/openclaw/v1/chat/completions` with user=fixture user_id
3. Sivon's selective archive retrieval activates on fact-recall queries

If you're not running a Sivon instance, use the published `results/sivon_2026-05-27_run{1,2,3}.json` files instead.

---

## Running all systems in parallel

Use the batch script:
```bash
# Set all needed API keys
export OPENAI_API_KEY="sk-..."
export DEEPSEEK_API_KEY="sk-..."
export VOLC_API_KEY="..."
export MOONSHOT_API_KEY="sk-..."
export HUNYUAN_API_KEY="..."

# Run all
node scripts/compare_systems.cjs \
  --systems=scripts/systems.example.json \
  --output-dir=results/comparison-$(date -I)/

# View summary
cat results/comparison-*/SUMMARY.json | jq '.[] | {name, score}'
```

---

## Cost estimate per full run

| Provider | Model | ~ Tokens / Q | ~ Cost / 100 Q |
|---|---|---|---|
| OpenAI | gpt-4o | ~8K in + ~300 out | ~$2.40 |
| OpenAI | gpt-4o-mini | ~8K in + ~300 out | ~$0.15 |
| DeepSeek | deepseek-chat | ~8K in + ~300 out | ~$0.10 (sub $1) |
| Anthropic | claude-3-5-sonnet | ~8K in + ~300 out | ~$3.00 |
| 豆包 | doubao-pro-32k | ~8K in + ~300 out | ~¥3-5 |
| Kimi | moonshot-v1-32k | ~8K in + ~300 out | ~¥6-10 |
| Tencent | hunyuan-large | ~8K in + ~300 out | ~¥4-8 |

Judge cost is similar per system (100 judge calls). Budget ~$1-5 total for a single-system run.

---

## Troubleshooting

**"Context length exceeded"**: Use a 32K-context model. The fixture + question + system prompt is ~10K tokens.

**"Rate limit hit"**: Add delays between calls. Edit `scripts/run_benchmark.cjs` to add `await new Promise(r => setTimeout(r, 1000))` in the loop.

**Judge returns invalid JSON**: Some models don't reliably return JSON. Try a stronger judge (GPT-4o, Claude 3.5) or add JSON-mode if the API supports it.

**Score seems too high/low**: 
- Switch judge LLMs and re-judge (judge-shift can be ±5 pt)
- Run 3x and average (within-system noise is ±2-3 pt at temperature=0)
- Verify the runner is using `temperature: 0`

---

## How to publish your system's score

After running:
1. Save the resulting JSON to `results/<your_system>_<date>.json`
2. Open a PR adding your system to a `LEADERBOARD.md` (which we'll create as scores roll in)
3. Or: tweet your score with `#TouchstoneLongMemEval` so we can track

Sivon's Mode-2 reference: 91 / 93 / 92 = 92 mean (2026-05-27).
