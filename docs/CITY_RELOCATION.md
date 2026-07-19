# Skyline city relocation v1

The city is moved from the river/escarpment overlap to a 920 m western-plain footprint centred at (-2350, -3000). The world generator now makes the city core exactly 40 m, suppresses fine terrain noise and procedural props inside the operational urban footprint, and feathers the platform over 260 m.

The runtime city is rebuilt as five instanced draw calls: roads, sidewalks, parks/plazas, district buildings/landmarks and roof silhouettes. Downtown, civic, residential and industrial districts use separate massing rules while sharing geometry and materials for phone VR.

Rendering budget fix: city solids/rooftops are batched into one instanced draw call and roads/sidewalks/parks/plazas into one second draw call.
