# Next-gen polio vaccine TPP generator

We are making an interactive TPP generator to help people reason about the
question: **how much shedding reduction is required of a successful new
vaccine?** The generator is based on the model in [this paper](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468).

Explore the related [data explorer](https://famulare.github.io/cessationStability/onlineVisualization/).

## Run locally

The app is a deterministic, self-contained HTML artifact. Node 24 LTS and npm
are required.

```sh
npm ci
npx playwright install chromium
npm run verify
open dist/index.html
```

The required release commands are `npm run typecheck`, `npm test`, `npm run
build`, `npm run check:artifact`, and `npm run verify`. The artifact contains
the model, parameter manifests, CSS, and UI in exactly one file and has no
runtime network dependency.

## What is implemented

- 16-bin mucosal and internal serum state with exact probability-mass
  propagation, repeated-dose take/no-take tilting, waning, and boost matrices.
- Sabin 2 OPV, India-semantics IPV, and a variable hypothetical OPV-like
  vaccine; RI at 6, 10, and 14 weeks; optional 1-4 year booster; 28/90-day
  assessment lag.
- Distribution-native index conditioning and index -> household -> social
  transmission with fractional daily contact frequency and the declared
  `R_loc` endpoint.
- Linked requirement/product maps, setting surface with low, Houston/Louisiana,
  Matlab hybrid, and UP/Bihar anchors, URL state, and JSON/CSV/SVG exports.

The locked [design contract](./DESIGN_CONTRACT.md) remains canonical. The v1
uncertainty manifest is deliberately empty: no reviewed joint bootstrap or
posterior draws were supplied by the locked source snapshot, so the UI exposes
that limitation and does not relabel independent confidence endpoints as a
probability interval. Source-model parity fixtures and a reviewed ensemble are
release gates for claiming numerical parity and upper-95 decision support;
the current implementation includes invariant/schema/frontier/artifact tests
and records this residual gap in [IMPLEMENTATION_LOG.md](./IMPLEMENTATION_LOG.md).

## Pages

The intended static-host URL is
`https://famulare.github.io/next-gen-polio-vax-TPP-generator/`.
