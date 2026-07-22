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

### 2026-07-21 -- Gates-aligned independent visual revision

- **Objective:** revise the teaching-first browser presentation around the
  Gates visual guidelines while retaining an independent product identity and
  every locked v1 scientific behavior.
- **Executor/model version:** Codex direct implementation; application version
  `0.5.0-prototype`; design-contract version unchanged.
- **Contract surface and allowed files:** presentation, export, artifact, and
  direct-implementation-record surfaces only: `src/styles.css`, chart and app
  rendering, local font assets, build, browser smoke, focused UI tests, and
  generated artifact/hash. No model, manifest, URL, equation, schema, default,
  decision rule, or scientific-language edit is permitted by this task.
- **Scientific discriminator:** the `R_loc` display scale remains exactly
  `#2166AC -> #F7F7F2 -> #B2182B`, with the midpoint fixed at `R_loc = 1`.
  It is a scientific-contract exception to the brand data palette. Reference
  and selected series remain distinguishable through dash/solid style, labels,
  position, and marks in addition to color.
- **Presentation decision:** Parchment, Weathered Slate, Blooming Saffron,
  White, and Dark Blue provide the interface roles. Medium Orange is the
  dashed naive/reference series; Dark Magenta the solid selected cohort; Dark
  Turquoise the directly labeled Pareto boundary; Dark Blue the reference-dose
  and held-selection marks; and Dark Orange the annotated hybrid interval.
  Noto Sans and Noto Serif WOFF2 assets are local data URLs on screen and in
  standalone SVGs under the bundled SIL Open Font License.
- **Independence boundary:** no Gates logo, monogram, Gate device, photography,
  or Foundation-affiliation claim is introduced. `TPP / WPV1`, existing tool
  navigation, narrative order, and editorial non-dashboard composition remain.
- **Content-block classification and rationale:** not applicable; direct,
  bounded interface implementation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted locally as a deterministic prototype
  presentation revision.
- **Primary review:** visual changes are isolated from the model boundary; the
  focused tests assert fixed surface endpoints, palette roles, and data URL
  font-face generation.
- **Verification run:** `npm run verify` passes: typecheck; 49 tests,
  including palette, scientific-scale, and font-face checks; fixture,
  calibration, performance, and cache-memory checks; build; artifact integrity;
  Chromium screen/export, inline-font, contrast, grayscale, narrow/reflow,
  focus, forced-colors, touch, and print smoke; and release-negative checks.
  Two consecutive builds and CI-like builds are byte-identical at SHA-256
  `56729893c923e9ab428d1e96038920c71829d3d07b58f46a01741c6c63cae266`.
- **Residual uncertainty:** this is visual alignment using published palette
  and typography, not a Foundation partnership or endorsement. The existing
  v1 source-parity and uncertainty release blockers remain unaffected.

### 2026-07-22 -- deployment artifact identity repair

- **Objective:** restore GitHub Actions artifact determinism after the font
  license and provenance files were normalized for the committed whitespace
  check after the previous artifact had already been generated.
- **Result:** rebuild from the committed source produces build identity
  `source-7012bcfc025d884e` and SHA-256
  `04114285058e3b1a56c1514ee32d048edc1be66834143da051b251d4effb5d07`.
  This exactly matches the failed CI rebuild, confirming the mismatch was the
  stale embedded identity rather than platform-specific output.
- **Scope and scientific discriminator:** generated `dist/index.html` and its
  recorded hash only; no model, presentation, schema, export, or decision-rule
  behavior changed.
- **Verification:** local `npm run verify` passes, including CI-like
  byte-identical rebuild checks at the recorded hash. CI and Pages deployment
  remain pending this repair commit.

### 2026-07-22 -- narrow-layout deployment repair

- **Objective:** remove the 360 px Chromium horizontal-overflow failure found
  after the artifact identity repair.
- **Implementation:** narrow grid and flex children may shrink under the
  bundled Noto metrics; chart slots clip only horizontal SVG paint at phone
  widths; and existing long status/footer text can break anywhere. Browser
  smoke now reports uncontained element bounds if an overflow recurs.
- **Scientific discriminator:** CSS and browser-test diagnostics only; no
  scientific state, chart value, decision classification, data palette, or
  export schema changed.
