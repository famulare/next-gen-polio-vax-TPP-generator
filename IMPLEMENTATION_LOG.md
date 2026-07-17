# Implementation delegation log

This file is the concise audit record for delegated implementation and review
work under Section 14.6 of the design contract. It is not a chat transcript and
does not replace source provenance, git history, or verification output.

## Entry template

- Date:
- Objective:
- Executor/model version:
- Contract sections and source files supplied:
- Allowed files or worktree:
- Required output and discriminator:
- Content-block classification and rationale:
- Reframe/retry status:
- Result disposition: accepted, revised, rejected, or no result
- Primary review:
- Verification run:
- Residual uncertainty:

## Planning-stage review record

### 2026-07-15 -- independent software-plan review

- **Objective:** adversarially review the design contract for implementation
  blockers, semantic ambiguity, missing acceptance tests, and unnecessary v1
  scope.
- **Initial executor:** Claude Opus 4.8 through the local supervised wrapper.
- **Content-block status:** the broad review was refused under the provider's
  acceptable-use filter before substantive review output.
- **Primary assessment:** `likely_false_positive`; the requested output was a
  bounded software-design critique over code contracts, tests, and release
  gates. The successful reframe preserved that purpose and narrowed the task to
  those technical artifacts.
- **Fallback:** a broad GPT-5.5 review also blocked; a fresh, explicitly bounded
  software-design review produced usable findings.
- **Disposition:** revised and accepted selectively by the primary integrator.
- **Integrated findings:** binding `R_loc` calibration/refit gate; explicit
  ownership and schemas; units and grid contracts; uncertainty labeling;
  deterministic cache identity; exact build commands; and v1 scope reduction.
- **Primary semantic correction:** the provisional independent effect operators
  were rejected because they did not map exactly to the mechanistic product
  outcomes. Both primary panels now show the same directly evaluated product
  grid in different coordinates.
- **Verification:** locked-decision scan, contradiction scan, Markdown-fence and
  whitespace checks, source-commit verification, git diff review, and public
  remote verification.
- **Residual uncertainty:** none blocking implementation. The calibration gate
  may correctly stop release and require a versioned refit.

## Implementation status

### 2026-07-17 -- fixed-comparator schedule source fixture increment

- **Objective:** close the next bounded Section 15.1 gap by making fixed
  Sabin-2/IPV schedule composition source-derived and auditable without
  changing product parameters, equations, defaults, or UI behavior.
- **Executor/model version:** Codex direct implementation.
- **Contract sections and source files supplied:** Sections 6.2, 8.3, 11.2,
  14.4--14.6, 15.1, 15.3, and 16; pinned India files `mixture.R`,
  `titer_bounds.R`, `susceptibility.R`, `immunity.R`, and `vaccination.R` at
  `1e3e832742e84a36fbc75d81b3a2d19cde8208e6`; the fixture generator,
  comparator fixture, schedule model, model tests, fixture README, and
  remediation plan.
- **Allowed files or worktree:** this repository and read-only pinned India
  source checkout; generated fixture, manifest, calibration report, docs, and
  tests only.
- **Required output and discriminator:** `india-r-comparators-v1.json` contains
  source-executed fixed Sabin-2 and IPV one-, three-, and four-dose schedule
  composition cases for both selected assessment lags. The TypeScript port
  matches each case at the locked direct-port tolerance; three- and four-dose
  fixed-comparator cases are also checked through `buildScheduleState`.
  Individual fixtures and the manifest remain explicitly partial and
  ineligible for the full Section 15.1 gate.
- **Content-block classification and rationale:** not applicable; direct
  bounded implementation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted locally as a partial-parity increment.
- **Primary review:** kept the increment limited to source-generated schedule
  composition. The generator reuses the source-kernel event order, parameterizes
  the catalog Sabin boost (`mu0 = 6`, `sigma0 = 2.4`) and Sabin-2 take context,
  and routes IPV through the India vaccination helpers so naive mucosal state
  remains unchanged while primed mucosal state receives the Sabin boost. No
  browser model behavior changed. Release-risk wording was narrowed so schedule
  coverage is no longer listed as missing, while fixed-comparator transmission
  outcomes and broader direct-port grids remain missing.
