---
name: calories_log
description: Log a food item to the daily calorie tracker. Use when the user types "/calories_log" (or asks to log food/calories) followed by a food item, a meal slot (breakfast/lunch/evening snack/dinner), and a quantity. Estimates the calories for the item, appends an entry to calorie-log/log.md under today's date, updates the daily total, and commits + pushes the change.
---

# Calories Log

Logs a food item the user ate into `calorie-log/log.md`, estimating its calorie
content, and keeps a running daily total.

## Input the user provides

After `/calories_log`, the user gives (in any natural order):

- **Food item** — e.g. "2 rotis", "bowl of dal", "banana", "cappuccino"
- **Meal slot** — one of: `breakfast`, `lunch`, `evening snack`, `dinner`
- **Quantity** — a count, weight, or portion size (e.g. "2", "150 g", "1 cup")

If any of these is missing or ambiguous, ask a brief clarifying question before
logging. Don't refuse — make a reasonable assumption and state it if the user
seems to want speed.

## How to estimate calories

1. Identify the food and the given quantity.
2. Estimate calories using standard nutrition values (per common portion or per
   100 g). Prefer well-known references (USDA-style values, common packaged
   labels). For composite/home-cooked dishes, estimate from typical recipes.
3. Multiply by the quantity the user gave.
4. **State your assumption** in the log entry's note when the estimate is rough
   (e.g. "assumes medium banana ~120 g"). Calorie estimates for whole meals can
   vary ±20% — that's expected; the goal is a useful running total, not lab
   precision.

## How to write the log

The log lives at `calorie-log/log.md`. It is grouped by date (newest date at
the top). Each day is a `## YYYY-MM-DD` heading with a Markdown table and a
**Daily total** line.

Steps:

1. Read `calorie-log/log.md`.
2. Find today's date section (use the real current date). If it doesn't exist,
   create a new `## YYYY-MM-DD` section at the top (just under the intro), with
   a fresh table header.
3. Append a row to today's table:

   | Time | Meal | Food | Qty | Calories | Note |
   |------|------|------|-----|----------|------|

   - **Time** — the current clock time (HH:MM), or leave `—` if unknown.
   - **Meal** — the meal slot the user gave.
   - **Food** — the food item.
   - **Qty** — the quantity.
   - **Calories** — your integer estimate (kcal).
   - **Note** — any assumption, or `—`.

4. Recompute the **Daily total** for that day by summing the Calories column,
   and update (or add) the `**Daily total: N kcal**` line right after the day's
   table.
5. If the user's target intake is recorded in `calorie-log/README.md`, add a
   short status after the total, e.g. `(target 2100 — 340 remaining)` or
   `(target 2100 — 150 over)`.

## After logging

1. Show the user a one-line confirmation: the item, its calories, and the new
   daily total vs. target.
2. Commit and push:
   - `git add calorie-log/log.md`
   - Commit message like: `Log <food> (<meal>, <calories> kcal) for <date>`
   - `git push -u origin <current-branch>` (retry with backoff on network error)

Keep the confirmation short. The log file is the source of truth.