- **Artifact:** build identity `source-a7a8914be4306e31`; SHA-256
  `59bf5dd77c3c7b297ae7b7db268586c22cd17965fd1cb365d4d211a294187558`.
- **Verification:** `npm run verify` passes: typecheck, 49 tests, fixture,
  calibration, performance, cache-memory, build, artifact/browser smoke, and
  release-negative CI-like deterministic rebuild checks. CI and Pages remain
  pending this repair commit.

### 2026-07-22 -- cross-platform narrow-layout smoke repair

- **Objective:** resolve the remaining GitHub Linux Chromium false-positive
  narrow-layout failure after it reported `scrollWidth: 361` for a 360 px
  viewport with no uncontained element.
- **Implementation:** browser smoke now records both the root scroll range and
  uncontained non-SVG element bounds. It permits only a one-CSS-pixel platform
  rounding difference, while failing a greater scroll range; SVG descendant
  coordinates remain diagnostic-only because they use their viewBox space.
- **Scientific discriminator:** test instrumentation only; no model,
  presentation, scientific chart, export, schema, or decision behavior changed.
- **Verification:** `npm run verify` passes: typecheck, 49 tests, fixture,
  calibration, performance, cache-memory, build, artifact/browser smoke, and
  release-negative CI-like deterministic rebuild checks at SHA-256
  `59bf5dd77c3c7b297ae7b7db268586c22cd17965fd1cb365d4d211a294187558`.
  CI and Pages remain pending the repair commit.

### 2026-07-17 -- frontend redesign execution baseline

- **Objective:** execute `docs/frontend-redesign-implementation-tasks.md`
  against Design Contract 1.7, preserving the pure-model and scientific
  identity boundaries while replacing the control-first prototype with the
  approved decision narrative.
- **Executor/model version:** Codex direct implementation; no delegation.
- **Starting state:** clean `main` worktree at
  `5465cd83cef6b99275e4c195e670853db26954c1`.
- **Contract sections and source files supplied:** Contract Sections 1--3,
  10--18; `FRONTEND_REDESIGN_PLAN.md`;
  `docs/scientific-web-widget-playbook.md`; the complete model, UI, manifest,
  export, artifact, and browser-test surfaces.
- **Allowed files or worktree:** this repository only; no new biological
  equations, outputs, dependencies, runtime services, or uncertainty claims.
- **Required output and discriminator:** the ordered Tasks 0--8 and their
  numerical, semantic, interaction, accessibility, deterministic-build, and
  release gates.
- **Content-block classification and rationale:** not applicable; direct
  bounded scientific-software implementation.
- **Reframe/retry status:** not applicable at baseline.
- **Result disposition:** accepted. The default decision scope is now the
  UP/Bihar singleton; inspection probes and the fixed 81 x 20 setting-surface
  display domain are independent. The control-first dashboard is replaced by
  the approved decision narrative, linked setting/requirement/product views,
  mechanism and measurement explanations, transactional state, advanced
  scientific controls, and versioned URL/JSON/CSV/SVG reconstruction paths.
- **Primary review:** baseline `npm run verify` passed at starting commit
  `5465cd83cef6b99275e4c195e670853db26954c1`. Baseline desktop and 360 px review
  confirmed the recorded control-wall, peer-card, hard-edge/color, unlabeled
  Matlab segment, and empty-frontier presentation problems. Final desktop,
  tablet, and mobile renders were reviewed directly. The fatal-defect audit
  found none; the playbook quality rubric scored 32/32. The most likely harmful
  over-interpretation--that clearing UP/Bihar guarantees control everywhere--is
  blocked adjacent to the authoritative result and in every standalone SVG.
  Direct decision-scope `R_loc`, not raster color, interpolation, `q_index`, a
  probe, or the nearest grid point, remains authoritative.
