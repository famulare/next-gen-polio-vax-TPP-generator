# Frontend Streamlining Implementation Plan

**Status:** execution brief for Claude Opus 4.8\
**Baseline reviewed:** `606aafe` (`main`, 2026-07-23), plus the pre-existing
worktree precision adjustment in `src/app.ts::syncControls`\
**Primary decision:** make the page read as one continuous, predominantly
single-column explanation while preserving the few comparisons that require
side-by-side figures.

This is an implementation plan, not permission to change the model. The work is
presentation-layer work except for the explicit contract corrections in Phase
0. `DESIGN_CONTRACT.md` remains authoritative.

## 1. Decision purpose

The current page has individually coherent components but too many horizontal
grammars: offset chapter headings, multi-column definition lists, step cards,
control grids, chart pairs, and wide readout rows. As a reader moves down the
page, the eye repeatedly has to infer a new left-to-right path. On narrow
screens, several of those layouts stack, but some SVG text clips rather than
recomposes.

The redesign should:

1. establish one obvious vertical reading order;
2. keep a common left edge for headings, prose, controls, and conclusions;
3. use extra width only where simultaneous visual comparison is the point;
4. retain enough orientation before the first graphs that the cohort comparison
   is not dropped on the reader without explanation;
5. expose controls at the point where their consequences are shown without
   making every secondary parameter equally prominent;
6. reduce local CSS inventions in favor of a small set of layout primitives;
7. preserve all scientific semantics, model outputs, input identities, export
   behavior, and deterministic behavior.

## 2. Current baseline: what changed and what remains

The implementation must be based on the current files, not an earlier visual
review.

### Improvements already present

- The transmission section now introduces the motif before displaying it and
  uses a cleaner fan-out diagram. Do not replace that desktop diagram wholesale.
- The setting heatmap now uses the revised color scale and current three-anchor
  presentation.
- The product labels, HID50 control, motif fan-out, numeric precision, and
  several explanatory strings have already changed. Preserve those current
  choices unless a later phase explicitly names a string for revision.
- At handoff, `src/app.ts::syncControls` contains an uncommitted adjustment that
  rounds displayed `alpha` and derived HID50 control values to two significant
  digits. It is not part of this plan; preserve it and do not absorb or revert
  it accidentally.

### Remaining experience problems

- The opening is still long enough that a normal desktop viewport does not reach
  either the cohort comparison or the first figure.
- Chapter headings alternate between a narrow number column and a prose column.
  Other sections introduce unrelated two-, four-, and seven-column grids. The
  cumulative effect is horizontal busyness rather than a stable page spine.
- The setting control sits in a full-width bordered panel with substantial
  unused horizontal space.
- At 360 px, the sticky navigation truncates into a partial horizontal list.
- At 360 px, within-host SVG titles and annotations visibly clip. The existing
  overflow rules hide the failure instead of preventing it.
- The dose-response chart has no distinct mobile composition.
- Product steps stack on mobile but remain a long sequence of similarly weighted
  boxes.
- Transmission handshake fields and mechanism readouts are presented as broad
  grids even though their semantic order is vertical.
- Measurement, inspector, and assumption layouts introduce still more column
  systems late in the document.
- `src/styles.css` contains stale selectors with no current markup owner,
  including `.opening`, `.decision-controls`, `.control-pair`,
  `.control-actions`, `.controls-and-provenance`, and `.advanced-body`.

## 3. Phase 0: synchronize the canonical contract before layout work

Mike has approved the setting-surface behavior in the current implementation.
Treat that implementation, together with the `settings-2.1.0` manifest and the
corresponding current-contract changelog entry, as the source for this specific
documentation synchronization. This is not an open scientific-design decision.
Complete and commit the synchronization before presentation edits.

### 3.1 Amend the opening contract

Mike's intended opening order is:

1. question/title and lede;
2. a compressed **What this is**;
3. a concise **How to use it**;
4. cohort comparison;
5. prototype qualification;
6. first teaching figure.

