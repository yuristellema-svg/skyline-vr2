# Skyline VR — Iteration 3

All 41 automated tests and world-data validation pass. This does **not** mean the real-iPhone feel, thermals, frame rate, menu comfort, or first-time boost test has passed; those still need a final device playtest.

## Play

- iPhone: open the HTTPS Pages link in Safari, tap **Share → Add to Home Screen**, then launch the new icon in landscape and choose **Start phone VR**. Safari cannot be forced into true fullscreen from a webpage; the Home Screen launch is the fullscreen version.
- Flight: dive below a 15° downward path at more than 90 m/s for three seconds. The reticle changes from **DIVE TO CHARGE** to **PULL**. The charge stays armed for six seconds; pull up firmly to fire **BOOST** at any attitude.
- Menu: look more than 45° to the side for one second, then dwell on an item. The menu includes Resume, Recenter, Camera, Respawn, Sensitivity, Effects, and Restart World.

When published from the repository shown in the project screenshots, the game link is:

https://yuristellema-svg.github.io/skyline-vr/

## GitHub Pages upload

For the first Iteration 3 deployment:

1. Unzip the delivered build on the computer.
2. In GitHub, replace the old game files with the **contents** of the extracted folder. Keep paths such as `src/`, `assets/world/`, `vendor/`, and `tools/`. Do not upload only the ZIP.
3. If GitHub limits one browser upload, upload the root/code first and `assets/world/packs/` as a second batch.
4. Commit the upload. Keep **Settings → Pages → Deploy from a branch → main → / (root)** selected.
5. Wait for Pages to finish, then reopen the link. On iPhone, close and relaunch the Home Screen app so its service worker updates.

Later changes are modular: upload only the exact changed files Codex lists, in the same folders. A physics change does not require re-uploading the world packs; a terrain-art change normally requires `world-recipe.json`, regenerated manifest/features, and only the regenerated packs.

## Local checks and world editing

- `npm run world:validate` — hashes, pack structure, seams, props, and authored features.
- `npm run serve` — local browser build.
- `npm run world:generate` — rebuilds world assets after editing `world-recipe.json`.

See [TESTING.md](./TESTING.md) for the remaining acceptance run, [FEEL.md](./FEEL.md) for tuning values, and [FABLE_DECISIONS.md](./FABLE_DECISIONS.md) for the locked design record.