- **Verification run:** `npm run verify` passed on 2026-07-17: typecheck; 43/43
  tests; R fixture-generator preflight; seven Section 15.1 artifacts; Section
  15.2 calibration; performance (`1.5/0.5/380.4 ms`
  selected/surface/frontier); cache memory (`17.0 MiB` retained, every cache at
  or below capacity); deterministic build `source-5a5a1c391bdd14c5`; artifact
  integrity; expanded Chromium smoke covering default semantics, probe/scope
  identity, fixed comparators, linked pointer/keyboard/touch inspection,
  transactional stale/invalid state, empty frontiers, all exports, 360 px,
  200%-equivalent reflow, grayscale, forced colors, print, reduced motion,
  focus, legacy URL rejection, file URL, runtime-request absence, and GitHub
  Pages prefix; and stale-artifact/CI-identity negative checks. CI-like builds
  were byte-identical at artifact SHA-256
  `5e6549eca5ff313897141889f56d1b510e1fdcfec0157389f00663f505427965`.

### 2026-07-21 -- frontend teaching follow-up review fixes

- **Objective:** correct the two remaining frontend review findings without
  changing the computational model: remove copied teaching constants from the
  narrative and retain selected-product semantics in print.
- **Executor/model version:** Codex direct implementation; no delegation.
- **Contract sections and source files supplied:** Sections 13, 14.3, and 16;
  `src/app.ts`, `src/ui/charts.ts`, `src/styles.css`, the parameter and setting
  manifests, and Chromium browser smoke.
- **Allowed files or worktree:** presentation, generated artifact, and
  regression checks only; no equation, product default, setting anchor,
  schedule, success rule, or uncertainty change.
- **Required output and discriminator:** UP/Bihar link values, assay floor,
  and diagnostic horizon render from committed manifest/model state; print
  exposes a read-only selected-product mechanism summary while interactive
  controls remain hidden; browser smoke fails if either invariant regresses.
- **Content-block classification and rationale:** not applicable; direct,
  bounded frontend remediation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted. The teaching transmission strip now
  derives its exposure, contact-frequency, and motif values from the settings
  manifest; assay-floor and horizon prose derive from the parameter manifest
  or committed scenario/diagnostic grid. A print-only, committed-output
  summary preserves hypothetical-product mechanism semantics and describes
  fixed catalog comparators without reopening interactive controls.
- **Primary review:** this closes the data-ownership and print-completeness
  concerns identified in the frontend review. The product summary renders from
  the committed scenario, so it cannot claim values from a stale edit.
- **Verification run:** `npm run typecheck`, `npm test` (46/46), `npm run
  build`, `npm run record:artifact-hash`, and `npm run check:artifact` passed.
  Chromium smoke covers default and changed controls, manifest-derived
  teaching text, print visibility/semantics, exports, responsive layouts,
  touch, and Pages-path loading. Build identity:
  `source-c808604c0fcc038d`; artifact SHA-256:
  `3f71636b2b86e196817b839ad67ca91ba09e5e3f28852f0c6c30386e4849c4de`.
- **Residual uncertainty:** scientific limitations are unchanged. This remains
  a deterministic close-contact point-rule screen, not a complete-population
  `R_e`, universal-control guarantee, or uncertainty-qualified result.

### 2026-07-17 -- filesystem-independent release identity

- **Objective:** repair the GitHub Pages release check without changing model
  or presentation behavior.
- **Result:** the release identity now ignores hidden filesystem residue under
  `src/`. A local ignored `src/.DS_Store` had contaminated the source digest,
  so a clean CI checkout produced a different build identity and correctly
  rejected the committed artifact.
- **Regression check:** the release-negative check creates a temporary hidden
  source file and verifies that it cannot change the deterministic identity.
- **Verification:** `npm run verify` passes, including 43/43 tests, source and
  calibration artifacts, performance and cache limits, Chromium narrative
  smoke, artifact integrity, and byte-identical CI-like rebuilds. The final
  build identity is `source-5a5a1c391bdd14c5`; artifact SHA-256 is
  `5e6549eca5ff313897141889f56d1b510e1fdcfec0157389f00663f505427965`.
- **Residual uncertainty:** the scientific limitations are unchanged: the
  result is a direct point rule for the declared close-contact motif under the
  v1 sufficiency axiom, not complete-population `R_e`, a universal-setting or
  clinical-performance guarantee, or a probability of threshold crossing.
  Parameter uncertainty remains unavailable. Firefox and WebKit are
  recommended but are not v1 release blockers and were not run. One-dimensional
  parameter slices remain deliberately deferred pending evidence that the
  measurement map is insufficient.