Amend `DESIGN_CONTRACT.md` Sections 13.1 and 13.9 so this order is authorized.
The amended contract should say:

- orientation may precede the cohort comparison;
- `What this is` and `How to use it` must be concise and must not introduce a
  verdict or replace the comparison;
- the cohort comparison and prototype qualification must appear before the
  first scientific figure;
- do not retain the stronger requirement that the comparison itself be visible
  within the literal first viewport;
- `How to use it` remains in this implementation. Its deletion requires a
  separate refactor plus evidence that the interaction is self-explanatory.

The amendment must preserve the existing qualifications around `R_loc`, the
declared setting envelope, and fixed comparators. Do not use the contract change
as an opportunity to rewrite unrelated scientific sections.

### 3.2 Synchronize the setting-surface domain

The current repository contains mutually inconsistent assertions:

- `src/data/setting-anchors.json` defines a 61×20 grid with exposure values from
  1 to 1,000 in its native manifest representation;
- the rendered setting surface intentionally presents the display axis as
  1–1,000 micrograms/day;
- the current contract changelog records the approved 61-column,
  1–1,000-µg/day display change;
- `DESIGN_CONTRACT.md` still contains both a 2,000-microgram upper-bound
  statement and an 81×20 / 0.1–2,000 description;
- `src/app.ts` still calls the displayed surface 81×20.

Update the stale contract prose and visible 81×20 caption to the approved
implementation:

- display grid: 61 log-spaced exposure values by 20 integer contact values;
- displayed exposure domain: 1–1,000 µg/day;
- displayed contact domain: `N_s = 1–20`;
- `R_loc` color range: 0.01–20 with white at exactly 1;
- three displayed named anchors: Houston/Louisiana, Matlab, and UP/Bihar.

Remove or replace the obsolete 2,000-microgram rationale and the
81×20 / 0.1–2,000 assertion. Preserve the contract's existing distinction
between source-native units, internal canonical units, and UI-boundary display
conversion; do not globally normalize `micrograms/day` and
`micrograms/exposure` occurrences. In particular, Matlab's source basis remains
`micrograms/day`, while the manifest's per-exposure fields remain as currently
implemented.

Do not alter `src/data/setting-anchors.json`, grid generation, calibration,
interpolation, UI axis semantics, or model equations. This subtask makes the
contract and stale caption describe the already-approved behavior; it does not
change that behavior.

### Phase 0 discriminator

After Phase 0, the contract, caption, axis labels, and exported metadata must
agree on the approved display grid and domain. A repository search for `81`,
`2000`, `2,000`, `0.1`, `micrograms/day`, and `micrograms/exposure` must leave
only intentional, reviewed occurrences. Native-unit occurrences are expected;
the review must classify them rather than blindly replace them.

## 4. Target page architecture

### 4.1 A single alignment spine

Introduce three global width concepts:

- **page shell:** outer gutters and maximum page width;
- **reading column:** headings, prose, controls, definitions, conclusions, and
  ordinary figures; target roughly 44–52rem;
- **wide breakout:** figures whose interpretability benefits from width; target
  roughly 66–76rem, bounded by the viewport.

The exact token values should be tuned visually rather than copied blindly.
Every chapter begins on the reading-column spine. Put the chapter number above
or immediately beside the heading without creating a permanent empty rail.
Remove the alternating or offset heading grammar.

Wide breakouts are exceptions, not a second page spine. Their titles,
introductory prose, captions, and conclusions remain aligned to the reading
column even when the plot itself expands.

### 4.2 Permitted wide or side-by-side exceptions

At sufficiently wide viewports, retain side-by-side presentation only for:

1. the within-host four-panel teaching figure, when the 2×2 relationship is
   legible;
2. the setting surface;
3. the two linked product-design maps, because simultaneous comparison is a
   contract requirement.

The transmission motif may use the wide breakout on desktop, but it is one
figure rather than a left/right content layout. All exceptions must have a
purpose-built narrow composition.

### 4.3 Section-by-section composition

#### Opening

