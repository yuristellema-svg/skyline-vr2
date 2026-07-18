# Actual Three.js settlement preview

Serve the repository root and open `settlement-preview/`.

The harness imports the repository's real `vendor/three.module.min.js`, `createSettlementSystem`, sample manifest, geometry, pooled materials, instancing, quality budgets and explicit night-lighting code. The terrain, road strips, water and trees exist only to make the supplied placement relationships readable in isolation.

Controls:

- quality: phone, medium, high;
- lighting: day, sunset, night;
- views: aerial, low approach, downtown, skyline, civic, old quarter, harbour, town and village.

Query parameters:

```text
quality=low|medium|high
light=day|sunset|night
view=aerial|approach|downtown|skyline|civic|oldquarter|harbour|town|village
capture=1
```

The PNG files in `screenshots/` were captured from this WebGL harness at 1440×810. `proof-sheet.png` collects the requested views and `before-after.png` compares the previous flat diagnostic with the actual high-tier render.