### 2026-07-17 -- backend review completion

- **Objective:** complete every handoff item in `BACKEND_REVIEW_PARTIAL.md`,
  convert the partial review into a final backend disposition, and leave the
  implementation, generated artifact, commit history, and remote branch
  synchronized.
- **Executor/model version:** Codex direct implementation; no delegation.
- **Contract sections and source files supplied:** Contract 1.7 Sections 4,
  7--11, 14--17; the complete backend/model surface; pinned India and Cessation
  sources; source fixtures and calibration report; build, artifact, browser,
  performance, and CI scripts.
- **Allowed files or worktree:** this repository; pinned source repositories
  read-only; no expansion into wet-lab, vaccine-virus, evolutionary, campaign,
  geographic, or complete-population modeling.
- **Required output and discriminator:** close every P1--P3 finding; audit all
  calibration and fixture inputs; add strict manifest/output schemas and
  collision-resistant identities; bound browser-lifetime caches without
  violating fixed performance targets; prove deterministic stale-resistant
  builds; pass the complete repository verification chain.
- **Content-block classification and rationale:** not applicable; defensive
  scientific-software review and direct implementation.
- **Reframe/retry status:** not applicable. The first full verification exposed
  cache-thrashing in the setting surface (`1132.9 ms` against a `300 ms`
  target). The implementation was revised to retain at most four small,
  content-keyed surface-value arrays rather than increasing the large tensor
  cache.
- **Result disposition:** accepted. All original findings and all eight handoff
  tasks are resolved in commits `0a85b7c` and `8595482`; the review document now
  records final scope, resolution, verification, and residual limitations.
- **Primary review:** every fixture input family was traced to source,
  contract/grid input, or explicit diagnostic status. Calibration uses strict
  full-input/full-output validation, deterministic grids/tie rules, and a
  visible near-optimal-region diagnostic rather than posterior language.
  Production/source conflicts remain explicit and production follows the
  locked contract. Output provenance, probabilities, nonnegative quantities,
  grid dimensions, comparator count, and source commits fail closed.
- **Verification run:** final `npm run verify` passed: typecheck; 36/36 tests;
  R provenance preflight; seven Section 15.1 artifact checks; Section 15.2
  calibration; performance (`1.6/0.7/410.7 ms` selected/surface/frontier);
  memory (`17.0 MiB` retained after twelve distinct envelopes, every cache at
  or below capacity); deterministic build `source-434c9bfdda3bc11a`; artifact
  and Chromium/path-prefix smoke; stale-artifact and CI-identity negative
  tests. Artifact SHA-256 is
  `a427fedcfde8b1bb658d63e081ce16ba325891e51da3567aeb0891377fab9ea8`.
- **Residual uncertainty:** this is a completed backend review, not an overall
  application-release decision. Parameter uncertainty/upper-95 remains
  unavailable by scope and fails closed. The separate visualization and
  science-communication review remains deferred.

### 2026-07-17 -- backend review remediation checkpoint

- **Objective:** resolve the confirmed backend contract mismatches and preserve
  a coherent checkpoint before completing release/schema hardening.
- **Executor/model version:** Codex direct implementation; no delegation.
- **Contract sections and source files supplied:** Sections 4, 7.1--7.3, 7.6,
  9.4, 10.3, 11.4, 14.3--14.5, 15.1--15.3, 15.6, and 16; the pinned India and
  Cessation sources and all backend/model files named in
  `BACKEND_REVIEW_PARTIAL.md`.
- **Allowed files or worktree:** this repository; pinned source repositories
  read-only.
- **Required output and discriminator:** exact contracted dose response and
  shedding constants; approved `take=1, mu0=6` default; exact off-grid selected
  design; independent per-infection horizon passing the doubled-horizon gate;
  bounded content-keyed caches; fail-closed bins; owned model outputs; linked
  and unlinked envelopes; regenerated fixtures/calibration; focused tests.
- **Content-block classification and rationale:** not applicable; defensive
  scientific-software review and direct implementation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted as an intermediate checkpoint; release and
  remaining schema/pipeline review continue in the same task.