- **Verification run:** `Rscript scripts/generate-reference-fixtures.R`,
  `npm run generate:calibration-report`, focused `npm run typecheck &&
  npm test && npm run check:reference-fixtures && npm run check:calibration`,
  and full `npm run verify` all pass. Full verify included 24 model tests,
  fixture-generator preflight tests, reference-fixture and calibration
  currentness checks, performance checks (`selected 2.3 ms; surface 14.7 ms;
  frontier 903.6 ms`), build, artifact check, and Chromium smoke. Built
  artifact SHA-256 remained
  `51a253a45b54d7dce1fe75503211e4c7331ccbcf7a49fd3c353ec06726338a38`.
- **Residual uncertainty:** the fixture collection remains partial; broader
  India R direct-port grids and fixed-comparator transmission outcomes remain a
  Section 15.1 release gate. The reviewed joint uncertainty ensemble is also
  absent, so no release eligibility or decision-use classification is claimed.

### 2026-07-16 -- fixed-comparator source fixture and Edge semantics pass

- **Objective:** close the next bounded Section 15.1 gap by making fixed
  Sabin-2/IPV semantics source-derived and auditable; verify that the browser
  does not describe a selected fixed comparator as a hypothetical product.
- **Executor/model version:** Codex direct implementation; manual Edge pass
  through Computer Use, with Mike's open local artifact tab.
- **Contract sections and source files supplied:** Sections 6.2, 8.3, 11.2,
  14.4--14.6, 15.1, 15.3, 15.6, and 16; pinned India files `mixture.R`,
  `titer_bounds.R`, `susceptibility.R`, `immunity.R`, and `vaccination.R` at
  `1e3e832742e84a36fbc75d81b3a2d19cde8208e6`; the fixture generator,
  comparator catalog, browser app, and smoke test.
- **Allowed files or worktree:** this repository and read-only pinned India
  source checkout; no parameter, equation, default, or calibration change.
- **Required output and discriminator:** a versioned India R fixture for
  boost-transition matrices across the hypothetical boost range plus IPV
  naive/primed mucosal-serum behavior; every case matches the TypeScript
  port at the locked direct-port tolerance, partial artifacts remain explicitly
  ineligible for the global Section 15.1 gate, and the UI makes comparator
  controls and meanings unambiguous.
- **Content-block classification and rationale:** not applicable; direct
  bounded implementation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted locally as a partial-parity increment.
- **Primary review:** found that a prewritten comparator generator was not
  invoked and would have claimed individual release eligibility inconsistent
  with the partial fixture manifest. It now generates
  `india-r-comparators-v1.json` with a false release flag, declared source
  inputs, manifest hash, and tests. Regeneration also exposed a stale test
  schema that assumed only fixed WPV susceptibility parameters; it now uses
  the parameterized per-bin port for every source case rather than discarding
  the source grid. Edge inspection found the disabled Sabin boost control was
  labeled as hypothetical; product-specific help now distinguishes Sabin,
  IPV, and the editable hypothetical product.
- **Verification run:** `Rscript scripts/generate-reference-fixtures.R`,
  `npm run generate:calibration-report`, `npm run typecheck`, `npm test`
  (24 tests), `npm run check:reference-fixtures`, `npm run check:calibration`,
  `npm run build`, and `npm run check:artifact` all pass. In Edge, stale URL
  state was rejected before evaluation, changing products withheld stale
  results and exports until reevaluation, fixed controls were disabled, the
  source-derived comparator semantics were visible, and prototype/release
  limitations remained explicit. A named-setting selection was not completed
  because Mike changed the active Edge surface during that check; automated
  model and Chromium coverage remains the evidence for that path.
