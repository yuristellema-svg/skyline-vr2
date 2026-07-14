# Fable decisions — Iteration 3

The attached **Skyline VR — Iteration 3 Brief (Fable, locked)** remains the authority. This is the compact implementation record.

## Locked flight and UX decisions

- The old axis-continuity sign flip is removed. Velocity follows the true shortest arc, with deterministic handling near 180°, a 600-frame ring buffer, a 45° glitch trap, and **T** export.
- Body aiming remains crisp and unrestricted; the flight path must now earn its turn through angle of attack and speed. Turning is lift/6 g limited, hard pulls add induced drag, the climb refund is gone, and low-speed nose-up flight stalls and must recover nose-down.
- Input uses a 60 ms filter. Above 100 m/s, body-rate command eases toward 0.85× by 130 m/s; this does not add an attitude clamp.
- Boost charges during a fast committed dive, stays armed for six seconds at any attitude, fires on a firm pull-up, and communicates **DIVE TO CHARGE / PULL / BOOST** at reticle depth.
- The gaze menu uses 120 ms smoothing, separate enter/exit bounds, 0.4 s dwell decay, 0.5 s global lockout, gaze-exit rearming, and a 1.5 s Restart dwell.
- Existing quaternion flight, first/third-person cameras, manual stereo rendering, DPR 1, no shadows, crash recovery, and Home Screen PWA flow are preserved.

## Locked world decision

Stage C uses a deterministic, offline-generated hybrid world—not a licensed monolithic GLB and not sparse runtime noise:

- 8,192 × 8,192 m, authored in `world-recipe.json`;
- 2 m height data, 4 m biome/splat data, 256 m logical chunks, and 64 streamable binary packs;
- three terrain LOD levels, a nominal 1.5 km visible radius plus one 256 m fog buffer, 2 km unload radius, fog from 900–1,600 m, and a 2 km floating-origin threshold;
- river, lake, canyon, 1 km city plateau, five different bridges, eight landmarks, three tree families, rocks, scrub, and posts;
- committed generated output currently validates at 38.46 MiB and 199,478 prop records.

Terrain art is changed by editing `world-recipe.json`, running `npm run world:generate`, then `npm run world:validate`. The runtime should not be rewritten for normal terrain revisions.

## Gate status

- Gates 1–4 have automated coverage and currently pass.
- World recipe, generated packs, hashes, seams, props, and authored-feature data validate.
- Streamed-world integration and deterministic performance budgets pass automated checks. Human menu/boost feel and the target-iPhone thermal/FPS gate remain acceptance work and must not be reported as passed from Node tests alone.

The next owner decisions remain only stall harshness and boost burn strength after the device playtest.
