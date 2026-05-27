# Results

## Sivon's reference runs (2026-05-27)

Three independent runs, fresh fixture re-injected between each:

| File | T1 | T2 | T3 | T4 | T5 | T6 | Total |
|---|---|---|---|---|---|---|---|
| `sivon_2026-05-27_run1.json` | 76% | 94% | 88% | 100% | 93% | 94% | **91** |
| `sivon_2026-05-27_run2.json` | 94% | 82% | 88% | 94% | 100% | 100% | **93** |
| `sivon_2026-05-27_run3.json` | 88% | 94% | 82% | 88% | 100% | 100% | **92** |
| **Mean** | **86%** | **90%** | **86%** | **94%** | **98%** | **98%** | **92** |

Mode: `native_memory` (fixture in Sivon's relationship_messages, questions in fresh sessions). Judge: DeepSeek-chat. Temperature: 0. Sivon stack version: P0a (TEMP_LOCK) + P0b v4 (SELECTIVE_FACT_RECALL) shipped 2026-05-27.

## Reading a result file

```json
{
  "metadata": {
    "benchmark": "touchstone-longmemeval-v1",
    "mode": "native_memory",
    "provider_url": "...",
    "started_at": "2026-05-27T...",
    "judge_model": "deepseek-chat"
  },
  "questions": [
    {
      "id": "T1-01",
      "dim": "T1_info",
      "q": "Linda 第一次打司美格鲁肽的日期是?",
      "expect": "4/20 或 2026-04-20",
      "reply": "你 4 月 20 日开始打第一针 0.25mg...",
      "latency_ms": 2400,
      "judge": { "pass": true, "reason": "回复 4/20 与期望一致" }
    },
    ...
  ],
  "tally": {
    "total_pass": 92,
    "total_questions": 100,
    "score_percent": "92.0",
    "by_dimension": { "T1_info": "13/17 = 76%", ... }
  }
}
```

## Submitting your system's results

PRs welcome. Format: `<system_name>_<date>.json`. Include in PR description:
- Provider URL + model
- Mode used (`in_context` or `native_memory`)
- Judge model
- Total cost (so we can update the cost table)