- **Primary review:** followed the locked contract where India source behavior
  conflicts: the source low-dose branch and rounded shedding constants remain
  explicit diagnostic fixtures. A 100-day independent-link horizon failed the
  low-anchor tail criterion (`1.83e-4`); 120 days passes for hypothetical,
  Sabin-2, and IPV at every named anchor. Cross-path explicit link composition
  agrees with direct `R_loc` within `1e-12`.
- **Verification run:** TypeScript typecheck; 33/33 model tests; reference
  fixture check; regenerated and checked Section 15.2 calibration report.
- **Residual uncertainty:** full runtime output-schema validation, memory
  process discriminator, deterministic artifact/hash/CI negative gates, and
  the final review disposition remained to be completed at this checkpoint;
  the completion entry above supersedes this intermediate residual.

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

### 2026-07-21 -- teaching-first frontend and deterministic within-host diagnostics

- **Objective:** implement the approved Contract 1.8 teaching-first frontend:
  show how a schedule produces a full cohort distribution; how a WPV challenge
  produces acquisition and, conditional on acquisition, shedding; then how the
  close-contact motif yields the authoritative direct `R_loc` result.
- **Executor/model version:** Codex direct implementation; no delegation.
- **Contract sections and source files supplied:** Contract 1.8 Sections 1--3,
  6--7, 9, 11, 13, 14.3--14.5, 15.3, 15.6, 17, and 18;
  `docs/frontend-teaching-first-implementation-tasks.md`; model kernels,
  serialization, manifests, UI, exports, and browser smoke.
- **Allowed files or worktree:** this repository only; no new dependency,
  biological equation, endpoint, uncertainty claim, free-form parameter lab,
  or population-spread model.
- **Required output and discriminator:** strict diagnostic-grid/output schemas;
  exact agreement between diagnostic ratios and production metrics; no direct
  pass/fail verdict in the DOM before the transmission lesson; retained
  atomic/stale behavior; responsive accessible figures; and versioned exports.
- **Content-block classification and rationale:** not applicable; direct,
  bounded scientific-software implementation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted.
  `WithinHostDiagnosticsV1` is built from the existing schedule,
  dose-response, breakthrough-conditioning, and joint shedding kernels on the
  committed 41-dose CID50 / 1--120 day grid. Its `q_acq`, `q_shed`, and
  `q_index` agree with production point metrics within the locked numerical
  tolerance. It does not feed back into `R_loc`, frontiers, or scenario state.
  The application now orders its explanation as within-host exposure;
  received-dose/take/boost/waning/schedule distribution; index-household-social
  motif; direct UP/Bihar decision and setting surface; measurement handshake;
  and linked outcome/product maps.
- **Primary review:** desktop and 360 px render inspection confirmed that the
  four teaching panels switch to an independently legible vertical layout on
  narrow screens, while the desktop figure remains a connected two-by-two
  comparison. The blue-white-red setting figure remains centered at `R_loc =
  1`; its caption now names the dashed display-only threshold path so it cannot
  be mistaken for an extra decision rule. The calculation remains
  distribution-native: the displayed marginal immunity distribution is
  explicitly not substituted for an average child.
- **Verification run:** `npm run verify` passed: typecheck; 44/44 model tests;
  fixture-generator preflight; seven Section 15.1 artifacts; calibration;
  performance (`1.6/0.5/411.5 ms` selected/surface/frontier); cache-memory
  bound (`17.0 MiB` retained); deterministic build; artifact/browser smoke;
  and stale-artifact/CI-identity negative checks. The desktop and 360 px
  artifact were visually reviewed directly. Two fresh builds were byte
  identical; final build identity is `source-c4790b295b868670` and artifact
  SHA-256 is
  `cd6534a452f4678dd6780fe8343a024d9bd03c52b29c1dcbbd31e8ca585a103b`.
- **Residual uncertainty:** unchanged scientific limits: the direct point rule
  is a close-contact sufficiency screen under the v1 axiom, not complete
  population `R_e`, a universal guarantee, clinical-performance evidence, or a
  threshold-crossing probability. The teaching diagnostics are model
  projections, not measurements.

### 2026-07-21 -- teaching-first contract-completion hardening

- **Objective:** close the Contract 1.8 gaps found in post-implementation
  review without changing WPV, vaccine, shedding, transmission, calibration,
  comparator, or decision equations.