- Keep the six-part order in Section 3.1.
- Compress `What this is` substantially, but preserve the tool's scope and
  close-contact sufficiency qualification.
- Keep `How to use it` to two or three short sentences or an equivalent compact
  instruction block. It should name the action sequence, not retell the page.
- Present the cohort comparison as the first visually prominent evidence block.
- Keep the prototype qualification directly adjacent to the comparison.
- Do not delete `How to use it` in this project.

#### Within-host mechanics

- Use a standard chapter heading on the common spine.
- Keep the coherent four-panel scientific figure.
- Follow it with one vertically ordered interpretation block, not four
  equal-weight cards.
- Preserve the conditioned take/no-take distinction, survival–intensity joint
  expectation, fixed-WPV susceptibility basis, units, and all current figure
  semantics.

#### Product definition

- Replace the horizontal four-step pathway with a compact vertical sequence.
  Use restrained rules or numbered labels rather than four heavy cards.
- Keep summary, dose-response figure, immunity figure, and parameter controls in
  causal reading order.
- Keep primary product controls visible.
- Put the five hypothetical-product controls in a native `<details>` disclosure
  directly after the primary controls, closed by default for hypothetical
  products. The summary label must make clear that these are additional product
  parameters, not optional scientific assumptions.
- Fixed comparator products must remain catalog products. Preserve the existing
  visibility/disabled behavior and do not imply that their parameters can be
  tuned.
- Preserve every existing input `id`, label association, range, step, unit,
  default, and state update.

#### Transmission

- Retain the current desktop fan-out motif and introductory order.
- Give the motif a distinct narrow composition rather than merely shrinking the
  820-pixel SVG.
- Render the handshake definitions as a vertical ruled list in semantic order.
- Keep the motif control immediately before its displayed consequence.
- Render mechanism values and the meaning note as one descending sequence.
- Remove explanatory repetition only when two nearby elements make the same
  claim. Do not compress away the fixed WPV term or the distinction between a
  mechanism result and a decision result.

#### Decision

- Put heading, setting selector, surface, caption, and result on the common
  vertical path.
- Constrain the setting selector to the reading column. Avoid a full-width empty
  bordered box.
- Allow only the surface plot to break wide.
- Keep the direct result immediately below the figure, followed by its
  qualification.
- Preserve the close-contact sufficiency axiom and setting-envelope
  qualification. Do not introduce complete-population `R_e` language.

#### Measurement map

- Keep the introductory disclosure.
- At desktop, a compact table remains acceptable if it reads left to right
  without competing with the page spine.
- At narrow widths, do not require horizontal page scrolling. Recompose each
  measurement row as a vertically readable record while retaining semantic
  table markup or an equivalently accessible structure.
- Move existing text; do not paraphrase measurement definitions during the
  layout refactor.

#### Linked design maps

- Keep the two maps side by side at widths where both remain legible.
- Stack them in their defined order on narrow screens.
- Keep shared summaries and the selected-point inspector on the reading-column
  spine.
- Replace the seven-column inspector with a wrapping two- or three-column
  definition layout on desktop and a single-column layout on narrow screens.
- Preserve synchronized selection, selected-point values, frontier semantics,
  and all map labels.

#### Assumptions and export

- Use a single vertical assumptions list rather than a two-column closing
  section.
- Keep export controls compact and visually secondary.
- Preserve print/export metadata and required qualification language.

#### Header and navigation

- Retain the desktop inline navigation when it fits.
- At the narrow breakpoint, replace the truncated horizontal navigation with a
  native, keyboard-operable disclosure labeled `Sections`.
- The disclosure contains the same anchors and closes no content off from
  no-JavaScript users. Prefer `<details>/<summary>` and CSS over new application
  state.

## 5. CSS architecture

Refactor `src/styles.css` around a small vocabulary. Use existing design tokens
where possible; add only tokens that eliminate repeated arbitrary values.

### Required reusable primitives

Names may follow existing repository conventions, but the responsibilities
should be recognizable:

- `.page-shell`: global maximum width and responsive gutters;
- `.content-column`: reading measure and common left edge;
- `.wide-breakout`: centered wide figure without changing surrounding text
  alignment;
- `.flow`: vertical rhythm using a configurable gap;
- `.section-heading`: chapter number, title, and optional deck;
- `.ruled-list`: vertically ordered definitions or steps;
- `.inset-panel`: the one restrained container treatment for controls or
  qualifications that truly need containment;
- `.figure-pair`: the linked-map wide comparison with an explicit stack
  breakpoint.

Do not turn these into an unbounded utility system. Prefer one semantic
modifier over a new bespoke block for each section.

### Spacing

- Define a compact spacing scale such as `--space-1` through `--space-7`.
- Use flow spacing for relationships within a section and larger section spacing
  only between chapters.
- Reduce double spacing created when a component margin and parent gap both
  express the same relationship.
- Preserve useful breathing room around figures and decision results; the goal
  is hierarchy, not uniform compression.

### Cleanup

- Delete stale selectors after confirming they have no markup or generated
  owner.
- Consolidate repeated border, background, radius, and grid declarations.
- Remove narrow-screen `overflow: hidden` or `overflow-x: clip` rules that
  conceal SVG text. Overflow may be used for an intentional scroll container,
  but not to make a failed responsive figure pass.
- Keep print rules explicit and verify them after changing layout primitives.

## 6. Responsive figure work

Responsive scientific figures must preserve meaning. Do not solve clipping by
dropping panels, legends, units, uncertainty bands, conditioning labels, or
required comparison curves.

### Shared implementation pattern

- Continue using deterministic SVG renderers.
- Add a small SVG text helper that emits explicit `<tspan>` lines from
  caller-supplied line arrays. Do not add runtime text measurement or a
  dependency.
- Keep chart titles, subtitles, legends, and axis units within the SVG view box
  when they are part of exported figure meaning.
- Use fewer tick labels at narrow widths only when endpoints, important named
  thresholds, and units remain unambiguous.
- Prefer a taller mobile view box over compressed type.

### Within-host figure

- Retain all four panels and their order.
- Repair the current mobile kicker, panel titles, and annotations so every text
  element fits at 360 px.
- Wrap long text with explicit lines and increase panel/title height as needed.
- Verify conditioned cohorts and the survival–intensity relationship remain
  visible without relying only on color.

### Dose-response figure

- Add a distinct mobile renderer rather than scaling the 820×360 composition.
- Use a taller view box, a stacked or multi-line legend, and reduced tick
  density.
- Preserve all series, dose units, and fixed versus hypothetical distinction.

### Immunity-distribution figure

- Rework the mobile left margin and title placement; the current title begins
  too far to the right and clips.
- Wrap axis or explanatory text explicitly.
- Preserve distribution-native presentation and do not replace distributions
  with a mean-person summary.

### Transmission motif

- Keep the current desktop SVG.
- Add a vertical mobile variant: source cohort, infectiousness branch,
  susceptible-contact branch, and fan-out exposures should read top to bottom.
- Preserve the one-to-many exposure motif and all current labels. Do not turn it
  into a one-to-one transmission cartoon.

### Setting surface and linked maps

- Inspect all visible text, legends, axes, selection markers, and summaries at
  360, 480, 720, 1024, and 1440 px.
- If text does not remain legible when scaled, add a narrow renderer or move
  non-plot explanatory text into adjacent semantic HTML. Do not clip it.
- The two linked maps may stack, but must retain synchronized state and appear
  together in the same section.

## 7. Pedagogical scaffolding rules

Claude may compress or relocate prose only within these constraints.

### Retain

- a compact `What this is`;
- `How to use it` until a later comprehension check demonstrates that it is
  unnecessary;
- the cohort comparison before the first scientific figure;
- definitions that protect distinctions between dose receipt and take,
  conditioned cohorts, fixed WPV susceptibility, mechanism and decision
  results, and `R_loc` and complete-population `R_e`;
- figure-specific interpretation directly after the relevant figure;
- all required scope and setting qualifications.