- **Residual uncertainty:** at the time of this entry, the fixture collection
  remained partial. The later 2026-07-17 entry adds fixed-comparator schedule
  composition coverage; current blockers are broader India R direct-port grids,
  fixed-comparator transmission outcomes, and the reviewed joint uncertainty
  ensemble. No release eligibility or decision-use classification is claimed.

### 2026-07-16 -- India shedding-age source audit

- **Objective:** determine whether the observed shedding-age peak discrepancy
  between the pinned `india-polio` source and the legacy Cessation Matlab
  model is (a) a source-parameter difference, (b) a faithful but scientifically
  consequential source-model difference, or (c) a translation error in this
  repository.
- **Executor/model version:** supervised source-audit subagent requested by
  Mike; harness does not expose a model-version identifier.
- **Contract sections and source files supplied:** Sections 7.7 and 15.1;
  pinned `india-polio` commit `1e3e832742e84a36fbc75d81b3a2d19cde8208e6`,
  `src/model/shedding.ts`, and the India fixture generator/parameters.
- **Allowed files or worktree:** read-only inspection of both repositories; no
  code edits, commits, or issue creation by the delegate.
- **Required output and discriminator:** exact equations, parameter sources,
  and line citations establishing whether this implementation is a faithful
  translation; source tests or documentation bearing on intended semantics.
- **Content-block classification and rationale:** not applicable; a bounded
  local source-code audit.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted. The browser was a faithful India-source
  translation before Mike approved the explicit Cessation correction; the
  discrepancy is in the upstream India source, not its parameter values.
- **Primary review:** directly verified the R production equation at
  `model/R/shedding.R:287-322`, the C++ kernel, the supplementary-methods
  equation and parameters, and the legacy Matlab implementation. At 18 months
  the source is lower by `0.397495 log10` (a `2.497x` peak difference); at 48
  months it is lower by `0.019317 log10` (`1.045x`).
- **Verification run:** `npm run typecheck`, source-fixture regeneration,
  `npm run check:reference-fixtures`, and `npm test` after implementing the
  legacy age function and diagnostic fixture classification.
