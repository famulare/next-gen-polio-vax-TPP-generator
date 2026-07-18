# Frontend redesign implementation tasks

**Status:** complete and release-verified on 2026-07-17.

**Decision purpose:** turn the deterministic WPV1 TPP model into an authored
scientific decision narrative for vaccine-development experts. The default
decision asks whether a candidate and schedule place direct `R_loc < 1` at the
UP/Bihar high anchor, the hardest known empirical/model-calibrated stress-test.
The broader setting surface explains the product-specific shape and margin of
that result; it does not silently redefine the decision scope.

**Primary authorities:**

1. `DESIGN_CONTRACT.md` version 1.7, especially Sections 1-3, 10-13, 14.3,
   15.6, 17, and 18;
2. `FRONTEND_REDESIGN_PLAN.md`;
3. committed manifests, pure-model APIs, tests, and artifact checks.

## Execution rules

- Complete tasks in order unless a task explicitly says it can overlap.
- Mark a checkbox only after its listed discriminator passes.
- Keep scientific calculations behind `src/model/`; `src/ui/` may format and
  present results but may not duplicate equations.
- Preserve fixed comparator identity, distribution-native propagation, units,
  threshold/tie behavior, and unavailable-uncertainty semantics.
- A selected setting probe never changes classification implicitly.
- Do not call the setting-surface display domain a global guarantee or decision
  envelope.
- No new framework, dependency, runtime network request, biological model,
  parameter uncertainty, or immunity-distribution output is in scope.
- If an implementation choice would change an equation, biological parameter,
  calibration, success threshold, or the meaning of the UP/Bihar scope, stop
  for a contract amendment.

## Task 0 — establish the baseline

**Purpose:** preserve a reproducible before-state and expose unrelated failures
before frontend changes begin.

- [x] Read the authorities above and `docs/scientific-web-widget-playbook.md`.
- [x] Confirm the worktree is clean and record the starting commit in
  `IMPLEMENTATION_LOG.md`.
- [x] Run `npm run verify` without changing generated output.
- [x] Open the committed artifact at desktop and 360 px widths; record the
  current first viewport, setting surface, empty frontier, console state, and
  keyboard behavior in the implementation log.
- [x] Record the current default outputs as legacy context only:
  `R_loc=0.9201071208363125` at UP/Bihar and the former constructed-envelope
  maximum. Do not turn the latter into the new decision criterion.

**Gate:** baseline verification passes, or any pre-existing failure is named and
separated from redesign work.

## Task 1 — separate decision scope from setting-surface display domain

**Purpose:** make UP/Bihar the default binding scope while retaining a broader,
nonbinding surface for interpretation.

### 1.1 Version the manifests and defaults

- [x] Replace the misleading bundled-global-envelope ownership with two named
  objects:
  - default decision scope: degenerate envelope at the committed UP/Bihar
    anchor; and
  - display domain: `T=0.1-2,000 micrograms/exposure`, `N_s=1-20`, with the
    existing source contact frequencies.
- [x] Store the display domain under a semantically explicit manifest field;
  do not retain a field named `envelope` if it no longer controls success.
- [x] Bump every changed manifest/schema version and include it in scientific
  identity hashing.
- [x] Change the default setting probe to UP/Bihar without coupling later probe
  changes to the decision scope.
- [x] Remove `N_s=40` from the runtime display grid and default labels.
- [x] Add an explicit migration or visible rejection for legacy URL state; do
  not silently reinterpret an old `global` state under new semantics.

**Likely files:** `src/data/setting-anchors.json`,
`src/data/frontier-grid.json`, `src/model/types.ts`,
`src/model/manifest-validation.ts`, `src/model/parameters.ts`,
`src/model/model.ts`, `src/model/serialization.ts`.

### 1.2 Preserve direct model authority

- [x] Keep `ScenarioV1.envelope` as the active point or rectangular decision
  scope; represent a named point as a degenerate envelope.
- [x] Make `buildSettingSurface` use the versioned display domain rather than
  the active decision envelope.
- [x] Keep `rLocEnvelopeMax`, frontier classification, and comparator status
  evaluated over the active decision scope.
- [x] Preserve direct evaluation for status; raster and contour interpolation
  remain display-only.
- [x] Ensure selected probes are view/inspection state and cannot mutate the
  decision scope without an explicit scope action.

### 1.3 Add numerical and schema tests

