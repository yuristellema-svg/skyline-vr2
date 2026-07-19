# World Core operational airfield remap

The deep airfield worker originally used provisional coordinates audited
against the compact Biplane V4 terrain. Those sites were inside forested
legacy-world terrain after World Core expanded the map.

The live catalog now uses the two prepared World Core shelves:

- Skyline Municipal: Lake Country shelf at `(-6200, 800)`, heading 25 degrees,
  1280 x 48 metres.
- East Meadow Relief: South Coast shelf at `(4200, -5900)`, heading -10
  degrees, 1540 x 55 metres.

The navigation map resolves the operational labels to these same authoritative
World Core manifest positions. Duplicate placeholder airfield destinations
were removed.

Outer-world procedural trees, rocks, fields and utility poles now consume the
operational airfield exclusion catalog so they cannot cover any runway.