- **Executor/model version:** Codex direct implementation; no delegation.
- **Contract sections and source files supplied:** Sections 13.1--13.9,
  14.3, 15.6, and 17; the diagnostic model/schema, narrative UI, standalone
  SVG export, model tests, and Chromium smoke.
- **Allowed files or worktree:** this repository only; read-only diagnostic
  projections and presentation/export/test changes only.
- **Required output and discriminator:** one-WPV-HID50 marker; age and assay
  floor; conditional burden and absolute reference-dose shedding index;
  point-of-use product controls; explicit UP/Bihar transmission handshake and
  complete measurement map; fail-closed diagnostic metadata/grid validation;
  identical browser/Node diagnostic serialization; and self-contained SVG
  diagnostics.
- **Content-block classification and rationale:** not applicable; direct,
  bounded scientific-software implementation.
- **Reframe/retry status:** not applicable.
- **Result disposition:** accepted. The teaching grids remain read-only model
  projections. They now carry source and diagnostic schema versions, parameter
  manifest version, model identity, explicit units and conditioning, and an
  absolute reference-dose index. Grid coordinates, reference challenge, age,
  and identity fail closed when stale or mismatched. A 15-significant-digit
  diagnostic serialization boundary removes cross-runtime one-ULP libm drift;
  it does not alter any kernel, metric, calibration, or displayed precision.
- **Primary review:** desktop, 360 px, and standalone SVG renders were checked
  directly. The first viewport identifies the UP/Bihar teaching setting and
  current reference-to-vaccinated comparison without a verdict. The central
  figure marks one WPV HID50, names each conditioning statement, states age and
  assay floor, and separates conditional `q_shed` from the absolute
  `P(acquisition | d) * B` index and its relative `q_index`. The transmission
  section gives source-to-dose-to-recipient-to-cumulative-escape semantics and
  declared UP/Bihar units/bases before the direct result. Standalone SVGs carry
  the full within-host diagnostic payload and the required teaching styles.
- **Verification run:** `npm run verify` passed: 46/46 model tests; source
  fixture preflight; reference-fixture and calibration gates; performance
  (`1.7/0.5/416.4 ms` selected/surface/frontier); cache bound (`17.0 MiB`);
  deterministic build; expanded Chromium smoke including exact browser/Node
  diagnostic export equality; artifact integrity; and CI-like rebuild negative
  checks. Final build identity `source-f7a3509765187ea7`; artifact SHA-256
  `c72ebb3f3bfaaf372fbc5722834fb66214e1405b773bb6b8f7004d4de892c7a2`.
- **Residual uncertainty:** unchanged scientific limits: this remains a
  deterministic close-contact sufficiency screen under the v1 axiom, not a
  complete-population `R_e`, universal-control guarantee, clinical endpoint,
  or threshold-crossing probability. Firefox and WebKit remain recommended,
  rather than required, pre-release checks.

### 2026-07-17 -- hybrid-equivalence amendment, direct-port expansion, and Pages enablement

- **Objective:** complete the approved Section 15.1 direct-port increment,
  amend the release evidence boundary without relabeling Cessation scalar-titer
  context as Sabin/IPV product parity, defer parameter uncertainty/upper-95,
  and determine whether the static artifact can deploy on GitHub Pages.
- **Executor/model version:** Codex direct implementation.
- **Contract sections and source files supplied:** Sections 11.5, 12,
  14.1--14.5, 15.1--15.3, 16, and 17; pinned India R kernel files and pinned
  Cessation Matlab motif; the source audit; fixture generator; calibration
  report generator; model/UI/schema tests; GitHub Pages workflow.
- **Allowed files or worktree:** this repository; pinned sources read-only; no
  changes to source equations, calibration targets, source commits, product
  catalog semantics, or population-level endpoint claims.
- **Required output and discriminator:** regenerated source fixtures with
  explicit grid metadata and tests that execute every direct port; Contract
  1.5 records that these grids plus the passing Section 15.2 prevalence
  calibration are the best available hybrid-equivalence check. No Cessation
  scalar `R_loc` value is treated as a product-schedule source outcome. The
  parameter-uncertainty manifest is explicit scope metadata and no `upper95`
  scenario is accepted. Pages must be confirmed as a static-compatible Actions
  deployment, rather than redesigned as a server application.
