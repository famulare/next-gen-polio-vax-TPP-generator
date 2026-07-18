# Front-end redesign plan

**Status:** implemented and release-verified on 2026-07-17. The implementation
record and residual limitations are in `IMPLEMENTATION_LOG.md`; the executable
checklist is complete in `docs/frontend-redesign-implementation-tasks.md`.

**Decision purpose:** redesign the completed deterministic backend as a
scientific decision narrative for people well versed in vaccine development who
do not yet have a clean mechanistic mental model analogous to the mathematical
model. The artifact should help them reason about when an OPV-like vaccine can
block the modeled close-contact transmission motif, what product performance
would be sufficient, why, and where that conclusion holds.

**Canonical scientific authority:** `DESIGN_CONTRACT.md` version 1.7. This plan
does not change model equations, units, comparators, the point `R_loc < 1`
criterion, or uncertainty semantics. Mike approved setting-surface-first visual
order, the stated vaccine-development audience, and a core measurement map with
parameter slices deferred pending review. He subsequently set the UP/Bihar high
anchor as the default decision scope and capped the nonbinding setting-surface
exploration domain at 20 close social contacts. Those two changes require a
bounded default/manifest amendment, but no biological-model or
`ModelOutputsV1` expansion.

## 1. Evidence used for this plan

The plan is based on direct review of:

- `DESIGN_CONTRACT.md`, especially Sections 1-3, 5-7, 10-13, 14.3-14.5,
  16-18;
- `docs/scientific-web-widget-playbook.md`;
- the current `src/app.ts`, `src/styles.css`, build, export, and browser-smoke
  implementation;
- the rendered default app at 1280 x 720, including each figure and the lower
  assumptions/export sections;
- the two local reference artifacts named by the playbook:
  - the editorial evidentiary exhibit, for authored progression and hierarchy;
  - the Fermi Atlas, for a dominant analytical field, linked state, and a
    persistent inspector;
- direct evaluation of the default product, comparators, anchors, schedules,
  and frontier grid through the pure model API.

## 2. What the current presentation gets wrong

### 2.1 It begins with mechanism-free controls

The first result begins about one viewport below a six-control form. A user is
asked to manipulate `take_context` and `mu0` before the page has explained the
decision, transmission motif, measurement meaning, or why those two properties
matter.

### 2.2 It hides the strongest default story

For the current default hypothetical product and schedule, direct model output
is:

| Scope | `R_loc` |
|---|---:|
| Low anchor | 0.000096 |
| Houston/Louisiana anchor | 0.00440 |
| Matlab hybrid anchor | 0.00589 |
| UP/Bihar anchor | 0.920 |
| Current app's former full-envelope maximum | 12.12 |

The candidate is below the criterion at the modeled UP/Bihar high-transmission
anchor. That anchor represents 2003-2008 conditions in one of the hardest known
settings in which polio was eliminated; it is the approved default empirical
stress-test, not a mathematical upper bound on every setting on Earth. The old
global-envelope corner is a constructed extrapolation and should not override
that decision story.

The natural opening is therefore: **does this candidate clear the hardest known
anchor, and what does the shape of its `R_loc = 1` boundary say about margin
beyond that anchor?** The current app instead turns the extrapolative rectangle
into a failure banner and hides the empirical result.

### 2.3 The current frontier views answer the wrong default scope

No point in the 51 x 51 hypothetical-product grid passes the old full-envelope
scope under the default dose-response and schedule. Therefore the current app
shows:

- the product map is a fully hatched rectangle;
- the effect-space map contains no passing points;
- the Pareto array is empty; and
- there is no minimum-sufficient Pareto frontier to draw.

That is a valid result for that constructed scope, but it is not the approved
default TPP question. When the UP/Bihar anchor is represented as the singleton
decision scope, the same direct grid has 92 passing designs and an eight-point
Pareto boundary; the selected default design passes at `R_loc = 0.920`. The
redesign must make that meaningful frontier the default while retaining honest
empty-frontier behavior for any selected custom scope with no passing designs.

### 2.4 The hierarchy is dashboard-shaped rather than argument-shaped

- Six large metric cards compete with the authoritative `R_loc_max` result.
- Nearly every section is a rounded white card with a border and shadow.
- Blue, green, red, orange, yellow, and peach all carry overlapping roles.
- The plots are enclosed as peer tiles even when one contains the decisive
  result and another contains no frontier.
- Assumptions and uncertainty form a caveat cemetery near the bottom rather
  than qualifying the claim at the point of use.

