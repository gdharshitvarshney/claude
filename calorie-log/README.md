# Calorie Tracker

A simple, git-backed daily calorie logger.

## How to log food

In a Claude Code session on this repo, type:

```
/calories_log <food item> <meal> <quantity>
```

- **meal** is one of: `breakfast`, `lunch`, `evening snack`, `dinner`
- Example: `/calories_log 2 rotis with dal, lunch, 1 bowl dal`

Claude estimates the calories, appends the entry to
[`log.md`](log.md) under today's date, updates the daily total, and
commits + pushes it for you.

## Your daily target

Profile: **Male · lightly active · goal: lose ~0.5 kg/week**

> **Target: pending** — awaiting age, height (cm), and current weight (kg) to
> finish the calculation. Once provided, this section will show your
> maintenance calories and your weight-loss target.

### How the target is calculated

1. **BMR (Mifflin–St Jeor, male):**
   `BMR = 10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5`
2. **TDEE (maintenance):** `BMR × 1.375` (lightly active)
3. **Weight-loss target:** `TDEE − 500 kcal/day` for ~0.5 kg/week
   (1 kg body fat ≈ 7700 kcal, so 500/day ≈ 0.45 kg/week).

A common safety floor is not eating below ~1500 kcal/day (men) without medical
guidance. Recalculate every ~4–5 kg of weight change, since BMR drops as you do.
