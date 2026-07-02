# Sky Sort — Airport Boarding Game

A self-contained HTML5 sorting game with an airport theme. No build step, no
dependencies — just open `index.html` in any modern browser (works great on
mobile/touch and desktop).

## How to play

- A **plane** sits at the top center. It has several **gates**, each marked
  with a country flag and how many travelers of that nationality it still
  needs (e.g. `2/4`).
- Four **lanes** at the bottom are queues of **travelers**, each holding a
  country flag.
- **Tap a lane** to send its front traveler onto the **shuttle bus**.
- The bus waits a brief moment after each tap — keep tapping to load more
  travelers before it departs. When tapping pauses, the bus **circles the
  plane** and comes back.
- As the bus passes the plane, any traveler whose flag matches a gate that
  **still has room** walks off and boards the plane (score!).
- Mismatched or surplus travelers **ride back and keep their seat** on the
  bus. The bus only has **12 seats**.

## Win / lose

- **Win a level** by filling every gate on the plane.
- **Lose** if the bus comes back completely full (12 seats) and blocked with
  travelers that no gate can accept.

Each level adds more gates, higher passenger counts, more decoy flags, and a
faster shuttle. Read the flags carefully and don't waste seats!

## Run it

```
open index.html      # macOS
xdg-open index.html  # Linux
```

Or just double-click the file.