- **Content-block classification and rationale:** not applicable; direct,
  bounded implementation and source review.
- **Reframe/retry status:** the first expanded schedule-fixture generation
  exposed a stale `params` reference outside the per-vaccine loop. It was
  corrected to use the declared default schedule parameters, then all fixtures
  were regenerated rather than retaining stale outputs.
- **Result disposition:** accepted. The
  fixture grids now cover 900 systematic susceptibility cells plus edge cases,
  81 take/no-take cases, 10 boost transitions, 36 schedule cases, and 576
  shedding cases. The manifest reports both Section 15.1 and 15.2 gates true
  and no remaining required coverage. Individual source artifacts remain
  non-release records by design.
- **Primary review:** Section 15.2 is a prevalence equivalence discriminator,
  not `R_loc` product parity; its use under the amendment does not blur that
  distinction. The upper-95 removal reduces the result to the declared point
  rule rather than promoting unqualified historical arrays to posterior draws.
  GitHub Pages is technically compatible: the build produces one static
  `dist/index.html` with no runtime API. The prior deploy failure was only a
  repository-level Pages-disabled `404`; the repository now reports
  `build_type: workflow`, public HTTPS deployment, and the intended URL.
- **Verification run:** `npm run typecheck`; `npm test` (24/24); fixture
  generator preflight; `check:reference-fixtures`; `check:calibration`;
  `check:performance` (selected `2.4 ms`, surface `15.1 ms`, frontier
  `897.2 ms`); build; artifact integrity; and Chromium local-file/path-prefix
  smoke all pass. Two successive local builds produce the same SHA-256
  `f6867dc76654370cbaab2a000349b381a81ec43c399e064ff85b17346be3fdf9`.
  The GitHub Pages workflow is verified after the commit is pushed.
- **Residual uncertainty:** this remains a close-contact, point-rule prototype
  result. Under the v1 sufficiency axiom it is conditional-plausibility
  evidence for population-level herd immunity, not a calculated
  complete-population `R_e` or clinical product-performance claim. An original
  source product-schedule `R_loc` comparator is permanently not a requirement;
  a probabilistic ensemble remains a separately scoped decision-theory
  limitation.

### 2026-07-17 -- original-source `R_loc` non-requirement clarification

- **Decision:** Mike confirmed that an original-source product-schedule
  close-contact `R_loc` executable does not exist and will not exist. Contract
  1.6 removes it as a present or future parity requirement rather than
  describing it as a deferred gap.
- **Scope:** no equations, fixtures, calibration targets, source commits, or
  parameter values changed. The direct-port grids and Section 15.2 prevalence
  calibration remain the approved hybrid-equivalence evidence. The prototype
  language now describes the v1 conditional-plausibility premise for
  population-level herd-immunity reasoning.
- **Residual limitation:** the absent probability ensemble remains explicitly
  out of scope. Point results do not quantify the probability of crossing the
  threshold and cannot by themselves support probability-weighted expected-loss
  or risk-sensitive decisions.
- **Verification:** `npm run typecheck`; `npm test` (24/24);
  `check:reference-fixtures`; `check:calibration`; `check:performance`
  (selected `2.1 ms`, surface `18.2 ms`, frontier `896.3 ms`); build; and
  Chromium artifact/path-prefix smoke all pass. Pages deployment is confirmed
  after the clarification commit is pushed.

### 2026-07-17 -- maintainability consolidation after parity hardening

- **Objective:** remove behavior-neutral duplicate constants and schedule state
  transitions without weakening source parity, calibration, or prototype
  limitations.
- **Contract basis:** Sections 5, 8.3, 11.4--11.5, 14.3--14.4, and 15.3.
- **Changes:** one routine-dose constant now drives the scenario and strict
  serializer; one day/year and day/month conversion drives schedule, waning,
  metrics, transmission, and calibration; one grams/micrograms constant drives
  manifest conversion and the UI boundary; one explicit dose-to-assessment
  transition drives both production schedules and calibration schedules; the
  frontier manifest is the sole owner of its threshold/tie convention; named
  setting options derive from the setting manifest.