### 2.5 Figure semantics are not legible enough

- The effect-space plot does not first teach acquisition blocking versus
  breakthrough shedding reduction, or that its coordinates are outcomes rather
  than independently tunable inputs.
- The product-space plot does not explain how take and mean boost map into
  measurable or latent quantities.
- Dense open circles and hatching create moire rather than analytical depth.
- The setting surface draws every raster cell boundary, reducing the threshold
  and anchors to background detail.
- The threshold polygon traces portions of the plot frame where the failing
  region reaches the raster boundary; only the internal threshold crossing
  should receive the strong contour treatment.
- The bottom-middle segment is the Matlab 3.2-61.7 micrograms/day exposure
  interval. It is currently unlabeled in place, overlaps Houston and the Matlab
  marker, and can be mistaken for model output. The Matlab point is a hybrid
  mapping, not an ordinary linked-exposure anchor.

### 2.6 The implementation does not yet meet the interaction contract

- Hover and persistent selection are not linked across the two primary maps.
- Exact figure values are available through thousands of SVG `<title>` nodes,
  not a coherent hover/focus inspector.
- The figures do not provide equivalent keyboard interaction.
- The selected-setting probe and decision scope are conceptually
  distinct in the model but visually conflated in the controls.
- Pending recomputation removes every result and figure. A better transaction
  keeps the prior state visibly marked as stale while the new state computes,
  disables export, and atomically commits all dependent surfaces.

## 3. Recommended artifact contract

### 3.1 Primary question

> Does this candidate and schedule place `R_loc` below 1 at the hardest known
> modeled anchor, and what vaccine performance is sufficient there?

### 3.2 Authoritative result

The direct maximum `R_loc` over the declared decision scope, compared with the
sole point rule. The versioned default scope is the singleton UP/Bihar high
anchor, so its maximum is the direct value at that point:

```text
meets criterion := direct R_loc_max < 1
```

Equality within the contract tolerance does not meet the criterion. The raster,
interpolated contours, `q_index`, setting probes, and comparator markers do not
override the direct decision-scope result.

### 3.3 Required adjacent qualification

The result applies to the modeled index -> household -> close-social-contact
motif under the v1 close-contact sufficiency axiom. UP/Bihar is used as the
hardest known empirical/model-calibrated stress-test because of the extreme
transmission conditions under which elimination was achieved. Clearing it
supports, but does not prove, likely adequacy in less demanding settings
represented by this mechanism. The result is not a calculated complete-
population `R_e`, an outbreak forecast, a claim about every present-day setting
such as Karachi, a clinical product-performance claim, or a probability of
clearing the threshold. Parameter-uncertainty intervals remain unavailable.

### 3.4 Prohibited interface moves

- Do not turn a named-setting probe into the decision envelope implicitly.
- Do not show a Pareto line when the model returns no Pareto points.
- Do not imply that every effect-space coordinate is biologically reachable.
- Do not imply that `q_acq * q_shed` is the transmission calculation.
- Do not treat `take_context` as receipt, coverage, or a directly observed
  trial endpoint.
- Do not treat OPV-equivalent mucosal immunity as a measured serum titer.
- Do not relabel the unavailable parameter ensemble as uncertainty or
  confidence.
- Do not introduce a new scientific output merely to make a more attractive
  chart.

### 3.5 Audience assumption

The approved primary audience is people well versed in vaccine development who
do not yet have a clean mechanistic mental model analogous to this mathematical
model. Exact values, formulas, provenance, and advanced inputs remain available
on demand, but do not determine the opening-page density.

## 4. Recommended narrative architecture

The page should behave like an authored scientific exhibit with one canonical
interactive state, not like a multipage form application. Anchored chapters and
a persistent/expandable inspector preserve orientation and keep the artifact a
single self-contained HTML file.

### 4.1 Chapter 1: Can this vaccine block close-contact transmission -- and where?

This is the recommended first viewport and dominant visual.

**Opening claim for the versioned default:**

> The default OPV-like candidate clears the modeled UP/Bihar high-transmission
> anchor: direct `R_loc = 0.920`, below the v1 threshold of 1. This is the
> hardest known anchor, not a guarantee about every possible setting.

The claim is followed immediately by the redesigned setting surface and one
sentence distinguishing the binding empirical anchor from the broader,
nonbinding exploration domain. The surface answers two follow-on questions:
under which setting conditions does the selected product cross the threshold,
and what is the product-specific shape and margin of the win?

Primary controls here are limited to:

