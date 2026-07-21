# Next-gen polio vaccine TPP generator

This interactive TPP generator helps vaccine-development experts reason about
the question: **under what conditions can an OPV-like vaccine block the modeled
close-contact transmission motif?** The generator is based on the model in
[this paper](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468).

Explore the related [data explorer](https://famulare.github.io/cessationStability/onlineVisualization/).

## Prototype status

This working artifact is a **scientific prototype** and conditional-plausibility
tool for population-level herd immunity. Under the v1 close-contact sufficiency
axiom, it treats the modeled motif as high strength and the remaining network
connections as mostly weaker. Its point-rule threshold comparisons do not
calculate a complete population `R_e` or establish clinical product
performance. Section 15.1 direct-port grids and the Section 15.2 prevalence
calibration are the approved hybrid-equivalence evidence for this iteration.

The default decision is a direct point comparison at the UP/Bihar high anchor,
the hardest known empirical/model-calibrated stress-test in the committed
setting catalog. The default hypothetical product has direct `R_loc =
0.9201071208363125` there and therefore meets the strict `R_loc < 1` criterion.
Clearing that anchor supports likely adequacy under less demanding conditions
represented by this mechanism, but does not prove control everywhere. The
blue-white-red setting surface is a fixed, nonbinding interpretation domain
(`0.1-2,000` micrograms/exposure and `1-20` close contacts), not a global
decision envelope.

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
- A teaching-first model narrative: dose-dependent WPV acquisition,
  breakthrough-conditioned shedding duration and concentration, daily joint
  infectious burden, and a one-WPV-HID50 relative analogue to the source
  paper's shedding-index idea;
  schedule-derived immunity distribution; close-contact motif; only then the
  direct UP/Bihar result, setting surface, measurement handshake, and linked
  outcome/product maps.
- Versioned `WithinHostDiagnosticsV1` outputs on a committed 41-dose CID50 and
  1-120 day grid. These are deterministic projections of the production
  schedule, dose-response, and joint shedding kernels; they are explanatory
  diagnostics, not new decision rules or measured endpoints.
- A blue-white-red setting surface centered at `R_loc = 1`, with independent
  decision-scope and inspection-probe controls and low, Houston/Louisiana,
  Matlab hybrid, and UP/Bihar anchors.
- The same 2,601 directly evaluated hypothetical designs in linked requirement
  and product coordinates, including keyboard, pointer, and touch inspection,
  explicit empty-frontier behavior, and fixed Sabin 2/IPV comparator semantics.
- Transactional scientific updates that retain but mark the prior result stale,
  fail invalid state closed, and disable export until all dependent outputs
  commit atomically.
- Canonical URL state plus versioned JSON, stable CSV grids, and standalone SVG
  exports (including the within-host teaching figure) with scenario, scope,
  probe, model, build, qualification, conditioning, and selection context.

The locked [design contract](./DESIGN_CONTRACT.md) remains canonical. This
iteration has **one point success rule**: `R_loc_max < 1`. Parameter-uncertainty
intervals and an upper-95 rule are deliberately out of scope. The source audit
found Cessation bootstrap arrays whose fit/evaluation path invokes a prohibited
independent CI sampler, and an India grouped-Sobol sweep rather than posterior
draws; neither is relabeled as a probability interval. A future sensitivity
analysis must stay labeled as sensitivity unless its own contract amendment
supplies an admissible joint ensemble. Current point outputs therefore do not
quantify threshold-crossing probability or support probability-weighted
expected-loss or risk-sensitive decisions. The record of that scope decision is in
[docs/release-blocker-source-audit.md](./docs/release-blocker-source-audit.md).

## Pages

The self-contained artifact is compatible with GitHub Pages and deploys through
the checked-in Actions workflow. Configure **Settings → Pages → Build and
deployment → Source: GitHub Actions**; the live URL is
<https://famulare.github.io/next-gen-polio-vax-TPP-generator/>.
