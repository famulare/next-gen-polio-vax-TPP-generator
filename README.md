# Next-gen polio vaccine TPP generator

We are making an interactive TPP generator to help people reason about the
question: **how much shedding reduction is required of a successful new
vaccine?** The generator is based on the model in [this paper](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468).

Explore the related [data explorer](https://famulare.github.io/cessationStability/onlineVisualization/).

## Prototype status

This working artifact is a **scientific prototype**, not a complete-population
model or a decision-use product claim. Its point-rule threshold comparisons and
exports describe the v1 close-contact sufficiency calculation only; they do not
establish a complete population `R_e`, clinical performance, or an unconditional
guarantee. Section 15.1 direct-port grids and the Section 15.2 prevalence
calibration are the approved hybrid-equivalence evidence for this iteration.

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

The locked [design contract](./DESIGN_CONTRACT.md) remains canonical. This
iteration has **one point success rule**: `R_loc_max < 1`. Parameter-uncertainty
intervals and an upper-95 rule are deliberately out of scope. The source audit
found Cessation bootstrap arrays whose fit/evaluation path invokes a prohibited
independent CI sampler, and an India grouped-Sobol sweep rather than posterior
draws; neither is relabeled as a probability interval. A future sensitivity
analysis must stay labeled as sensitivity unless its own contract amendment
supplies an admissible joint ensemble. The record of that scope decision is in
[docs/release-blocker-source-audit.md](./docs/release-blocker-source-audit.md).

## Pages

The self-contained artifact is compatible with GitHub Pages and deploys through
the checked-in Actions workflow. Configure **Settings → Pages → Build and
deployment → Source: GitHub Actions**; the live URL is
<https://famulare.github.io/next-gen-polio-vax-TPP-generator/>.