1. product/candidate;
2. schedule (routine plus optional booster);
3. assessment lag; and
4. decision scope, defaulting to the UP/Bihar high anchor.

Take and boost controls appear contextually beside the later product-design view
or in a compact candidate editor, after their meaning has been introduced.

### 4.2 Chapter 2: What does "block close-contact transmission" mean here?

A compact, mostly typographic motif diagram introduces:

```text
vaccinated index -> household member -> close social contacts
```

It explains that `R_loc` is the expected number of close social contacts
infected along this declared motif, why the threshold is 1 under the v1 axiom,
and why this is not complete-population `R_e`. This is explanatory structure,
not a new model visualization.

### 4.3 Chapter 3: What product performance would be enough?

The two contract-required linked maps remain simultaneously visible here:

1. **Outcome/requirement space:** acquisition reduction versus breakthrough
   infectious-shedding reduction.
2. **Product/design space:** biological take context versus mean mucosal boost.

The chapter begins with two short translations:

- outcome space asks what combination of effects is sufficient;
- product space asks which directly evaluated OPV-like designs produce those
  effects under the fixed dose-response and schedule.

When the Pareto set is empty, both plots remain available for inspection, but a
single explicit empty-frontier statement replaces any implication that an
orange line ought to exist. The user is offered an explicit decision-scope
comparison, not an automatic or suggested relaxation.

### 4.4 Chapter 4: Why does this candidate pass here and fail there?

Replace the six metric cards with a mechanistic reading sequence:

1. **Acquisition after vaccination:** `q_acq`, expressed as remaining risk and
   reduction relative to the naive reference at one WPV HID50.
2. **Shedding after breakthrough:** `q_shed`, expressed as remaining integrated
   infectious shedding conditional on a breakthrough infection.
3. **Derived index diagnostic:** `q_index`, visibly subordinate and explicitly
   not the pass/fail calculation.
4. **Direct transmission result:** `R_loc_max`, visually dominant and shown as
   the full distribution-native motif result.

The diagram must not imply that multiplying the displayed ratios by the naive
`R_loc` reproduces the direct result. The default state's combination of large
index reductions and a comparatively narrow direct margin at the hardest known
anchor is a useful explanation of why the full chain is evaluated. The setting
surface then shows how that margin changes beyond the binding anchor.

### 4.5 Chapter 5: What do the parameters mean in measurements?

Include a lightweight on-demand measurement map in v1; defer a large parameter
laboratory unless user testing shows it is needed.

Organize the map as **quantity -> model role -> how it is obtained or
interpreted -> source/status -> limitation**:

| Quantity | Plain-language role | Measurement/provenance posture |
|---|---|---|
| administered vaccine dose | live vaccine-virus dose offered after receipt | product/scenario input in TCID50/CID50 |
| vaccine `alpha`, `beta` | shape and scale of vaccine-virus take dose-response | product parameters; not WPV infectiousness parameters |
| `take_context` | setting-specific modification of biological take after a received live dose | scenario/model multiplier; not receipt or coverage |
| effective first-dose take | modeled productive infection probability in a naive recipient | derived output; show separately from `take_context` |
| `mu0_new` | maximum mean shift on the latent log2 OPV-equivalent mucosal-immunity scale | model parameter; one log2 unit is one doubling on that latent scale |
| `sigma0_new` | spread of the modeled boost distribution | fixed assumption in v1 |
| `T_ih`, `T_hs` | stool-equivalent amount transferred per modeled exposure | setting quantity/calibration construct, displayed in micrograms/exposure |
| `D_ih`, `D_hs` | exposure opportunities per person-day | calibrated/inherited setting quantity |
| `N_s` | close social contacts reached by the household link | setting/network assumption |
| `q_acq`, `q_shed` | modeled product outcomes | deterministic derived ratios |
| `R_loc` | expected infected close social contacts along the motif | authoritative deterministic derived result |

Each row carries a persistent status label such as Scenario input, Product
property, Calibrated/inherited, Fixed v1 assumption, Derived, or Gap. Tooltips
may add detail but may not carry the only status distinction.

An optional second implementation increment can add four one-dimensional slices
already available from the committed grids:

- `R_loc_max` versus take at the nearest displayed boost grid value;
- `R_loc_max` versus boost at the nearest displayed take grid value;
- `R_loc` versus exposure at the selected contact count; and
- `R_loc` versus contact count at the selected exposure.

These are direct grid slices, not local causal effects. They must name which
other quantities are held fixed and distinguish an exact selected design from
its nearest grid point. They require no new scientific backend output.

### 4.6 Chapter 6: What is assumed, validated, and unavailable?

