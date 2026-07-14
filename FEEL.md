# Iteration 3 flight-feel record

Status: **automated physics gates pass; final desktop integration and real-iPhone verdict pending.** Tuning constants live in `src/config.js`.

| Area | Current Iteration 3 value | Status |
|---|---:|---|
| Start / minimum speed | 62 / 15 m/s | Automated |
| Pitch / roll authority | 110°/s / 160°/s; expo 1.6 | Automated |
| Input smoothing | 60 ms | Automated |
| High-speed body control | Gradually to 0.85× from 100–130 m/s | Automated |
| Lift slope / stall | 3.6; stall at 16°; post-stall through 0.52 rad | Automated |
| Path turning | Lift-limited, capped at 6 g | Automated |
| Drag | 0.00058 parasitic; 0.002 induced | Automated |
| Climb refund | Removed | Automated |
| Stall feedback | 2.5 restoring acceleration; 0.15° buffet | Device feel pending |
| Loop behavior | 90 m/s succeeds; 55 m/s stalls and recovers | Automated |
| Terminal dive | About 130 m/s / 468 km/h | Automated |
| Boost charge | >90 m/s and path below −15° for 3 s | Automated |
| Boost armed / expiry | 6 s armed; 2 s drain | Automated |
| Boost trigger / burn | >40°/s pull; +25 m/s over 3 s | Device feel pending |
| Camera | First and third person | Device comfort pending |
| Menu | 120 ms gaze EMA; hysteresis; 1 s dwell | Device comfort pending |
| Stereo / render | 64 mm eye separation; DPR 1; no shadows | iPhone verification pending |

## What to judge next

- Does a low-speed stall feel understandable and recoverable, not arbitrary?
- Is high-speed ground skimming precise enough while still dangerous?
- Is +25 m/s boost satisfying without creating another speed/flip glitch?
- Are first and third person both comfortable on the target phone?
- Is the menu deliberate without feeling slow?

Change one feel group at a time, rerun `npm test`, and record the phone result here. World-art changes belong in `world-recipe.json`, not in this feel record.