- [x] Assert default direct UP/Bihar `R_loc=0.9201071208363125` within relative
  `1e-10` and selected-design pass status.
- [x] Assert 92 passing product-grid points and eight Pareto points.
- [x] Assert 81 exposure columns, 20 contact rows, 1,620 unique surface cells,
  and no cell with `N_s>20`.
- [x] Assert a custom rectangular decision scope still uses its direct upper
  corner after monotonicity checks.
- [x] Assert changing only the setting probe does not change pass/fail,
  frontier, model identity, or export identity.
- [x] Assert changing decision scope invalidates and recomputes every dependent
  result.
- [x] Cover missing, unknown, stale-version, and unit-mismatched manifest and
  URL inputs.

**Gate:** focused model/schema tests, `npm run typecheck`, and
`npm run check:performance` pass with no equation or `ModelOutputsV1` expansion.

## Task 2 — create the presentation model and transactional state

**Purpose:** centralize meaning before rebuilding layout.

- [x] Create `src/ui/presentation.ts` with typed pass, fail, tie,
  empty-frontier, unavailable-uncertainty, stale, invalid, and failed branches.
- [x] Create explicit scientific, view, release, and transaction state types.
- [x] Centralize labels for candidate, schedule, probe, decision scope,
  criterion, exact-versus-grid identity, and fixed comparators.
- [x] Implement default hardest-known-anchor prose and its adjacent caveat:
  clearing UP/Bihar supports likely adequacy under less demanding modeled
  conditions but does not prove control everywhere.
- [x] Keep the prior committed result visible and marked stale during
  recomputation; disable export until the new state commits atomically.
- [x] Ensure hover/focus/chapter/drawer state does not change scientific or
  export identity.
- [x] Add unit tests that derive every prose branch from model outputs rather
  than duplicating scientific thresholds in UI code.

**Likely files:** new `src/ui/` modules, `src/app.ts`, and focused tests.

**Gate:** a text-only test fixture makes the authoritative result, scope,
qualification, diagnostics, and evidence gaps unambiguous.

## Task 3 — build the narrative shell and visual system

**Purpose:** replace the control wall and dashboard-card monoculture with an
authored sequence.

- [x] Implement the chapter order from the redesign plan:
  1. hardest-known-anchor result and setting surface;
  2. close-contact motif;
  3. linked requirement/product maps;
  4. mechanistic reading sequence;
  5. measurement/provenance map;
  6. assumptions, sources, and export.
- [x] Put the result and sufficiency qualification before advanced controls.
- [x] Replace six peer metric cards with one authoritative result and a
  subordinate acquisition/shedding/index reading sequence.
- [x] Implement the paper/ink typography, restrained russet accent, and single
  blue-white-red analytical scale without external fonts or assets.
- [x] Remove unnecessary hard edges, shadows, color roles, and rounded-card
  nesting.
- [x] Add semantic landmarks, skip navigation, coherent headings, and a
  responsive 360 px composition.
- [x] Keep primary controls compact: product, schedule, assessment, probe, and
  explicit decision scope.

**Likely files:** `src/app.ts`, `src/styles.css`, and new `src/ui/` renderers.

**Gate:** a reviewer can identify the selected product, UP/Bihar decision
scope, direct result, and qualification within five seconds without reading a
plot.

## Task 4 — rebuild the setting surface

**Purpose:** show where the candidate crosses the criterion and the
product-specific margin around the binding anchor.

- [x] Render the fixed `log10(R_loc)` domain `[-2,2]` using blue `#2166ac` ->
  near-white `#f7f7f2` at `R_loc=1` -> red `#b2182b`.
- [x] Remove raster-cell strokes and prevent contours from tracing the plot
  frame as a scientific threshold.
- [x] Add a non-color pass/fail cue, direction-of-pressure label, exact
  readout, and accessible text alternative.
- [x] Mark UP/Bihar as the default decision anchor, not merely another point.
- [x] Show any selected custom decision scope independently from the fixed
  display-domain boundary.
- [x] Rework anchor labels with collision handling.
- [x] Label the Matlab segment as the 3.2-61.7 micrograms/day household
  interval, daily basis, hybrid mapping, with inherited social link.
- [x] State in screen and SVG export that status is direct over the decision
  scope while the contour is interpolated display context.

**Gate:** color-removed review still identifies the threshold, controlling
anchor/scope, passing side, and Matlab annotation correctly.

