# Aircraft capability audit

The model evaluates every field, aircraft, operation and runway direction using the live aircraft profiles during installation.

The exact-base package check covered Zero, Stuka, Scout, PT-17 biplane and glider:

- 27 operationally allowed rows;
- 0 allowed rows with insufficient modeled runway length;
- primary field supports all powered aircraft and glider landing;
- Crown Ridge accepts Scout, PT-17 and glider landing only in the safe direction;
- Crown Ridge powered takeoff is limited to Scout and PT-17 in the downhill direction;
- glider self-powered takeoff remains disabled;
- closed or restricted combinations are reported as unavailable rather than silently accepted.
