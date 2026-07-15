# Iteration 3 acceptance testing

## Verified automatically

`npm test` currently passes 41 checks. These cover:

- the 179.9° flip case, monotonic shortest-arc convergence, normalized attitude, and no discontinuous speed jump;
- a deterministic ten-minute simulation with the 45° path-jump trap armed;
- full quaternion loops/rolls, inverted flight, dive speed, honest climb energy, induced drag, stalls and recovery;
- a 90 m/s loop succeeding, a 55 m/s loop stalling, 60 ms input smoothing, and the 15% high-speed rate reduction;
- three-second boost charge, six-second armed window, two-second expiry drain, and any-attitude pull trigger;
- menu smoothing, enter/exit hysteresis, dwell decay, lockout, rearming, and the longer Restart dwell;
- PWA assets, spawn-region offline caching, local imports, and multi-pass stereo render protection;
- real generated-pack parsing, exact terrain collision sampling, 4/8/16 m LOD meshes with skirts, deterministic streaming/reset and respawn pinning, five bridges, eight landmarks, river/lake water, city corridors, scenic collisions, and prop/draw/triangle budgets.

`npm run world:validate` also passes: 64 packs, 1,024 chunks, 38.46 MiB of pack data, shared-edge checks, five bridges, eight landmarks, all eight biomes, and 199,478 deterministic prop records.

These are code/data checks, not proof of comfort or phone performance.

## Desktop browser acceptance — required after final integration

1. Fly for ten minutes without a sudden flip, unexplained loop, speed jump, missing terrain, or console error.
2. Verify first/third person with **C** and the Camera menu item.
3. Perform a 90 m/s loop, intentionally stall from about 55 m/s, recover nose-down, and skim the ground near 120 m/s.
4. Charge and fire boost using only the reticle words.
5. Make ten deliberate gaze selections; then fly/open/close the menu aggressively for five minutes with zero accidental activation.
6. Cross streamed chunk and LOD boundaries. Look for holes, seams, popping, repeated props, water gaps, or collision disagreement.
7. Visit the river, lake, city, canyon, five bridges, and several landmarks.
9. Check visible draw calls stay at or below 300 and visible triangles at or below 400,000.

## Real iPhone acceptance — not yet passed

1. Publish over HTTPS, add to the Home Screen, launch the icon in landscape, and allow motion access.
2. Confirm there is no Safari toolbar. Opening the ordinary Safari tab is not the fullscreen test.
3. Complete a loop, roll, five-second inverted hold, stall/recovery, high-speed ground skim, and boost activation.
4. Try both cameras and all menu items. Confirm stereo fusion, comfortable reticle depth, stable recentering, and no accidental menu actions.
5. Fly the city-core route for ten minutes while recording FPS once per second. Pass requires average ≥58 FPS, minute-ten minimum ≥45 FPS, stable heap, and no reload.
6. Watch for heat, battery throttling, motion drift, audio/wake-lock interruption, missing streamed packs, and offline/relaunch behavior.

Do not label Iteration 3 complete until this iPhone run is recorded. The two subjective follow-ups are stall harshness and boost strength.
