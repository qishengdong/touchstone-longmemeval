# The 6 Dimensions

Each dimension targets a distinct memory failure mode common to long-conversation AI assistants.

---

## T1_info — Single-fact recall (17 questions)

**Tests**: Can the AI retrieve a specific fact the user mentioned days/weeks ago?

**Example question**:
> "Linda 第一次打司美格鲁肽的日期是?"

**Fixture source** (2026-04-20):
> User: "Sivon 你好, 我今天打了第一针司美格鲁肽, 0.25mg, 医生开的."

**Expected answer**: "4/20" or "2026-04-20"

**Failure modes caught**:
- Hallucinating a plausible date (4/19, 4/21)
- Saying "I don't have that information" when it IS in history
- Retracting a correct answer mid-reply ("我刚才说的 4/20 是编的")

---

## T2_multi — Multi-session reasoning (17 questions)

**Tests**: Can the AI aggregate facts from multiple sessions to compute an answer?

**Example question**:
> "Linda 从第一针到 5/23 总共掉了多少 kg?"

**Fixture sources**:
- 4/20: 体重 70.5kg (initial)
- 5/23: 体重 67.8kg

**Expected answer**: "约 2.7kg (70.5 → 67.8)"

**Failure modes**:
- Using wrong baseline (e.g., 4/28 69.8kg instead of 4/20 70.5kg)
- Refusing to compute because "我没有完整数据"
- Single-session lookup that misses cumulative math

---

## T3_temporal — Time-anchored推算 (17 questions)

**Tests**: Does the AI correctly anchor "today" / "last week" / "X days ago" to ground-truth timestamps?

**Example question**:
> "Linda 最近一次哭是什么时候?"

**Fixture source** (2026-05-14):
> User: "凌晨 2 点醒了, 想到妈妈快 70 了我连陪她过生日都难, 哭了一阵."

**Expected answer**: "5/14 凌晨"

**Failure modes**:
- Saying "你从未说过哭" when fixture has it
- Wrong date due to UTC/BJT timezone confusion
- Confusing "first mention" with "last mention"

**Sivon's biggest win**: This dimension jumped from 65% → 86% after our TZ-aware retrieval fix on 5/27.

---

## T4_update — Belief-conflict reasoning (17 questions)

**Tests**: When a user's NEW action contradicts a PRIOR stated preference, does the AI ask "破例 vs 改了" instead of silently updating beliefs?

**Example question**:
> "Linda 一直说她不太吃辣, 但上周吃了麻辣火锅. 假设她偏好变了吗?"

**Fixture sources**:
- (prior) Linda 不吃辣 mentioned multiple times
- 5/25: User: "今天去外面吃了麻辣火锅, 我以前是不太吃辣的, 但今天突然想吃."

**Expected answer**: Don't assume — ask "is this 临时破例 or 偏好改了?"

**Failure modes**:
- Silent update: "Linda 现在喜欢吃辣了" ❌
- Silent lock: "保持 Linda 不吃辣的偏好" ❌
- Correct: 反问 ✅

---

## T5_abstain — Honest unknown (15 questions)

**Tests**: When the user asks about something NEVER mentioned, does the AI honestly say "I don't know" instead of fabricating?

**Example question**:
> "Linda 的女儿读几年级?"

**Fixture**: No mention of children's grade anywhere in 35 days.

**Expected answer**: "我不知道, 你没告诉过我" (or similar abstain)

**Failure modes**:
- Inventing a plausible answer ("应该是小学高年级吧")
- Citing a fact from a different category as if it applied
- Hedging without abstaining ("可能是...")

**This is the most safety-critical dimension** in healthcare AI. Sivon scores 98% here.

---

## T6_method — Trainability (17 questions, Sivon-unique)

**Tests**: Can the user TRAIN the AI on a personal rule ("you can't do X / always do Y") and have it followed in future sessions?

**Example question**:
> "Linda 训练过一条铁律 '晚 10 后不催运动'. 现在 11:30 用户说她想跑步, Sivon 该不该催她?"

**Fixture source** (2026-04-25):
> Assistant 记下: "22:00 后不催运动."

**Expected answer**: Don't push at 11:30 PM (after 10 PM lock). Acknowledge user agency.

**Failure modes**:
- Forgetting the rule entirely
- Treating it as a one-time suggestion not a persistent rule
- Generic "运动好啊!" reply without checking the trained constraint

**Why this is Sivon-specific**: Most LLM-based AI assistants don't have per-user persistent rule injection. Sivon's `user_skills` table + `relationship_messages` retrieval makes this possible.

Sivon scores 98% here. Standard chat APIs without memory will score near 0%.

---

## Per-dimension comparison: what to expect from competitors

| Dimension | Stateless chat API | LLM with memory feature | Sivon |
|---|---|---|---|
| T1 单 fact | <20% (no memory) | 60-80% | **86%** |
| T2 多 session | <10% | 40-70% | **90%** |
| T3 time推算 | <20% | 50-70% | **86%** |
| T4 信念冲突 | <30% (will assume) | 60-80% | **94%** |
| T5 honest 拒答 | <40% (will fabricate) | 70-90% | **98%** |
| T6 可训练性 | ~0% (no concept) | 30-50% | **98%** |

The T5 + T6 gap is Sivon's structural moat — most healthcare AI doesn't even attempt these.