Use an inspector/drawer plus a readable anchored section with tabs or lenses:

- Result;
- Definitions;
- Assumptions;
- Sources and validation;
- Exact values/export identity.

The adjacent qualification stays beside the result. The inspector provides
depth without forcing all limitations into the opening paragraph. Parameter
uncertainty is shown as **Unavailable in this version**, not as an empty chart.

### 4.7 Carry it away

Share, reset, and export are persistent top-bar actions. Export labels say what
they contain:

- Scenario + outputs (JSON);
- Evaluated product/setting grids (CSV);
- Current figures + decision context (SVG).

Export remains disabled for pending, stale, or invalid state.

## 5. Wide and narrow wireframes

### 5.1 Wide desktop

```text
+------------------------------------------------------------------------+
| Product name | Prototype | Scenario | Reset | Share | Export | Methods |
+------------------------------------------------------------------------+
| UNDER WHAT CONDITIONS CAN A VACCINE BLOCK CLOSE-CONTACT TRANSMISSION?   |
|                                                                         |
| [authoritative result in words]        [direct R_loc max / criterion]   |
| [one adjacent qualification]           [point rule; uncertainty absent] |
|                                                                         |
| [setting-surface visual, dominant 2/3] [short interpretation +          |
|                                         product/schedule/scope           |
|                                         primary controls]               |
+------------------------------------------------------------------------+
| 02 What the model means: index -> household -> social motif             |
+------------------------------------------------------------------------+
| 03 What product is enough?                                              |
| [outcome/requirement map] <linked selection> [product/design map]       |
| [shared selected-design readout and explicit empty-frontier state]      |
+------------------------------------------------------------------------+
| 04 Why? mechanism reading | 05 Measurements | 06 assumptions/sources   |
+------------------------------------------------------------------------+
```

The first viewport should contain the question, status, qualification, at least
the top half of the setting surface, and the compact primary controls. It should
not contain a wall of advanced parameters.

### 5.2 Tablet

```text
question -> result -> qualification
setting surface
compact controls + interpretation
motif
linked maps together, stacked only below their shared explanation
why -> measurements -> assumptions -> export
```

### 5.3 Narrow / 360 CSS pixels

```text
question
scenario identity + prototype status
authoritative result
qualification
primary controls
setting-surface text summary
focused setting chart
motif explanation
requirement-map explanation + focused chart
product-map explanation + focused chart
shared selected-design readout
why
measurements
assumptions/sources
export
```

The narrow layout is a distinct composition. It does not shrink two desktop
plots side by side or require horizontal chart scrolling. The two linked views
remain adjacent in reading/tab order even when stacked.

## 6. Detailed figure specifications

### 6.1 Setting surface: "Where does this product keep `R_loc` below 1?"

**Role:** dominant opening analytical field.

**Encodings:**

- x: linked stool-equivalent exposure in micrograms/exposure, log scale;
- y: number of close social contacts;
- fill: fixed `log10(R_loc)` diverging scale;
- threshold: strong dark contour at `R_loc = 1`;
- criterion-not-met side: restrained hatching or dot texture in addition to
  color;
- selected/named settings: directly labeled shapes with leader lines;
- default UP/Bihar decision anchor: explicit marker and direct readout; and
- selected custom decision scope: outline and direct controlling-point readout
  when applicable.

**Color scale:** fixed across scenarios and exports.

```text
log10(R_loc) <= -2        #2166ac  blue
log10(R_loc) = 0          #f7f7f2  near-white (R_loc = 1)
log10(R_loc) >= 2         #b2182b  red
```

Interpolate blue -> near-white -> red in two pieces, clamp outside the fixed
domain, and label the legend in `R_loc` values (`<=0.01`, `0.1`, `1`, `10`,
`>=100`) rather than only log values. White is reserved for the decision
threshold, not used as a generic panel fill immediately behind the raster.

Do not stroke every raster cell. The grid is directly evaluated but can be
shown as contiguous cells without smoothing. The figure note states that the
status is calculated directly over the selected decision scope, while the
broader surface and contour are contextual display evaluations. The
exploration-domain upper corner never controls status merely because it is
drawn.

The strong contour should include only the internal threshold boundary. It
should not trace the top/right plot frame when the failing polygon touches the
grid boundary.

**Matlab hybrid:**

- use a distinct star or split marker;
- move the 3.2-61.7 micrograms/day interval to a labeled bracket/marginal
  annotation rather than an unexplained line through the data field;