## Task 5 — rebuild and link the requirement and product maps

**Purpose:** teach the distinction between required outcomes and actionable
product assumptions.

- [x] Introduce acquisition blocking and breakthrough infectious-shedding
  reduction before showing effect space.
- [x] Introduce biological take context and latent mean mucosal boost before
  showing product space.
- [x] Render the same 2,601 direct evaluations in both coordinate systems.
- [x] Show the default 92 passing points and eight-point Pareto boundary; draw
  no Pareto line when `frontier.pareto` is empty under another scope.
- [x] Replace dense open-circle/hatch noise with a quiet evaluated field,
  threshold contour, selection, and comparator marks.
- [x] Link hover, focus, persistent selection, and keyboard traversal across
  both views.
- [x] Keep the selected exact design distinct from its nearest grid point.
- [x] Keep Sabin 2 fixed and omit IPV from undefined take/boost coordinates.
- [x] Make “Use this design” the only action that promotes a view selection to
  scientific scenario state.

**Gate:** both maps and their exports agree on selection and pass/fail, remain
legible in grayscale, and expose an explicit empty-frontier state.

## Task 6 — add mechanism and measurement explanation

**Purpose:** give vaccine developers a usable mental model without creating a
new biological output.

- [x] Add the index -> household member -> close-social-contact motif and state
  why `R_loc` is not complete-population `R_e`.
- [x] Present `q_acq`, `q_shed`, `q_index`, and direct `R_loc` in causal-reading
  order while keeping `q_index` visibly diagnostic.
- [x] Build the measurement/provenance map specified in the redesign plan.
- [x] Label each quantity as scenario input, product property,
  calibrated/inherited, fixed v1 assumption, derived, or evidence gap.
- [x] Explicitly distinguish take from receipt/coverage and latent
  OPV-equivalent mucosal immunity from measured serum titer.
- [x] Defer one-dimensional slices unless usability review still finds take,
  boost, exposure, or contacts unintelligible.

**Gate:** a vaccine-development reviewer can explain the modeled handshake from
product assumptions through acquisition and shedding to the decision result.

## Task 7 — complete controls, URL state, and exports

- [x] Make probe and decision-scope controls visually and semantically
  independent.
- [x] Support UP/Bihar default, other named singleton scopes, and explicit
  custom rectangular scopes.
- [x] Move alpha, beta, dose, exposure/contact details, and scope bounds into
  scientifically grouped advanced controls.
- [x] Present fixed values as assumptions, not disabled form fields.
- [x] Preserve fail-closed validation and visible invalid/stale URL handling.
- [x] Ensure canonical URL, JSON, CSV, SVG, visible state, and model identity
  agree after every scientific change.
- [x] Make each SVG standalone with product, schedule, decision scope,
  criterion, qualification, legend, selected state, and interpolation note.
- [x] Add visible Share and export success/failure feedback.

**Gate:** round-trip and cache-invalidation tests pass for every scientific
control and named/custom decision scope.

## Task 8 — accessibility, browser, and release verification

- [x] Test keyboard-only operation, focus order, focus visibility, Escape
  behavior, and plot traversal.
- [x] Test equivalent hover, focus, and touch readouts.
- [x] Add concise live announcements for committed result changes.
- [x] Test desktop, tablet, 360 px, 200% zoom, reduced motion, grayscale, high
  contrast, print, file URL, and GitHub Pages prefix behavior.
- [x] Confirm no runtime request, external asset, console error, or random
  sampling.
- [x] Update browser-smoke assertions for the new opening result, 20-row
  surface, scope controls, linked selection, and empty-frontier branch.
- [x] Update README screenshots/text, provenance, `IMPLEMENTATION_LOG.md`,
  manifests, and committed `dist/index.html`.
- [x] Run focused checks after each task, then final `npm run verify`.
- [x] Rebuild twice and confirm no committed artifact diff.
- [x] Perform the redesign plan's fatal-defect and quality-rubric audit.

**Release gate:** every Definition-of-Done item in Contract Section 17 passes;
no unreviewed output, stale identity, unsupported guarantee, or unresolved
accessibility blocker remains.

## Completion audit

### Fatal-defect review

