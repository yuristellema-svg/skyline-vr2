# Phone VR notes

Phone VR keeps all three fields and all navigation functions.

The package uses hard per-field mobile light budgets, low-poly lamps and towers, and world-space guidance geometry. It does not add large text overlays. The guidance phase is one of locator, approach or departure and is represented by a distant locator ring, sparse approach bars or departure rings.

PAPI state is produced as compact data (`four-white`, `three-white`, `two-white-two-red`, `three-red`, `four-red`) for future cockpit instruments. Existing `main.js`, camera, input and menu code remain untouched.