- state in visible text that the trial estimated the index-to-household link,
  while `N_s=3` and the social link are inherited;
- retain the source daily basis and explain the locked `D_ih=1/day` conversion;
- do not visually imply that Matlab is an ordinary point on the linked
  `T_ih=T_hs` surface.

**Accessible summary:** name the current candidate, threshold relation, binding
decision anchor or selected scope, product-specific boundary shape, named
anchors on each side, absence of probability intervals, and CSV source for
exact cells.

### 6.2 Requirement map: "Which combination of effects is sufficient?"

**Role:** outcome-space requirement, not a product control panel.

- x: reduction in WPV acquisition, with a plain-language directional subtitle;
- y: reduction in integrated infectious shedding after breakthrough;
- all directly evaluated designs: quiet neutral points or a restrained reachable
  field, not thousands of high-contrast open rings;
- passing points: shape/fill distinction plus text label;
- Pareto frontier: draw only when `frontier.pareto.length > 0`;
- selected candidate and fixed comparators: direct labels;
- unattained effect space: visually marked so the square is not mistaken for a
  freely tunable product space.

If no designs pass, the plot says so in the figure header and does not invent a
frontier. The explanation identifies the current product bounds and decision
scope.

### 6.3 Product map: "Which OPV-like designs produce enough protection?"

**Role:** actionable mapping from product assumptions to the direct criterion.

- x: biological take context after receipt, 0-1;
- y: maximum mean mucosal boost, 0-8 log2 units;
- fill: preferably the same `R_loc` diverging grammar as the setting surface,
  with a dominant threshold contour and hatch/pattern on the non-passing side;
- selected exact design: accent ring even when it lies between grid points;
- nearest grid point: shown only in the exact-value inspector when relevant;
- Sabin 2: fixed square anchor, never altered by hypothetical controls;
- IPV: not plotted in take/boost space because those coordinates are not defined.

An all-failing surface under an explicitly selected custom scope gets a
declarative header such as "No evaluated design meets this decision scope"
rather than a wall of hatching with no reading instruction.

### 6.4 Linked interaction contract

- Hover/focus in either map identifies the same design in both.
- Click/Enter locks a persistent design selection; Escape restores the current
  scenario's selected product.
- Arrow keys traverse the 51 x 51 grid from a single focusable plot surface;
  thousands of SVG nodes do not enter the tab order.
- One live readout reports take, boost, acquisition reduction, shedding
  reduction, direct `R_loc_max`, criterion status, exact-versus-grid identity,
  and comparator status.
- Hover and keyboard focus expose identical information.
- Selection is view state; it does not mutate the canonical scientific scenario
  unless the user explicitly chooses "Use this design."

## 7. Control architecture

### 7.1 Separate three concepts now conflated

1. **Candidate product/schedule:** the product being evaluated.
2. **Selected setting probe:** a named or custom point used for orientation and
   comparison.
3. **Decision scope:** the point or set over which `R_loc_max` determines the
   status and frontier.

The interface must keep all three named and visible. A named setting can remain
a probe without changing status. The versioned default decision scope is the
UP/Bihar high anchor. A separate explicit action may select another named point
or a custom envelope; labels must identify which one currently controls status.

### 7.2 Primary controls

- Product: hypothetical OPV-like, fixed Sabin 2, fixed IPV.
- Schedule: routine only or routine plus booster.
- Assessment: 28 or 90 days.
- Decision scope: UP/Bihar high by default, another named single-setting scope,
  or a custom envelope.
- Candidate take and boost only when the hypothetical product is active and the
  user reaches the product-design chapter/candidate editor.

### 7.3 Advanced groups

Advanced controls are grouped by scientific role and include a sentence saying
why a user would open them:

- Vaccine take curve: dose, alpha, beta.
- Setting probe: `T_ih`, `T_hs`, `D_ih`, `D_hs`, `N_s`.
- Custom decision-scope bounds and linked/unlinked exposure.
- Reference and fixed v1 conventions: one-HID50 reference, gamma, sigma,
  episode horizon, point rule.

Fixed quantities move to a read-only assumptions table instead of disabled form
inputs. Invalid state fails closed with field-level explanation and no export.

## 8. Visual system

### 8.1 Posture

Use editorial scientific modernism rather than dashboard chrome:

- warm paper background and near-black ink;
- serif for the main question, chapter claims, and interpretive result;
- sans serif for controls, legends, axes, and navigation;
- monospace/tabular figures for exact values and identities;
- one burnt-russet accent for selection/editorial emphasis;
- the blue-white-red scale only for ordered `R_loc` fields;
- status text, shape, contour, and pattern in addition to color.