### Compress

- repeated instructions that describe the same scroll/action sequence;
- duplicate prose immediately restating a visible label or nearby conclusion;
- card introductions whose hierarchy can be expressed by order and typography;
- generic transitions that do not add scientific meaning.

### Do not do

- Do not write a new scientific claim to make a section feel smoother.
- Do not weaken or strengthen certainty.
- Do not replace distribution-native explanations with an “average child” or
  average-person story.
- Do not convert `take` into dose receipt or coverage.
- Do not imply that a fixed comparator is tunable.
- Do not describe the result as a general guarantee outside the declared v1
  close-contact setting envelope.
- Do not delete text solely because the redesigned layout is expected to make it
  redundant. First implement the layout; then assess the rendered page.

### Copy workflow

1. Move current strings without rewriting during structural work.
2. Render the new structure.
3. Mark actual repetitions in context.
4. Make a separate, reviewable copy diff limited to the opening and proven
   duplicates.
5. For each changed scientific sentence, state the preserved assertion in the
   commit or review notes.
6. If a sentence's semantic payload cannot be stated confidently, retain it and
   flag it for Mike rather than improvising.

## 8. Allowed files and boundaries

### Allowed

- `DESIGN_CONTRACT.md` — only the opening amendment and confirmed stale
  setting-surface assertions in Phase 0;
- `src/app.ts` — document structure, existing strings within the copy rules,
  semantic wrappers, navigation markup, and confirmed stale captions;
- `src/styles.css` — layout system, responsive behavior, cleanup, and print;
- `src/ui/charts.ts` — deterministic presentation renderers only;
- `src/ui/presentation.ts` — only if necessary to select a responsive renderer;
- relevant files under `tests/ui/`;
- `scripts/browser-smoke.mjs`;
- generated `dist/index.html` and its tracked reference hash, using the existing
  repository commands;
- `IMPLEMENTATION_LOG.md` — required delegation/execution record.

### Not allowed without a separate contract task

- `src/model/**`;
- `src/data/**`;
- model equations, calibration, interpolation, uncertainty propagation, named
  anchors, defaults, success rules, or reference fixtures;
- scientific schemas or manifest semantics;
- new runtime dependencies;
- network calls, runtime randomness, compatibility aliases, or silent defaults;
- unrelated cleanup.

If implementation appears to require a forbidden file, stop and explain the
need. Do not broaden scope silently.

## 9. Execution sequence

Each phase should leave a working page and a reviewable diff.

### Phase 0 — contract and stale assertions

1. Make the opening contract amendment.
2. Synchronize the stale setting-surface contract and caption assertions to the
   current approved implementation.
3. Preserve and document the native-unit versus UI-display distinction.
4. Search for conflicting domain/unit language.
5. Run contract/reference checks before proceeding.

### Phase 1 — lock behavior and capture the baseline

1. Record current default and at least one non-default canonical model output.
2. Capture desktop and 360 px screenshots of every chapter.
3. Add or strengthen DOM-order tests for the amended opening sequence.
4. Add an SVG text-bounds assertion before changing charts so current mobile
   failures are visible.
5. Record existing failures separately from regressions.

### Phase 2 — establish the page spine

1. Add width and spacing tokens.
2. Implement page shell, reading column, wide breakout, flow, and standard
   section heading.
3. Apply the standard heading to every chapter.
4. Change no scientific copy in this phase.
5. Verify desktop, tablet, and narrow geometry.

### Phase 3 — restructure ordinary content

1. Implement the amended opening order and compact visual hierarchy.
2. Convert product steps, transmission definitions/readouts, and assumptions to
   vertical patterns.
3. Constrain setting controls and other ordinary panels to the reading column.
4. Replace the seven-column inspector layout with a wrapping definition layout.
5. Preserve DOM identities and event wiring.

### Phase 4 — progressive disclosure and navigation

1. Add the hypothetical-product parameter disclosure.
2. Add the narrow `Sections` navigation disclosure.
3. Verify keyboard order, labels, focus indicators, and no-JavaScript
   accessibility.