- **Deliberately retained separation:** the fixed-titer Matlab compatibility
  implementation remains an independent calibration comparator, and direct
  factorized versus precomputed-tensor `R_loc` paths remain distinct for
  point/surface performance versus repeated-grid performance. A focused test
  now requires their agreement.
- **Scientific impact:** none intended. All numerical parameter values,
  source fixtures, calibration inputs, success threshold, and uncertainty
  posture are unchanged.
- **Reviewer:** Codex (primary integrator)
- **Verification:** `npm run verify` passes: typecheck; 25 model tests;
  reference-fixture preflight and coverage; calibration report; performance
  (selected `2.0 ms`, surface `15.1 ms`, frontier `853.4 ms`); self-contained
  build; artifact integrity; and Chromium local-file/path-prefix smoke. The
  rebuilt artifact SHA-256 is
  `566954ee17799cdde12b34dd2548b0a2c3e0a842c2e2c547bd4d1ef93fd1e939`.

### 2026-07-17 -- fixed-comparator transmission and uncertainty-source audit

- **Objective:** determine whether the next Section 15.1 increment can be a
  source-derived fixed-Sabin-2/IPV transmission fixture, then identify whether
  the locked sources contain an admissible reviewed joint uncertainty ensemble.
- **Executor/model version:** Codex direct source audit.
- **Contract sections and source files supplied:** Sections 4.1--4.3, 7.4,
  12.2--12.4, 15.1, and 16; the pinned Cessation
  `primarySecondaryTertiaryDoseModel.m`, `fitHouseholdModel.m`,
  `fitIndia.m`, `fitLouisiana.m`, likelihood functions, and `*Fit.mat`
  records; and the pinned India Grassly episode documentation/configuration
  and grouped-Sobol sweep metadata. The audit report, fixture README,
  uncertainty manifest, and README are the only repository outputs.
- **Allowed files or worktree:** this repository and read-only pinned source
  checkouts. No product parameters, equations, defaults, schedule state,
  source fixtures, calibration artifact, success rule, or numerical result was
  changed.
- **Required output and discriminator:** a written source-role map that either
  identifies an existing source executable with both the catalog product
  schedule and the distribution-native `R_loc` motif, or rejects a fixture
  that would join incompatible source outputs. For uncertainty, distinguish
  an actual jointly fitted/bootstrap ensemble from independent-CI resampling
  and unweighted design sweeps before changing upper-95 availability.
- **Content-block classification and rationale:** not applicable; direct
  bounded source audit.
- **Reframe/retry status:** not applicable.
- **Result disposition:** no transmission fixture and no ensemble were added.
  The appropriate result is an explicit release-input requirement, not a new
  numerical claim.
- **Primary review:** India R supplies bins-native biology and catalog
  schedule semantics, while the Cessation model supplies a scalar-titer
  close-contact `R_loc` motif. Neither source accepts the other model's
  missing state, and the India Grassly/full-model endpoints are expressly not
  the v1 `R_loc`. Converting schedule distributions to scalar titers, or
  labeling the Cessation fixed-titer context as Sabin/IPV transmission parity,
  would violate the contract. Cessation `betaBoot` records are not an
  admissible v1 ensemble because their fit/evaluation path calls the legacy
  independent CI sampler prohibited by Section 12.2; the India candidate is
  an unweighted grouped-Sobol design sweep, not a posterior or bootstrap.
  The absent-manifest provenance was corrected accordingly. See
  `docs/release-blocker-source-audit.md` for the file-level evidence and
  required next input.
- **Verification run:** source commit/status inspection; direct review of the
  Cessation fit, likelihood, sampler, and MAT metadata; direct review of the
  India sweep specification and output metadata; repository text checks; and
  full project verification after the documentation/manifest change.
- **Residual uncertainty:** full Section 15.1 needs either a supplied
  source-level product-schedule transmission target or a contract amendment
  approving a separately versioned hybrid reference harness. Upper-95 remains
  unavailable until a reviewer supplies a v1-mappable joint-draw protocol,
  source data, predeclared filters, group composition decision, and quantile
  rule. Neither blocker can be closed by scalarizing distributions, sampling
  marginal intervals, or treating a Sobol design as a posterior.

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