### 8.2 Composition

- Use type scale, hairline rules, and whitespace before containers.
- Reserve panels for real functional groups: interactive figure, inspector,
  drawer.
- Remove shadows from static analytical sections.
- Use 2-6 px radii on controls and restrained analytical panels; pills only for
  compact status/filter tags.
- Prefer an asymmetric 2/3 + 1/3 first viewport over equal dashboard columns.
- Keep body prose at approximately 17-18 px desktop and 16-17 px narrow.
- Keep rendered axis text at or above 10 px.

### 8.3 Motion

- Use 160-240 ms transitions only to preserve selected-object identity,
  inspector disclosure, and chapter orientation.
- Do not tween scientific values across unevaluated scenarios.
- Honor `prefers-reduced-motion`.
- During recomputation, keep the previous committed result dimmed and explicitly
  labeled stale until the new transaction commits.

## 9. State and presentation architecture

Refactor the current 500-line `src/app.ts` into the contract's intended
ownership boundary without adding a framework or runtime dependency.

Suggested structure:

```text
src/app.ts                         mount only
src/ui/state.ts                    scientific/view/release state transaction
src/ui/present.ts                  tested ModelOutputsV1 -> presentation model
src/ui/copy.ts                     tested semantic result branches
src/ui/shell.ts                    landmarks and chapter structure
src/ui/controls.ts                 canonical scenario adapters and validation UI
src/ui/inspector.ts                definitions/provenance/exact values
src/ui/figures/setting-surface.ts
src/ui/figures/requirement-map.ts
src/ui/figures/product-map.ts
src/ui/figures/motif.ts
src/ui/figures/shared.ts
src/styles.css                     tokenized visual system and responsive modes
```

The presentation adapter owns formatting and semantic labels but no scientific
equations. It receives `ModelOutputsV1`, contract constants, and explicit view
state. It centralizes:

- criterion wording and tie behavior;
- selected-setting probe versus decision-scope wording;
- clear pass/fail/tie/unavailable/invalid/pending prose branches;
- empty-Pareto behavior;
- exact selected design versus nearest grid point;
- color-domain clamping and legend labels;
- source/status classifications for definitions.

### 9.1 State classes

```text
scientific state: ScenarioV1 + committed ModelOutputsV1
view state: selected grid design, hover, chapter, inspector tab, disclosures
release state: app/build/contract/manifest identities
transaction: ready | pending(stale prior result) | invalid | failed
```

View-only changes do not alter URL/export/model identity. Scientific changes
invalidate export immediately, visibly mark the old result stale, evaluate one
canonical scenario, and atomically update status, figures, interpretation, URL,
and export identity.

### 9.2 Bounded decision/display amendment; no biological-model expansion

The core redesign continues to use existing `ModelOutputsV1`: metrics, surface,
frontier, comparators, assumptions, provenance, and identity. It does require a
small versioned split between classification scope and display domain:

1. `ScenarioV1.envelope` remains the decision scope; the default is a
   degenerate envelope at the UP/Bihar anchor, so existing direct
   `rLocEnvelopeMax`, frontier, and pass/fail semantics remain valid.
2. A versioned setting-surface domain is added to the setting/grid manifest:
   `T = 0.1-2,000 micrograms/exposure`, `N_s = 1-20`, with the existing contact
   frequencies. `buildSettingSurface` uses this display domain rather than the
   decision envelope.
3. The setting and frontier manifest versions, scientific identity, URL/export
   round trips, default-output assertions, and artifact are updated together.

This changes no equation or biological parameter. The optional mechanistic
distribution plot remains deferred because exposing immunity distributions
would change the model-output schema and reopen backend validation. The
measurement map provides the core explanation without that expansion. Direct
grid slices remain a backend-safe but conditional second increment after
usability review.

## 10. Implementation phases and gates

### Phase 0: approve the interaction/content contract -- completed 2026-07-17

1. Mike approved all five decisions in Section 12.
2. The contract is amended so the setting surface is the opening/dominant
   figure while the linked requirement/product maps remain simultaneously
   visible in the next chapter.
3. The UP/Bihar high anchor is the default decision scope. Other named settings
   and custom envelopes remain explicit alternatives; selected probes and
   decision scopes remain separate state and labels.
4. The primary audience and staged parameter-explanation depth are fixed below.

**Gate passed:** scientific meaning, default state, and figure authority are
approved before styling or layout code changes. The detailed semantic result
branches remain Phase 1 implementation work and must follow this approved
contract.

