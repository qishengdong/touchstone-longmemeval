# How Sivon Achieved 92/100

Sivon's "Trainable Personal Memory" stack — the technical architecture behind the published 92/100 mean score on this benchmark.

## The 5-layer stack

```
┌──────────────────────────────────────────────────────────┐
│  L0: Temporal Anchor (时序锚定)                            │
│      Every memory carries BJT-aware timestamp              │
│      Anti-pattern: UTC→BJT confusion = -1 day errors       │
├──────────────────────────────────────────────────────────┤
│  L1: Full Archive Retrieval (全档案检索)                   │
│      Not just last 30 turns. Full 3-6 month history.       │
│      relationship_messages table, ngram-indexed.           │
├──────────────────────────────────────────────────────────┤
│  L2: Selective Fact-Recall (选择性注入)                    │
│      Only retrieve when query has fact-recall signal       │
│      (date / 第一 / 最近 / 多少 / 总共 / 初始 / ...)         │
│      Preserves LLM judgment for non-fact queries.          │
├──────────────────────────────────────────────────────────┤
│  L3: Anti-Self-Pollution (反自污染)                         │
│      content != query (don't pull the question back)       │
│      occurred_at < NOW() - 60s (don't pull just-answered)  │
│      role = 'user' (user statements are facts, not replies)│
├──────────────────────────────────────────────────────────┤
│  L4: Deterministic Output (确定性输出)                      │
│      temperature: 0 on chat-path LLM calls                 │
│      Reproducible scores across runs (±2 pt noise)         │
└──────────────────────────────────────────────────────────┘
```

## Per-layer impact on the score

Each layer was shipped 5/27 with measurable impact:

| Ship | Marker | Δ Score |
|---|---|---|
| Baseline | — | 76 (single run) |
| L4: TEMP_LOCK_5_27 | invokeLLM temperature=0 | 76 → 87.67 mean |
| L1+L0: RELATIONSHIP_ARCHIVE_5_27 | full archive + TZ fix | T3 +20pt, but T2/T5/T6 hurt |
| L2: SELECTIVE_FACT_RECALL_5_27 | only inject on fact queries | restored T2/T5/T6, **mean 92** |
| L3: SELF_POISON_FIX_5_27 | content equality + 60s + user-role | enables Mode-2 in production |

## Why selective fact-recall is the key insight

Most "AI memory" implementations inject historical context for EVERY query. This causes:
- Multi-session reasoning (T2): biased toward whatever data point retrieves first
- Abstain (T5): over-asserts because something always retrieves
- Methodology (T6): rule-based reasoning gets confused by irrelevant facts

Sivon's solution: only inject archive when the query signals a fact-recall intent (specific date, "第一次", "最近", "总共", "多少", etc). For pattern questions ("我早餐结构稳定吗?"), let the LLM judge from session context alone.

Per-dimension trade-off measured on this benchmark:

|  | T1 | T2 | T3 | T4 | T5 | T6 | Total |
|---|---|---|---|---|---|---|---|
| Always inject (v3) | 82 | 82 | 88 | 82 | 93 | 82 | 85 |
| Selective (v4) | 86 | 90 | 86 | 94 | 98 | 98 | 92 |
| Δ | +4 | +8 | -2 | +12 | +5 | +16 | +7 |

Selective injection sacrifices 2pt on T3 (some date queries lack our trigger keywords) but gains 16pt on T6 and 12pt on T4. Net +7.

## Source code references

- `server/lib/relationship-archive-search.ts` — L0+L1+L3 (ngram search + TZ fix + filters)
- `server/lib/openclaw-api.ts:1037-1057` — L2 (selective injection logic)
- `server/lib/openclaw-api.ts:2636` — L4 (temperature lock)

(Sivon's main source code is in a private repo. The architecture described here is publishable; specific implementation details are released under the same MIT license as this benchmark in the linked Sivon repo when we open-source the memory module.)

## What's NOT in this stack (yet)

- **Embedding retrieval**: We use ngram BM25-like scoring. Embeddings would help with semantic-but-not-lexical matches (e.g., "我的初始体重" vs fixture "体重 70.5kg"). Roadmap.
- **Write-time gating**: Currently we write everything to relationship_messages. Filtering noise at write-time would improve retrieval precision. Roadmap.
- **Multi-judge reasoning**: When archive returns N candidates, we just inject top 5. A reranker would help. Roadmap.

If you're an investor evaluating "is the memory stack defensible?": the answer is **yes, for the next 6-12 months**. The selective fact-recall + temporal anchor + anti-pollution pattern is non-obvious from naive RAG implementations, and our 35-day fixture stress-tests it in ways most teams don't yet have data for.

After 12 months, expect competitors to catch up; the moat shifts to:
- (a) Fixture quality (we have real production user data; competitors don't)
- (b) Trainability scope (T6 dimension — per-user persistent rules)
- (c) Domain depth (functional medicine, GLP-1, perimenopause vocabulary)
