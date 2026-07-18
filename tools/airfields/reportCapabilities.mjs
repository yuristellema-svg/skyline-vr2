import { AIRCRAFT_FLIGHT_PROFILES } from '../../src/aircraftFlightProfiles.js';
import { DEFAULT_AIRFIELD_CATALOG, normalizeAirfieldCatalog } from '../../src/airfields/airfieldCatalog.js';
import { capabilityMatrix } from '../../src/airfields/landingCapability.js';
const fields = normalizeAirfieldCatalog(DEFAULT_AIRFIELD_CATALOG).fields;
const rows = capabilityMatrix(fields, Object.values(AIRCRAFT_FLIGHT_PROFILES));
console.log(JSON.stringify(rows, null, 2));
if (rows.filter(row => row.allowed).some(row => !row.capable)) process.exitCode = 1;