4. Verify fixed-product versus hypothetical-product behavior.

### Phase 5 — responsive figures

1. Repair the within-host mobile renderer.
2. Add the dose-response mobile renderer.
3. Repair the immunity mobile renderer.
4. Add the transmission mobile motif.
5. inspect and repair setting/map narrow compositions as needed.
6. Remove clipping masks only after figures fit.

### Phase 6 — measurement, linked maps, and closing sections

1. Implement the narrow measurement-record presentation.
2. Apply the explicit figure-pair behavior to linked maps.
3. Align summaries and inspector with the reading column.
4. Simplify assumptions/export composition.
5. Verify print layout and exported figure metadata.

### Phase 7 — copy compression after layout

1. Render the complete page before editing prose.
2. Compress `What this is` and `How to use it` within Section 7's rules.
3. Remove only demonstrable nearby repetitions.
4. Keep `How to use it`.
5. Review all changed scientific strings against the contract.

### Phase 8 — cleanup and full verification

1. Remove dead selectors and consolidate duplicated CSS.
2. Run formatting and focused tests.
3. Run the full repository verification required for the generated artifact.
4. Compare pre/post canonical model outputs byte-for-byte or structurally
   exactly, according to the repository's established representation.
5. Capture the final viewport matrix and perform a manual reading-order review.
6. Record the work and residual uncertainty in `IMPLEMENTATION_LOG.md`.

## 10. Test and acceptance criteria

### Scientific and behavioral invariants

- Canonical model outputs for unchanged inputs are exactly unchanged.
- All fixed comparator inputs and outputs are unchanged.
- All hypothetical-product defaults, bounds, steps, units, and update behavior
  are unchanged.
- Scenario selection, motif state, map selection, result status, and export
  behavior are unchanged except for presentation.
- No model or data file changes appear in the diff.
- Required figure panels, series, uncertainty depictions, units, and
  qualifications remain present.

### Opening and reading order

- DOM and visual order is title/lede → `What this is` → `How to use it` →
  cohort comparison → prototype qualification → first scientific figure.
- No verdict appears before the cohort comparison.
- Every chapter heading shares the same reading-column left edge, within normal
  typographic tolerance.
- No ordinary prose or control block uses an unrelated left/right layout.

### Responsive matrix

Verify at minimum:

- 1440×900;
- 1024×768;
- 720×900;
- 480×900;
- 360×800.

At every size:

- `document.documentElement.scrollWidth <= window.innerWidth`;
- no visible SVG text extends outside its owning SVG viewport;
- no text is made to “pass” by an `overflow: hidden` or `clip` ancestor;
- controls have usable labels and do not overlap;
- focus indicators remain visible;
- touch targets meet the repository's existing usability threshold;
- scientific text is readable without browser zoom.

Enhance `scripts/browser-smoke.mjs` so the test inspects visible SVG text
bounding rectangles against the owning SVG rectangle. The current helper
ignores SVG descendants and clipped ancestors, so it cannot detect the observed
mobile failure. Allow a small pixel tolerance for antialiasing, but do not add
broad exclusions.

### Component behavior

- Narrow navigation exposes every section anchor and works by keyboard.
- The additional-product-parameters disclosure is closed initially, opens by
  keyboard, and contains the same controls with the same IDs and values.
- Fixed comparators cannot be made parameterizable through the disclosure.
- Linked maps remain simultaneous on wide screens and sequential in the same
  section on narrow screens.
- Selected map points and inspector values stay synchronized.
- The decision result remains immediately below the setting surface and caption.

### Accessibility and document semantics

- One `h1`; chapter headings remain in logical `h2` order.
- Figure names and descriptions remain associated with their figures.
- Tables or replacement measurement records retain equivalent header/field
  relationships.
- `<details>/<summary>` labels describe what is hidden.
- Color is not the sole carrier of a result or cohort distinction.
- Reduced-motion and print behavior remain valid.

### CSS quality

