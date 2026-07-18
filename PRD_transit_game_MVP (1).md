# PRD: Jabodetabek Transit Learning Game (MVP)
**"Duolingo for Public Transit"**

---

## 1. Product Summary

A mobile-first gamified learning app that teaches users how to navigate the Jabodetabek public transit network (KRL Commuter Line, MRT Jakarta, LRT Jabodebek, LRT Jakarta, TransJakarta) — focused purely on **connectivity, direction, and transfer logic**, not literal station geography or physical station appearance.

**Core promise**: after playing, users understand *which line connects to which*, *where to transfer*, and *which direction to go* — the actual sources of confusion for real commuters.

**Not this**: a real-time journey planner, a literal map app, a schedule/fare tracker.

---

## 2. Target User
- Jakarta-area residents who are new to, or intimidated by, the transit network
- Students/newcomers who need to learn multi-modal routes (KRL + MRT + LRT + TransJakarta)
- Casual mobile gamers who enjoy short, satisfying puzzle sessions (commute-length play sessions: 30 seconds–3 minutes per round)

---

## 3. Visual Style Direction

**Base layer (map/game canvas)**: Flat geometric transit-map aesthetic — inspired by classic subway-map posters and *Mini Metro*. Bold solid-color lines, simple circular nodes, clean minimal background. No literal station photography or realistic geography — everything abstract and schematic.

**UI layer (buttons, cards, badges, progress bar)**: Neo-brutalist touches — thick black outlines, hard offset drop shadows (no blur, ~4px offset), flat bright color fills, bold rounded sans-serif typography.

**Color system**: Real Jabodetabek line colors as brand anchors —
- KRL Bogor Line: deep pink/magenta
- KRL Cikarang Loop: orange
- KRL Rangkasbitung: brown
- KRL Tangerang: cyan/blue
- KRL Tanjung Priok: purple
- KRL Airport Line: dark blue
- MRT North-South: navy blue
- LRT Jakarta: green
- LRT Jabodebek Cibubur: orange
- LRT Jabodebek Bekasi: magenta/pink
- TransJakarta corridors: distinct color per corridor (see dataset)

**Mood**: energetic, satisfying, playful, game-like. Explicitly NOT corporate, NOT a utility transit-app look.

---

## 4. MVP Scope

### 4.1 Core Game Mechanics (4 total)

| # | Mechanic | Mechanic Summary | Core Skill Taught |
|---|----------|------------------|--------------------|
| 1 | **Pipe Rush** | Drag colored line segments to connect a start node to an end node through the correct line(s) before time runs out. | Line identification, basic connectivity |
| 2 | **Chain Reaction** | Pick lines one at a time to build a chain from start to destination; a wrong pick breaks the chain and forces a restart from the error point. | Sequential transfer logic, risk/reward |
| 3 | **Path Race** | Two route options are shown side by side (animated); user picks the more efficient one (fewer transfers / shorter). | Route efficiency comparison |
| 4 | **Color Flood** | User selects line colors one at a time to "flood-fill" outward from a starting node until the target node is reached/covered. | Network-wide connectivity, interchange awareness |

### 4.2 Content Structure (Units — Duolingo-style progression path)

- **Unit 1**: KRL Commuter Line only (Bogor, Cikarang Loop as the two most-used lines)
- **Unit 2**: MRT + LRT Jakarta + LRT Jabodebek
- **Unit 3**: TransJakarta key corridors (subset touching major hubs)
- **Unit 4**: Cross-modal — mixing 2+ modes in one puzzle, centered on major interchange hubs (Dukuh Atas, Manggarai, Cawang, Kota, Jatinegara, Grogol, Kampung Melayu)
- **Unit 5**: Mixed mastery challenge — hardest puzzles across the full network

Each unit uses the same 4 mechanics; difficulty increases via network complexity, not new mechanics.

### 4.3 Non-Goals for MVP
- No real-time schedule/delay data
- No literal photos of stations
- No fare calculation
- No full 200+ halte TransJakarta network (only key corridors/hubs — see dataset)
- No social/multiplayer features (nice-to-have, post-MVP)

---

## 5. AI Layer — Transit Mentor

### 5.1 Guiding principle
Every AI feature must pass one test: **does this make the user more network-aware?** If not, it's cut. This ruled out several tempting-but-generic ideas: a Q&A chatbot ("how do I get to Monas?" — Google Maps already wins this), AI-generated routes (a graph algorithm is more accurate and cheaper), a mission/challenge generator (fun, but not core learning), and AI "roasts" (novelty, not substance).

### 5.2 What the AI actually is
Not a navigator. Not a chatbot. A **mentor** that sits after the graph, not instead of it.

```
Transit Graph (ground truth)
      ↓
Shortest Path / Network Logic
      ↓
Quiz Engine
      ↓
User Answer
      ↓
Learning Analytics
      ↓
AI Transit Mentor (explanation layer)
```

The graph and shortest-path logic remain the sole source of truth for what's correct. The AI never decides routes — it only receives facts (the correct route, the user's chosen route, which hubs were involved, the user's error patterns, and learning history) and turns those facts into explanations that build intuition. It answers **why**, never just **right/wrong**.

### 5.3 Insight types
The mentor draws from a small set of insight categories, each grounded in the transit graph data (not freeform generation):

| Insight type | Example |
|---|---|
| **Hub insight** | Manggarai connects almost every major KRL direction. |
| **Mode insight** | MRT is designed for north-south travel through the city center. |
| **Transfer insight** | Dukuh Atas is one of the easiest places to switch between MRT, LRT Jabodebek, and TransJakarta. |
| **Corridor insight** | TransJakarta Corridor 1 overlaps with many MRT destinations, making it a useful alternative. |
| **Strategy insight** | When traveling from the east to South Jakarta, think about reaching Dukuh Atas first before switching modes. |