### Phase 1: presentation model and semantic tests

1. Add a typed presentation model without changing `ModelOutputsV1`.
2. Implement and test pass, fail, empty-Pareto, selected-setting probe,
   unavailable uncertainty, pending/stale, invalid, and fixed-comparator prose.
3. Split scientific, view, and release state.
4. Split the versioned surface display domain from the decision envelope, set
   the default decision scope to UP/Bihar, and add explicit scope controls.

**Gate:** another reviewer can identify the authoritative result, diagnostics,
assumptions, gaps, and current scope from text alone.

### Phase 2: narrative shell and visual system

1. Build the top bar, first-viewport result, adjacent qualification, chapters,
   and inspector landmarks.
2. Remove the metric-card row and dashboard-card monoculture.
3. Apply the paper/ink/serif/sans/mono system and responsive compositions.
4. Implement transactional stale/pending behavior.

**Gate:** the default answer and criterion are identifiable within five seconds
without using a plot.

### Phase 3: rebuild the setting surface

1. Implement the fixed blue-white-red scale with `R_loc=1` at white.
2. Remove cell strokes and plot-frame contour artifacts.
3. Add direct pass/fail labels, pressure direction, a distinct default decision
   anchor, and any selected custom-scope outline.
4. Rework named anchors and Matlab hybrid interval with collision-aware labels.
5. Add text alternative, exact readout, and export context.

**Gate:** a first-time reviewer can explain where the selected candidate crosses
the criterion and what the Matlab annotation means.

### Phase 4: rebuild and link the requirement/product maps

1. Add the semantic explanations before the figures.
2. Implement correct empty-frontier behavior.
3. Replace dense high-contrast marks with a quiet directly evaluated field.
4. Link hover, focus, keyboard traversal, and persistent selection.
5. Add selected/comparator labels and exact-versus-grid readout.

**Gate:** the decision remains legible in grayscale, and selection identity is
the same in both maps and exports.

### Phase 5: mechanism and measurement explanation

1. Add the close-contact motif explainer.
2. Add the acquisition/shedding/diagnostic/direct-result reading sequence.
3. Add the status-labeled measurement/provenance map.
4. Add direct grid slices only if the core narrative still leaves parameter
   effects unclear in usability review.

**Gate:** a non-modeler can distinguish take from receipt, effect space from
product space, `q_index` from the decision endpoint, and latent/calibrated
quantities from direct measurements.

### Phase 6: methods, export, responsive, and accessibility completion

1. Complete inspector focus management and source/provenance links.
2. Rebuild SVG export so each figure stands alone with scenario, criterion,
   qualification, legend, selected state, and interpolation note.
3. Add Share with canonical URL state and visible success/failure status.
4. Test wide, tablet, 360 px, 200% zoom, keyboard, touch, reduced motion,
   grayscale, high contrast, print/export, file URL, and Pages prefix.
5. Run fatal-defect audit, quality rubric, clean deterministic build, artifact
   hash, and full `npm run verify`.

**Gate:** no fatal defect; at least 3/4 in every playbook rubric category and
28/32 overall.

## 11. Acceptance tests

### 11.1 Decision comprehension

A reviewer unfamiliar with the code can state, after the default flow:

1. the selected product, schedule, and decision scope;
2. that the default candidate clears the UP/Bihar high anchor at direct
   `R_loc = 0.920`;
3. why UP/Bihar 2003-2008 is treated as the hardest known anchor, and why that
   supports but does not prove likely adequacy elsewhere;
4. that the direct decision-scope result, not the exploratory raster or shedding
   index, controls status;
5. that the default grid contains 92 passing designs and an eight-point Pareto
   boundary under the UP/Bihar scope;
6. that the setting surface extends beyond the decision anchor to show the
   product-specific shape and margin of the result, with `N_s` capped at 20;
7. the difference between acquisition blocking and reduced shedding after a
   breakthrough;
8. that `R_loc` is not complete-population `R_e`;
9. that uncertainty intervals/probability of success are unavailable; and
10. why the Matlab marker is hybrid.

### 11.2 Figure invariants

- `R_loc=1` maps exactly to the near-white center of the legend.
- Values below/above 1 map monotonically toward blue/red.
- Pass/fail remains legible with color removed.
- The internal threshold contour agrees with direct adjacent grid-cell status.
- Plot-frame edges are not mislabeled as the threshold.
- The direct decision-scope result remains authoritative when the exploratory
  raster/contour is interpolated.
