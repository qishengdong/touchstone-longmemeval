# Touchstone LongMemEval

> **A 100-question, 6-dimension long-conversation memory benchmark for Chinese-healthcare AI.**

Built and maintained by [Sivon (sivon.me)](https://sivon.me) — a metabolic-health AI agent. Inspired by Adobe Research's [LongMemEval paper (2024)](https://arxiv.org/abs/2410.10813), rewritten end-to-end for Chinese metabolic-health dialogue.

**Why this exists**: "记得用户" 是 AI 健康代理的真护城河, 但行业默认 stateless. 没有公开评测就没有竞争压力. 本 repo 把 Sivon 内部用了 2 周的 benchmark 全开放, 让任何投资人 / 行业团队 / LLM 研究者复刻验证.

---

## 🎯 Sivon's Score (2026-05-27)

| Run | T1 事实 | T2 多 session | T3 时间 | T4 信念冲突 | T5 honest 拒答 | T6 可训练性 | **Total** |
|---|---|---|---|---|---|---|---|
| Run 1 | 76% | 94% | 88% | 100% | 93% | 94% | **91/100** |
| Run 2 | 94% | 82% | 88% | 94% | 100% | 100% | **93/100** |
| Run 3 | 88% | 94% | 82% | 88% | 100% | 100% | **92/100** |
| **Mean** | **86%** | **90%** | **86%** | **94%** | **98%** | **98%** | **92.0** |

3 independent runs, all ≥ 90/100, fixture re-injected between runs. Methodology: see [docs/METHODOLOGY.md](docs/METHODOLOGY.md). Per-run JSON: [results/](results/).

**Verify**: clone this repo + bring your own API keys + reproduce in 10 min. See [docs/REPRODUCTION_GUIDE.md](docs/REPRODUCTION_GUIDE.md).

---

## What's inside

- **`data/questions.json`** — 100 hand-crafted questions across 6 long-memory dimensions
- **`data/fixture_linda_v2.json`** — Virtual user "Linda V2": 22 sessions, 46 turns, 35 days of dialogue (2026-04-20 → 2026-05-25). No real PII.
- **`data/judge_prompt.txt`** — LLM-as-judge prompt (zh-CN, calibrated to distinguish 推算 vs 编造)
- **`scripts/run_benchmark.cjs`** — Generic runner. Works against any OpenAI-compatible chat endpoint.
- **`scripts/judge.cjs`** — Score replies against expected answers using a judge LLM.
- **`scripts/compare_systems.cjs`** — Multi-system batch comparison (run + judge + summary).
- **`results/sivon_2026-05-27_run{1,2,3}.json`** — Sivon's 3 independent runs (raw replies + judge verdicts).
- **`docs/METHODOLOGY.md`** — How the benchmark works, design choices, limitations.
- **`docs/6_DIMENSIONS_EXPLAINED.md`** — What each dimension tests and why.
- **`docs/REPRODUCTION_GUIDE.md`** — Step-by-step to run on GPT-4o, Doubao, Kimi, Yuanbao, etc.
- **`docs/SIVON_ARCHITECTURE.md`** — How Sivon achieved 92/100. The 5-layer "Trainable Personal Memory" stack.

---

## 5-minute Quickstart (any OpenAI-compatible API)

```bash
git clone https://github.com/qishengdong/touchstone-longmemeval
cd touchstone-longmemeval
npm install   # only needs Node 18+ built-in fetch — no extra deps

export PROVIDER_API_URL="https://api.openai.com/v1"
export PROVIDER_API_KEY="sk-..."
export PROVIDER_MODEL="gpt-4o"

# Run benchmark (~5-10 min depending on model latency)
node scripts/run_benchmark.cjs --output=results/gpt4o.json

# Judge (use DeepSeek or GPT-4o)
export JUDGE_API_URL="https://api.deepseek.com/v1"
export JUDGE_API_KEY="sk-..."
export JUDGE_MODEL="deepseek-chat"
node scripts/judge.cjs --input=results/gpt4o.json
```

You'll see:
```
==== 6 DIMENSION ====
  T1_info: 12/17 = 71%
  T2_multi: 14/17 = 82%
  ...
==== TOTAL: XX/100 = XX.X% ====
```

---

## Modes

### Mode 1: `in_context` (default, works on any chat API)
All 46 fixture turns are stuffed into the message array as prior `chat history` in a single API call. Tests pure long-context recall — does the model see and use what's in its context window?

✅ Fair across all systems. ✅ Reproducible. ❌ Requires model to handle ~40KB context.

### Mode 2: `native_memory` (Sivon, Mem0, Letta, ChatGPT-memory, etc)
Fixture turns are sent to the system's persistent memory layer (multi-session). Then questions are asked in fresh sessions. Tests true cross-session memory.

✅ More realistic. ❌ Each system needs a custom adapter (no universal API). Sivon's adapter is in `scripts/sivon_native_adapter.cjs` (Sivon-specific, kept here as reference).

We publish Sivon's Mode-2 score because that's how real users experience Sivon. The fixture is injected into Sivon's `relationship_messages` table over 22 sessions, then questions asked in new dialogues — same way Linda actually used it for 35 days.

---

## Comparing against other systems

```bash
# Drop API keys in env
export OPENAI_API_KEY="sk-..."
export DEEPSEEK_API_KEY="sk-..."
export VOLC_API_KEY="..."           # 豆包 Doubao
export MOONSHOT_API_KEY="sk-..."    # Kimi
export HUNYUAN_API_KEY="..."        # 元宝 Yuanbao

# Run all (uses scripts/systems.example.json by default)
node scripts/compare_systems.cjs --systems=scripts/systems.example.json --output-dir=results/comparison-$(date -I)/
cat results/comparison-*/SUMMARY.json
```

---

## Honest disclosure (read before citing Sivon's score)

1. **This is OUR benchmark, not the canonical academic LongMemEval split.** We re-wrote the dataset for Chinese metabolic-health domain. Direct comparison to published numbers from the Adobe paper is apples-to-oranges. Direct comparison BETWEEN systems on THIS benchmark is fair.
2. **Sivon was tuned on this fixture during development.** We did NOT see the held-out test split (because there isn't one yet — we plan to release `linda_v3_holdout.json` for true blind eval). Until then, Sivon's 92 should be read as "Sivon achieves 92 on the data it was tuned against; same number on a held-out fixture is the next milestone."
3. **Judge LLM is DeepSeek-chat** (most accessible Chinese LLM judge with strong zh-CN). Switching to GPT-4o judge typically shifts scores by ±2 pts.
4. **Sivon's `native_memory` Mode-2 score is what's published** (92). The `in_context` Mode-1 score for Sivon (also via this repo's runner) is lower — Mode-1 doesn't exercise Sivon's native memory pipeline. We publish Mode-2 because that's how production users experience it; we make Mode-1 available so investors can compare apples-to-apples.

---

## License

MIT — fork, modify, run, publish. We'd appreciate a star ⭐ if you use it.

## Citation

```bibtex
@misc{touchstone_longmemeval_2026,
  title  = {Touchstone LongMemEval: 100-question 6-dimension long-conversation memory benchmark for Chinese-healthcare AI},
  author = {Sivon Team},
  year   = {2026},
  url    = {https://github.com/qishengdong/touchstone-longmemeval}
}
```

## Roadmap

- [ ] `data/linda_v3_holdout.json` — blind test split (not yet released)
- [ ] Native-memory adapters for Mem0, Letta, ChatGPT-memory, Doubao memory
- [ ] Multi-judge panel (avg of GPT-4o + DeepSeek + Claude 3.5 Sonnet)
- [ ] Live leaderboard at touchstone.sivon.me

## Issues / Pull Requests

We welcome:
- New fixtures (other personas / health scenarios / longer histories)
- Native-memory adapters for memory systems we haven't covered
- Judge prompt improvements
- Translation to English / other languages

File issues at https://github.com/qishengdong/touchstone-longmemeval/issues
