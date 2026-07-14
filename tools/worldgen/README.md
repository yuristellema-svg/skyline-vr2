# Skyline offline world generator

This zero-dependency Node pipeline turns `world-recipe.json` into the committed, streamable Stage C world under `assets/world/`.

Run from the project root:

```text
node tools/worldgen/generate.mjs
node tools/worldgen/validate.mjs
```

The output is deterministic: no clock, platform path, or unseeded random value enters the assets. The manifest's `contentHash` fingerprints the exact recipe, feature file, and ordered pack hashes.

## Art direction workflow

Edit `world-recipe.json`, not the runtime. The recipe owns biome regions, mountain shaping, the river and canyon splines, lake basin, city plateau, five bridges, landmarks, prop families, and biome densities. Then regenerate and validate.

## Pack layout

The 8×8 km world contains 32×32 logical 256 m chunks. Four-by-four chunks are grouped into one 1,024 m `.wpk`, producing 8×8 = 64 fetchable packs. A pack is intentionally uncompressed and little-endian so iPhone Safari can decode it directly from an `ArrayBuffer` without PNG precision loss, an inflate library, or a large temporary decode allocation.

Each pack contains:

1. A 48-byte `SVW3` header.
2. Sixteen 16-byte chunk-index entries.
3. A 513×513 `Uint16` height field at 2 m/sample, including shared borders.
4. A 257×257 `Uint8` biome field at 4 m/sample, including shared borders.
5. Sorted 12-byte prop records with no stored Y value; runtime Y comes from the exact height field.

Header fields, in byte order:

```text
0   char[4] magic "SVW3"
4   u16 version
6   u16 flags (1 little endian, 2 packed biome, 4 prop Y from terrain)
8   u16 region X
10  u16 region Z
12  u16 chunks per side
14  u16 height samples per side
16  u16 splat samples per side
18  u16 prop record bytes
20  u32 height offset
24  u32 height bytes
28  u32 splat offset
32  u32 splat bytes
36  u32 chunk-table offset
40  u32 prop offset
44  u32 prop count
```

Each chunk-index entry stores `heightStartX:u16`, `heightStartZ:u16`, `splatStartX:u16`, `splatStartZ:u16`, `propFirst:u32`, and `propCount:u32`.

Biome byte decoding is `primary = byte & 7`, `secondary = (byte >> 3) & 7`, and `blend = (byte >> 6) / 3`.

The validator checks every file hash and offset, every chunk-to-prop range, all prop records, all authored features, and every shared height and splat edge between neighboring packs.
