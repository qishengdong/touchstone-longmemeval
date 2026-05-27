# Methodology

## What this benchmark measures

A 100-question evaluation of **long-conversation memory** in Chinese-language AI assistants — specifically, in the metabolic-health domain (GLP-1, perimenopause, sleep, weight management, behavior change).

It does NOT measure:
- General medical knowledge accuracy
- Symptom-to-diagnosis routing
- Safety / drug-interaction checking
- Reasoning quality outside memory

It DOES measure:
- "Did the AI remember what the user said 4 weeks ago?"
- "Does it distinguish 推算 from 编造?"
- "When the user changes a preference, does it ask vs assume?"
- "Will it honestly say 'I don't know' when the answer isn't in history?"
- "Can the user TRAIN the AI on a personal rule and have it stick?"

## Dataset

**Fixture: Virtual Linda V2**
- Profile: 45-year-old perimenopausal woman, BMI 25.8, starting GLP-1 (semaglutide)
- 22 sessions across 35 days (2026-04-20 → 2026-05-25)
- 46 conversational turns (avg 2.1 turns/session)
- Covers: weight progression, dose escalation, sleep, mood, food choices, behavior rules
- All synthetic — no real user data

**Questions: 100**
- 17 × T1_info: single-fact recall
- 17 × T2_multi: multi-session reasoning  
- 17 × T3_temporal: time-anchored推算
- 17 × T4_update: belief-conflict reasoning
- 15 × T5_abstain: honest unknown
- 17 × T6_method: trainability (user-taught rules)

## Evaluation pipeline

```
Run script → 100 chat completions → results JSON with replies
   ↓
Judge script → 100 LLM-as-judge calls → pass/fail + reason per Q
   ↓
Tally → per-dimension scores + total
```

## Judge

We use **DeepSeek-chat** as the default judge (cheap, strong zh-CN, supports JSON-mode). Judge prompt (in `data/judge_prompt.txt`) is calibrated to:
- **PASS**: answer matches expected fact (even if phrased differently)
- **PASS**: answer correctly abstains on T5 questions
- **PASS**: answer recognizes belief conflict on T4
- **FAIL**: hallucinated number / wrong date / fabricated event
- **FAIL**: failed to abstain when no data exists
- **FAIL**: silent belief update without confirmation

For higher rigor, run with **GPT-4o** judge:
```bash
JUDGE_API_URL=https://api.openai.com/v1
JUDGE_MODEL=gpt-4o
node scripts/judge.cjs --input=results/your_run.json
```

We've measured GPT-4o judge vs DeepSeek judge on Sivon's run 2: 93 → 91 (±2 pt drift). Same ordering, slightly stricter.

## Modes

### `in_context` (Mode 1)
- All 46 turns stuffed into single chat call as `messages` array history
- System prompt: "你是 Linda 的 AI 助理. 下面是过去 35 天对话历史. 凭这段历史诚实回答."
- Tests pure long-context recall
- Works on any OpenAI-compatible API
- **Fair across systems** (everyone sees same input)

### `native_memory` (Mode 2)
- 46 turns sent over 22 sessions to system's native memory layer
- Then 100 questions asked as new chat sessions
- Tests true cross-session memory + retrieval
- Only works on systems with persistent user memory:
  - Sivon (relationship_messages + selective archive retrieval)
  - ChatGPT memory (memories API)
  - Mem0 / Letta / Zep (open-source memory libs)
- Sivon's published 92 is **Mode 2** (production-realistic)

## Limitations & honest caveats

1. **Sivon was tuned on this fixture during development.** We did NOT hold out a test split — we plan to release `linda_v3_holdout.json` for true blind eval. Until then, Sivon's 92 should be read as "Sivon performs at 92 on the data it was tuned against." Sivon's true blind score may be lower.

2. **DeepSeek judge has its own biases.** A 5-judge panel (GPT-4o + Claude 3.5 + DeepSeek + Doubao + Kimi) would be more robust. Roadmap item.

3. **One fixture, one persona.** Performance may not generalize across other personas / health scenarios. Adding `vivian_v1` (post-pregnancy), `wang_uncle_v1` (elderly, type-2 diabetes), etc is roadmapped.

4. **Single-language (zh-CN).** English translation not yet provided.

5. **Tests synthetic dialogue.** Real users use ellipsis, typos, voice-to-text errors, emotional pivots that synthetic fixtures don't fully capture. Sivon's production logs (anonymized) suggest real-user score is within ±5 pt of fixture score, but we haven't formally validated.

## Sivon's architecture details

See [SIVON_ARCHITECTURE.md](SIVON_ARCHITECTURE.md) for how Sivon's 5-layer "Trainable Personal Memory" stack works.