- No Pareto line appears when `frontier.pareto` is empty.
- Every drawn Pareto point comes from `frontier.pareto`.
- Exact selected design and nearest grid point are never silently conflated.
- Sabin/IPV comparator identity is fixed under hypothetical-product edits.
- Matlab interval carries daily basis and hybrid status in screen and export.

### 11.3 Interaction invariants

- Every scientific control invalidates all dependent surfaces and export.
- Pending state clearly marks prior outputs stale; new outputs commit together.
- Hover, focus, click, and keyboard traversal resolve to the same design.
- Escape clears transient hover/drawer state without changing science.
- Reset restores the versioned default scenario.
- Named setting probe and decision scope remain independently visible.
- A named preset becomes Custom after a defining edit.
- Browser back/forward and URL reload restore or visibly reject state.
- View-state changes do not alter model/export identity.

### 11.4 Accessibility and artifact invariants

- Heading and landmark order follows the scientific argument.
- The complete workflow is keyboard-operable.
- Figure hover content is available by focus and touch.
- Live text announces committed result changes without reading an entire chart.
- No horizontal overflow or hidden qualification at 360 px or 200% zoom.
- Touch targets are approximately 44 x 44 CSS pixels where practical.
- Reduced-motion mode removes nonessential transitions.
- No runtime network request, external asset, or random sampling is introduced.
- JSON/CSV/SVG, URL, visible result, build identity, and model identity agree.
- Clean repeated builds reproduce the committed self-contained artifact.

## 12. Approved decisions (Mike, 2026-07-17)

### Decision 1: visual order versus the current locked contract

**Approved:** amend the presentation contract so the setting surface is the
opening and visually dominant figure, while retaining the two linked
requirement/product maps simultaneously in the next chapter.

Why: this directly answers "under what conditions," makes the strongest
existing figure carry the opening argument, and makes the hardest-known-anchor
result and its product-specific margin into a coherent story. The prior
contract instead declared the linked maps primary.

### Decision 2: named setting as probe versus decision scope

**Approved, as refined by Decision 5:** keep "selected setting probe" and
"decision scope" as separate controls, and add explicit named single-setting
scope presets. The UP/Bihar anchor is now the versioned default scope; another
probe never changes that classification implicitly.

Why: the current Setting control suggests a decision change that does not
actually occur. Probe and scope still need separate labels even though the
default scope is now the hardest known anchor.

### Decision 3: primary audience

**Approved:** design first for people well versed in vaccine development who do
not have a clean mechanistic mental model analogous to the mathematical model,
with exact model detail one action away.

Why: an expert-only default would preserve the existing control wall; a fully
general-audience design would require more biological exposition than this
instrument needs.

### Decision 4: depth of the parameter view

**Approved:** ship the measurement/provenance map in the core redesign, but
defer the interactive one-dimensional parameter slices until a reviewer still
cannot explain how take, boost, exposure, and contacts affect the result.

Why: the glossary/status map addresses the category errors immediately. The
slices are useful and backend-safe, but adding them before the main narrative is
validated risks rebuilding a parameter dashboard under a different name.

### Decision 5: hardest-known anchor and surface contact range

**Approved:** the default v1 win is direct `R_loc < 1` at the UP/Bihar high
anchor. Present it as the hardest known empirical/model-calibrated stress-test:
clearing it supports a reasoned expectation of adequacy in less demanding
settings represented by the model, but does not guarantee control everywhere.
The setting surface remains broader context for the parameter-specific shape
and margin of the win. Its close-social-contact display range is `N_s = 1-20`,
not 1-40.

Why: UP/Bihar 2003-2008 combines the strongest empirical transmission setting
in the source model with the real-world history of elimination under unusually
intensive vaccination. In contrast, `N_s = 40` came from a source-code
exploration maximum and lacks a plausible interpretation as an average daily
number of family-like child contacts. Twenty remains deliberately beyond the
published high anchor at 10 without letting an arbitrary corner define success.

## 13. Explicit non-goals for this redesign

- No change to equations, biological parameters, calibration, or threshold
  tolerance beyond the approved decision-scope and display-domain manifest
  amendment in Decision 5.
- No claim of parameter uncertainty, upper-95 support, or probability of
  success.
- No full-population transmission, outbreak, campaign, safety, evolutionary, or
  geographic-spread view.
- No new front-end framework, external font, CDN, backend, telemetry, or runtime
  data load.
- No decorative animation, 3-D surface, map, or chart added only to make the
  artifact look contemporary.
- No immunity-distribution visualization until its output schema and scientific
  interpretation are separately approved.
