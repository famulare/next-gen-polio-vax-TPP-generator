# Reference fixtures

The locked source repositories and their commits are recorded in
`src/data/provenance.json`. Numerical R/Matlab parity fixtures are not bundled
yet because the source snapshot has not been passed through a reviewed fixture
generator. `scripts/generate-reference-fixtures.R` fails closed on tracked
source changes and is the entry point for adding them.

Until this directory contains generated fixtures, the app must not claim the
Section 15.1 parity or Section 15.2 calibration gates have passed. The current
tests cover the browser model's own invariants, strict schemas, direct frontier
classification, deterministic serialization, and artifact behavior.