### 5.4 Two moments the mentor speaks

**1. Post-answer explanation** — after a challenge, instead of just confirming correctness, the AI names the pattern behind the correct answer (e.g. why transferring at Manggarai was the efficient move) or, on repeated similar mistakes, surfaces the underlying habit (e.g. "you consistently pick routes with the fewest stations, but in Jakarta a single transfer at a major hub often beats staying on one line").

**2. Reflection Coach (every ~5 challenges)** — a periodic summary screen, not tied to a single question:
```
Transit Insight
You've learned: East-West travel, single-line journeys
Still unfamiliar: Major transfer hubs
Recommended lesson: Understanding Manggarai
```
At a larger milestone (e.g. 10 challenges), the mentor can synthesize a higher-level observation about the user's *decision-making pattern* — e.g. noting a tendency to avoid transfers altogether, and contrasting it with how experienced commuters optimize around hubs like Manggarai or Dukuh Atas. This is the clearest demo differentiator: the AI is reasoning about *how the user thinks*, not just whether they got an answer right.

### 5.5 Design constraints for the AI layer
- The AI is stateless with respect to correctness — it never overrides or second-guesses the graph's shortest-path result.
- All insight content must be traceable to graph facts (hub degree, line overlap, user's answer history) — no ungrounded trivia.
- For the hackathon demo, scope the mentor to **one insight type** (hub insight is the strongest single demo moment) plus a simple post-answer explanation — the full Reflection Coach summary is a stretch goal, not required for the working slice.

---

## 6. Screens to Design (for Wonder — generate all in one consistent style pass)

### Screen 1 — Home / Unit Map
Duolingo-style vertical progression path. Circular unit nodes connected by a winding colored trail. Locked nodes greyed out; current node larger with a glow/pulse ring; completed nodes show a checkmark. Top bar shows streak counter and XP badge. Floating mascot character near current node.

### Screen 2 — Pipe Rush (gameplay)
Abstract canvas with circular station nodes and a start/end node highlighted. User drags to draw colored line segments between nodes. Timer visible at top. Line-color palette/legend along the bottom or side edge.

### Screen 3 — Chain Reaction (gameplay)
Vertical or radial chain-building interface: current node at top, selectable next-line options as chips/buttons below. Visible "chain/streak" counter. Broken-chain state shows a clear but non-punishing visual (shake/fade), not gory or harsh.

### Screen 4 — Path Race (gameplay)
Split-screen: two route options shown as two colored paths racing side by side toward a shared destination node. Tap to pick a side. Simple efficiency indicators (number of transfers, relative speed) shown subtly per option.

### Screen 5 — Color Flood (gameplay)
Full network canvas with a starting node highlighted. Color palette at the bottom; tapping a color floods outward from the current frontier. Progress shown as the network "lighting up."

### Screen 6 — Round Result / Feedback
Post-round summary: score, XP earned, star rating (1–3), a short encouraging message, "Next" and "Retry" buttons. Reuses the neo-brutalist card style. Includes a distinct "Mentor insight" card (see Screen 6b) rather than folding AI text into the generic result copy.

### Screen 6b — AI Mentor Insight (post-answer / reflection)
A card, visually distinct from the standard result card (e.g. a subtle accent border or icon marking it as "from the mentor," not just a system message), showing one short insight tied to the just-completed challenge (hub/mode/transfer/corridor/strategy type). For the periodic Reflection Coach moment: a compact summary card with a "you've learned" list, a "still unfamiliar" list, and one recommended next lesson — kept short enough to read in a few seconds, not a wall of text.

### Screen 7 — Profile / Streak Overview
Shows total XP, current streak, units completed, and a simple badge/achievement shelf (e.g. "Manggarai Master," "Dukuh Atas Explorer" — tied to interchange hubs).

### Screen 8 — Onboarding / Welcome (1–2 slides)
Short, playful intro explaining the app's premise ("Learn to navigate Jabodetabek transit by playing"), mascot introduction, single CTA to start Unit 1.

---

## 7. Data Reference

All game content is generated from a structured dataset already compiled (`jabodetabek_transit_data.json`), containing:
- All KRL lines (Bogor, Cikarang Loop, Rangkasbitung, Tangerang, Tanjung Priok, Airport) with station sequences
- MRT North-South Line
- LRT Jakarta Southern Line
- LRT Jabodebek (Cibubur + Bekasi, shared trunk)
- 14 TransJakarta corridors + 18 express/variant sub-routes
- 10 major interchange hubs with mode lists

This dataset is the single source of truth for node/edge generation across all 4 mechanics and all 5 units — no separate content needs to be authored per game. It also grounds the AI Transit Mentor (Section 5): hub degree (how many lines/modes meet at a node), line overlap, and user answer history are all derivable directly from this graph, so mentor insights stay factual rather than freeform.

---

## 8. Success Criteria (for challenge submission)
- All screens visually consistent (same color system, shape language, shadow style)
- Originality: no competing app currently gamifies Jabodetabek transit connectivity specifically
- Playable end-to-end MVP: onboarding → Unit 1 (KRL) → at least 1 of each of the 4 mechanics → result screen
- At least one AI Mentor insight moment demoed live (hub insight after a completed challenge), showing the explanation is grounded in the actual graph data, not a canned string

---

## 9. Suggested Wonder Prompt Sequence
1. Generate Screen 1 (Home/Unit Map) first — establishes the full design system (colors, shapes, shadows, typography)
2. Generate Screens 2–5 (gameplay screens) referencing "match the style of the home screen" for consistency
3. Generate Screens 6–8 (result, profile, onboarding) last, reusing established components