- **Upstream disposition:** filed
  [india-polio issue #108](https://github.com/famulare/india-polio/issues/108)
  requesting restoration of the seven-month plateau/offset or an explicit
  documented refit, with discriminating regression ages.
- **Residual uncertainty:** India source history establishes internal
  no-shift consistency but does not document a scientific refit or rationale;
  the issue asks maintainers to resolve intent. This repository now has the
  user-approved Cessation equation and direct regression values.

### 2026-07-16 -- prevalence calibration report

- **Objective:** execute the approved day-1--45, infection-conditioned
  prevalence calibration against source-executed Houston, India, and Matlab
  targets.
- **Implementation:** deterministic staged grid searches with variance fixed
  by the five schedule/waning/boost capture moments: Matlab fits its index
  mean and `T_ih`; India jointly fits its high-immunity contact mean and
  `T_ih`; Houston index and contacts are point-mass naive states.
- **Initial diagnostic:** the fixed schedule-derived Matlab index state failed
  before a contact fit could affect it: primary `0.45064 log10`, secondary
  `0.19342 log10` versus the `0.1 log10` gate. The source scalar index titer
  and the browser's breakthrough-conditioned distribution select different
  immunity populations; a moment-matched Gaussian alone changed primary RMSE
  only to `0.43953 log10`.
- **Scientific decision:** Mike approved the staged, identifiable refit:
  Matlab fits its variance-constrained index mean from primary prevalence and
  then fits `T_ih` from secondary prevalence; Houston remains entirely naive
  and retains its named `T_ih`. Mike subsequently approved a contract-1.4
  India joint fit of the variance-constrained high-contact mean and `T_ih` to
  the secondary trajectory. Contact count remains fixed.
- **Result:** all named target roles pass. Houston maximum RMSE is
  `0.00296 log10`; India secondary is `0.00935 log10` at fitted contact mean
  `9.20`, constrained variance `4.06097 log2^2`, and `T_ih = 199.526
  µg/exposure`; Matlab primary is `0.05203 log10` at fitted index mean `10.17`,
  and secondary is `0.02770 log10` at fitted `T_ih = 12.589
  µg/exposure`.
- **Disposition:** `calibration-report-v1.json` is versioned with
  `calibrationGateSatisfied: true`; its SHA-256 is recorded in
  `manifest-v1.json`. Section 15.2 passes, while release remains blocked by
  partial Section 15.1 direct-port parity and the absent reviewed uncertainty
  ensemble.
- **Verification:** `npm run verify` passes: typecheck, 23 model tests,
  fixture-generator preflight, source/calibration artifact checks, build,
  artifact integrity, and Chromium smoke.

### 2026-07-16 -- release-audit hardening

- **Objective:** make the current prototype's evaluated output, generated
  artifact, and static-hosting behavior auditable without implying release
  eligibility.
- **Executor/model version:** Codex direct implementation.
- **Contract sections and source files supplied:** Sections 14.4--14.6, 15.3,
  15.6, and 16; `src/app.ts`, `scripts/build.mjs`,
  `scripts/browser-smoke.mjs`, generated manifests, and CI workflows.
- **Allowed files or worktree:** this repository only; no source-model edits.
- **Required output and discriminator:** deterministic build identity; current
  contract/manifest disclosures; JSON/CSV/SVG export checks; Pages path-prefix
  load; performance targets; and a repeat-build artifact hash.
- **Content-block classification and rationale:** not applicable; direct
  bounded software implementation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted locally as prototype hardening.
- **Primary review:** corrected the stale calibration-pending disclosure and
  stale contract version; preserved the explicit partial-Section-15.1 and
  absent-ensemble release blocks. JSON records the evaluated scenario, model
  identity, and build identity; CSV retains all five setting coordinates; SVG
  carries the prototype disclosure.
- **Verification run:** `npm run verify` passes. The measured targets were
  selected `2.1 ms`, setting surface `15.2 ms`, and frontier `919.7 ms`;
  Chromium checks local-file behavior, stale/invalid-state withholding,
  keyboard focus, narrow viewport, all exports, and the GitHub Pages path
  prefix. Two consecutive local builds produced the same SHA-256
  `f422f49d776f8f7bf10958d86fc756cf63d0f9003d8a601ade49e1083f453ec4`.
- **Residual uncertainty:** manual Edge interaction/accessibility review is
  deferred until the Mac is unlocked. Full Section 15.1 direct-port coverage
  and a reviewed joint uncertainty ensemble remain release blockers; no
  release classification is claimed.

### 2026-07-15 -- direct integrator implementation

- **Objective:** implement the locked v1 deterministic browser TPP generator.
- **Executor/model version:** Codex direct implementation.
- **Contract sections and source files supplied:** Sections 1-20; locked
  manifests from `india-polio` commit
  `1e3e832742e84a36fbc75d81b3a2d19cde8208e6` and `cessationStability` commit
  `3d779963e9febe8e6262964b185c8277234f41e0`.
- **Allowed files or worktree:** this repository only; source repositories
  read-only.
- **Required output and discriminator:** one self-contained `dist/index.html`,
  pure model boundary, deterministic 51x51 product grid and 81x40 setting
  surface, strict schemas, and release checks.
- **Content-block classification and rationale:** not applicable; direct
  bounded software implementation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** revised and accepted locally.
- **Primary review:** direct contract review; removed a temporary global
  indirection and prevented anchor metadata from leaking into `SettingV1`.
- **Verification run:** `npm run typecheck`, `npm test`, `npm run build`,
  `npm run check:artifact`; Chromium smoke checks cover load, figures, URL
  round-trip, keyboard focus, console errors, and external requests.
- **Residual uncertainty:** reviewed source parity fixtures and a joint
  calibration/uncertainty ensemble are not present in the locked input state.
  The implementation fails closed on upper-95 availability and does not claim
  posterior probability. The existing R fixture script refuses tracked source
  changes before future fixture generation.