- Stale selectors named in Section 2 are deleted or have a demonstrated owner.
- New layout behavior is expressed through the shared primitives in Section 5.
- No new dependency is added.
- No section-specific rule duplicates a primitive merely to vary one spacing
  value.
- CSS size should be stable or smaller after cleanup unless responsive chart
  visibility rules justify a small increase.

### Required commands

Use the repository's current scripts rather than inventing a new toolchain.
At minimum run:

```bash
npm test
npm run typecheck
npm run build
npm run verify
```

`npm run check:artifact` is the repository's focused artifact-plus-browser-smoke
command; use it during iteration. The final `npm run verify` repeats that check
and also runs fixture, reference, calibration, performance, memory, build, and
negative-release checks. If the scripts change before execution, inspect
`package.json`, use the actual equivalents, and record the substitution. Do not
report success while a command is still running.

## 11. Stop conditions

Stop and request a decision rather than proceeding when:

- a proposed copy edit changes claim strength, scope, comparator meaning, or
  scientific terminology;
- a responsive figure appears to require dropping required content;
- a layout change would alter model state, parameter ownership, or export
  semantics;
- generated artifacts cannot be reproduced by the repository's documented
  commands;
- unexpected dirty-worktree changes overlap the allowed files.

When stopped on copy, retain the current wording and continue with independent
layout work if doing so is safe.

## 12. Claude Opus 4.8 handoff manifest

Use the following as the bounded delegation manifest required by
`DESIGN_CONTRACT.md` Section 14.6.

### Objective

Implement this plan so the application becomes a predominantly single-column,
pedagogically ordered, responsive document while preserving every scientific
and computational invariant.

### Controlling contract sections

- `DESIGN_CONTRACT.md` Sections 13.1–13.9;
- Section 10.3 and the current contract changelog for the approved
  setting-surface domain;
- Section 14.6 for delegated work and logging;
- all model and uncertainty sections indirectly protected by the no-behavior-
  change invariant.

### Allowed inputs

- this plan;
- the current repository at or after baseline `606aafe`;
- `DESIGN_CONTRACT.md`;
- `docs/codex-task-template.md`;
- current application source, tests, generated artifact, and manifests for
  verification only.

### Allowed output files

Only the files listed in Section 8.

### Expected outputs

1. reviewed contract amendment and stale-assertion correction;
2. single-spine desktop layout;
3. deliberate narrow navigation and figure compositions;
4. compressed but retained opening scaffolding;
5. smaller reusable CSS vocabulary with dead rules removed;
6. strengthened browser smoke tests that detect clipped SVG text;
7. regenerated deterministic artifact;
8. complete `IMPLEMENTATION_LOG.md` entry;
9. verification report with commands, results, screenshots reviewed, and
   residual uncertainty.

### Discriminator

The implementation is correct only if it improves reading order and narrow
legibility while canonical model results, scenario behavior, product semantics,
figure meaning, and export metadata remain unchanged. A visually cleaner result
that changes any of those is a failure.

### Mandatory review record

Add an `IMPLEMENTATION_LOG.md` entry containing:

- executor/model and date;
- objective and contract sections;
- allowed files;
- content-block status and any fallback used;
- files changed;
- scientific invariants checked;
- exact tests and commands run;
- primary integrator review disposition;
- unresolved decisions or residual risks.

Claude is the executor, not the scientific decision owner. The current
setting-surface implementation is already approved; Claude should synchronize
the stale documentation and caption, not reopen that decision. Mike retains
final copy judgment.

## 13. Final review checklist

Before presenting the implementation:

- read the rendered page top to bottom at 1440 px without interacting and confirm
  there is one obvious path;
- repeat at 360 px and confirm no truncated navigation, clipped annotations, or
  accidental horizontal exploration;
- compare the opening against the exact six-part order;
- compare every scientific figure before and after for retained content;
- compare default and alternate canonical outputs;
- inspect the diff for model/data changes, new dependencies, fallbacks, or
  compatibility residue;
- run `git diff --check`;
- report any acceptance item not verified rather than inferring it passed.
