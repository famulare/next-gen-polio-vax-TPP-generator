# Next-gen polio vaccine TPP generator

This interactive TPP generator helps vaccine-development experts reason about
the question: **under what conditions can an OPV-like vaccine block the modeled
close-contact transmission motif?** The generator is based on the model in
[this paper](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468).

Explore the related [data explorer](https://famulare.github.io/cessationStability/onlineVisualization/).

## Prototype status

This working artifact is a **scientific prototype** and conditional-plausibility
tool for population-level herd immunity. Under the close-contact sufficiency
axiom, it treats the modeled motif as high strength and the remaining network
connections as mostly weaker. Its point-rule threshold comparisons do not
calculate a complete population `R_e` or establish clinical product
performance. Section 15.1 direct-port grids and the Section 15.2 prevalence
calibration are the approved hybrid-equivalence evidence for this iteration.

The default decision is a direct point comparison at the UP/Bihar high anchor,
the hardest known empirical/model-calibrated stress-test in the committed
setting catalog. The default hypothetical product (routine schedule plus a
booster at age 1 year) has direct `R_loc = 0.7366389853385256` there and
therefore satisfies the strict `R_loc < 1` criterion.
Clearing that anchor supports likely adequacy under less demanding conditions
represented by this mechanism, but does not prove control everywhere. The
blue-white-red setting surface is a fixed, nonbinding interpretation domain
(`1-1,000` micrograms/exposure and `1-20` close contacts), not a global decision
envelope.

The browser now offers two readings of the same deterministic model:

- **Learn the causal chain** preserves the teaching-first narrative from
  product and schedule through immunity, acquisition, breakthrough shedding,
  the two-link close-contact motif, and the direct decision.
- **Compare product scenarios** adds a transmission-efficacy TPP workbench that
  keeps product assumptions, program conditions, modeled biological effects,
  epidemiologic setting, evidence status, controlled comparisons, and direct
  `R_loc` together.

The workbench is a transmission-efficacy module for a TPP, not a complete
vaccine TPP. Its architecture and scientific invariants are documented in
[docs/tpp-workbench.md](./docs/tpp-workbench.md). A moderated comprehension
protocol is provided in
[docs/comprehension-test-protocol.md](./docs/comprehension-test-protocol.md).

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
  paper's shedding-index idea; a received dose and biological take; the
  live-vaccine immune response and how the schedule composes the cohort
  distribution month by month; the schedule-derived assessment-age immunity
  distribution; a separate product-and-schedule interaction chapter; the
  close-contact motif; only then the direct result, setting surface,
  measurement handshake, and linked outcome/product maps. For Sabin OPV and the
  hypothetical OPV-like product the immune coordinate is visualized one-to-one
  as a serum-equivalent neutralizing correlate; IPV keeps distinct serum and
  mucosal semantics.
- A TPP translation layer that renames `takeContext` as a context multiplier,
  displays actual modeled take by dose, decomposes direct `R_loc` into its two
  transmission links, reconciles that teaching waterfall with the production
  calculation, supports pinned and fixed-comparator comparisons, and exports a
  human-readable decision record.
- Versioned `WithinHostDiagnosticsV2` outputs on a committed 41-dose CID50 and
  1-120 day grid, carrying read-only immune-response diagnostics: the
  taking-dose boost-response curve and the monthly schedule trace. These are
  deterministic projections of the production schedule, dose-response, and
  joint shedding kernels; they are explanatory diagnostics, not new decision
  rules or measured endpoints.
- A blue-white-red setting surface centered at `R_loc = 1`, with one named
  setting selector that both decides and defines the displayed frequency slice.
  The surface varies linked mass per exposure and close-social-contact count;
  named anchors with different link frequencies are omitted rather than plotted
  over nonmatching raster values.
- The same 2,601 directly evaluated hypothetical designs in linked
  reference-challenge effect and two-parameter product coordinates, including
  keyboard, pointer, and touch inspection, explicit empty-frontier behavior,
  and fixed Sabin 2/IPV comparator semantics.
- Transactional scientific updates that retain but mark the prior result stale,
  fail invalid state closed, and disable export until all dependent outputs
  commit atomically.
- Canonical URL state plus versioned JSON, stable CSV grids, standalone SVG
  exports, and a human-readable Markdown decision record with scenario, scope,
  qualification, conditioning, and evidence status.

The locked [design contract](./DESIGN_CONTRACT.md) remains canonical. This
iteration has **one point success rule**: `R_loc_max < 1`. Parameter-uncertainty
intervals and an upper-95 rule are deliberately out of scope. The source audit
found Cessation bootstrap arrays whose fit/evaluation path invokes a prohibited
independent CI sampler, and an India grouped-Sobol sweep rather than posterior
draws; neither is relabeled as a probability interval. A future sensitivity
analysis must stay labeled as sensitivity unless its own contract amendment
supplies an admissible joint ensemble. Current point outputs therefore do not
quantify threshold-crossing probability or support probability-weighted
expected-loss or risk-sensitive decisions. The record of that scope decision is
in [docs/release-blocker-source-audit.md](./docs/release-blocker-source-audit.md).

## Pages

The self-contained artifact is compatible with GitHub Pages and deploys through
the checked-in Actions workflow. Configure **Settings -> Pages -> Build and
deployment -> Source: GitHub Actions**; the live URL is
<https://famulare.github.io/next-gen-polio-vax-TPP-generator/>.