No fatal defect from `docs/scientific-web-widget-playbook.md` Section 15 was
found in the release candidate. Scientific calculations remain in `src/model/`;
visible and exported committed state agree; invalid state fails closed; the
UP/Bihar inference is qualified adjacent to the result; direct `R_loc` remains
authoritative; fixed comparators do not inherit hypothetical controls;
uncertainty remains explicitly unavailable; pass/fail has text and shape cues;
the workflow is keyboard-operable; URL state restores or rejects visibly; the
artifact makes no runtime request; and CI-like rebuilds are byte-identical.

### Quality rubric

| Dimension | Score / 4 | Evidence |
|---|---:|---|
| Decision clarity | 4 | Opening question, direct answer, criterion, scope, and caveat precede controls and plots. |
| Scientific fidelity | 4 | Typed presentation derives from model outputs; scope/probe/display domain, units, fixed comparators, and unavailable uncertainty are tested. |
| Interpretive honesty | 4 | Hardest-known-anchor inference, motif qualification, non-`R_e` boundary, and evidence gap are adjacent to claims. |
| Visual hierarchy | 4 | One authoritative result and dominant setting surface replace peer cards; paper/ink roles and one analytical scale are consistent. |
| Interaction coherence | 4 | One committed scientific state drives all surfaces; inspection is linked but view-only until explicit promotion. |
| Accessibility | 4 | Text alternatives, non-color cues, focus, keyboard traversal, touch, 360 px, reduced motion, forced colors, and print pass browser smoke. |
| Reproducibility | 4 | Canonical URL and versioned JSON/CSV/SVG carry scenario, scope, identities, and build context; artifact hash is recorded. |
| Technical restraint | 4 | Existing TypeScript/Node stack, pure model boundary, no new dependency, one offline HTML artifact. |

**Total:** 32/32, with no fatal defect.

### Required review answers

1. **Most likely over-interpretation:** clearing UP/Bihar guarantees control in
   every present-day population. **Prevention:** the opening result immediately
   calls it the hardest known modeled anchor, states that the inference is
   supportive rather than universal, and distinguishes `R_loc` from complete-
   population `R_e`.
2. **Authoritative threshold object:** the direct maximum over the declared
   decision scope. Raster colors, interpolated contours, probes, `q_index`, and
   nearest grid points are display or diagnostic objects only.
3. **Included uncertainty:** deterministic variation over explicit scenarios,
   decision scopes, and evaluated grids. **Excluded:** a joint parameter
   ensemble, posterior interval, threshold-crossing probability, and upper-95
   decision rule.
4. **Scientific controls:** product, schedule, assessment, product properties,
   dose response, and decision scope. **View controls:** inspection probe,
   hover/focus/touch position, held design, chapter position, and advanced-
   control disclosure. “Use this design” is the explicit bridge.
5. **Reconstruction:** the canonical URL restores the scientific scenario;
   JSON carries full outputs and view selection; CSV carries evaluated grids;
   each SVG carries scope, result, qualification, selection, schema, model, and
   build identity.
6. **Narrow/zoom/keyboard failure point:** long unbroken share fallback URLs
   initially caused 360 px overflow. `overflow-wrap: anywhere` fixed it, and the
   expanded smoke now guards 360 px and 200%-equivalent reflow. No remaining
   blocker was found.
7. **Complexity deliberately omitted:** no framework, server, runtime network,
   animation system, new biological output, parameter laboratory, one-
   dimensional slices, or invented uncertainty layer was added.

### Release verification

`npm run verify` passed on 2026-07-17: 43/43 tests; R fixture-generator
preflight; seven Section 15.1 artifacts; Section 15.2 calibration; performance
(`1.5/0.5/380.4 ms` selected/surface/frontier); cache memory (`17.0 MiB`
retained, all capacities respected); deterministic build
`source-5a5a1c391bdd14c5`; expanded Chromium narrative smoke; artifact and
release-negative checks. CI-like builds were byte-identical at SHA-256
`5e6549eca5ff313897141889f56d1b510e1fdcfec0157389f00663f505427965`.

## Suggested commit checkpoints

1. `Separate decision scope from surface domain`
2. `Add frontend presentation state`
3. `Build narrative frontend shell`
4. `Rebuild setting surface`
5. `Link requirement and product maps`
6. `Add mechanism and measurement guide`
7. `Complete frontend accessibility and exports`
8. `Verify redesigned release artifact`

Do not combine a scientific/default change with broad styling in the same
checkpoint. Each commit should leave its focused tests passing and record any
temporary visual incompleteness truthfully.
