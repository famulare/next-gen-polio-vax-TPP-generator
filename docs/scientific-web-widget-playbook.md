# Designing a high-quality scientific web instrument

## A practical playbook for a model that cannot rely on taste alone

**Purpose.** This document is an execution guide for building a polished,
interpretable scientific web widget or single-page instrument. It is written to
be usable by a capable but less design-experienced implementation model. It
turns visual judgment, interaction judgment, scientific writing, and technical
architecture into explicit rules, gates, and acceptance tests.

Here, **widget** means a bounded interactive scientific artifact. It may fill a
browser window; it does not have to look like a small embeddable card.

This guide is deliberately reusable. The local repository's scientific design
contract, schemas, equations, units, success rules, and release requirements
remain authoritative. If this guide and a local contract disagree, follow the
local contract. Presentation may clarify meaning; it may not revise it.

---

## 1. The quality target

The target is not "a dashboard with nice CSS." It is a scientific instrument
that has four properties at once:

1. **It has a point of view.** The artifact knows the primary question and puts
   the answer, not the controls, at the center.
2. **It keeps the evidence structure visible.** Observed input, calibrated
   parameter, assumption, derivation, interpretation, and unresolved gap are
   not flattened into one voice.
3. **It rewards inspection.** A user can move from result to mechanism to
   setting to source without losing the current scenario.
4. **It is technically trustworthy.** The result is deterministic,
   reproducible, accessible, exportable, responsive, and independent of a
   runtime service when the product contract calls for a static artifact.

The experience should feel authored but not staged, polished but not
promotional, and decisive without hiding uncertainty.

### A useful test

After one minute, a first-time user should be able to answer:

- What question does this tool answer?
- What is the current answer?
- What changed that answer?
- What does the answer *not* establish?
- Where can I inspect the assumptions or source basis?

If any answer requires reading a README, the artifact is not finished.

---

## 2. Two reference archetypes

The quality target comes from two different forms of modern scientific
communication. Do not imitate either artifact mechanically. Understand the job
each one is doing.

### 2.1 The atlas archetype: an instrument for inspecting a state space

The atlas pattern uses a compact three-part workspace:

- a **control rail** for search, representation choices, filters, and discovery;
- a **primary field** where the scientific or semantic geometry is manipulated;
- a **reader/inspector** that reveals source, relations, neighbors, and
  diagnostics for the current selection.

Its strongest design decisions are semantic rather than decorative:

- It puts two representations of the same corpus in direct tension rather than
  pretending that one projection is truth.
- It reports a diagnostic appropriate to the selected representation.
- It states that distance, degree, and visual prominence do not establish
  evidential strength.
- It preserves original passages, provenance, relation direction, and source
  context one action away.
- It uses linked selection: the map, breadcrumbs, source reader, accessible
  list, and URL describe the same state.
- It provides a DOM/keyboard mirror for a canvas-based visual.
- It precomputes expensive geometry, embeds the result, and keeps the runtime
  deterministic and read-only.

**Lesson:** when users explore a high-dimensional result, give them a stable
inspection instrument. Every visual encoding needs a nearby explanation of
what it represents and what it cannot prove.

### 2.2 The evidentiary-exhibit archetype: an authored path through an argument

The exhibit pattern is a long-form scientific narrative with interaction used
to expose the argument's evidentiary structure:

- a full-view opening states the thesis, authorship, archive boundary, and how
  to read the artifact;
- a chapter rail shows the argument's progression;
- an evidence lens distinguishes direct evidence, derivation, inference, and
  gaps;
- claim-level status markers remain attached to prose and figures;
- citations open a source drawer without destroying reading position;
- quantitative views are embedded at the exact point where the argument needs
  them;
- the narrative includes counterweights, missing comparators, and an explicit
  "not proven" ledger;
- it ends with a verification sequence and provenance statement, not a grander
  conclusion than the record supports.

Its visual language reinforces that posture: warm paper, dark ink, one strong
editorial accent, large serif headings, compact sans-serif utility text,
hairline rules, and restrained motion. The page feels intentionally composed
without using visual polish as a substitute for evidence.

**Lesson:** when interpretation is part of the deliverable, label the epistemic
move. A beautiful story becomes more credible when the artifact makes it easy
to see where the story could fail.

### 2.3 The hybrid to build for scientific decision tools

Most scientific decision widgets should combine the archetypes asymmetrically:

- Use the **atlas as the interaction chassis**: stable state, linked views,
  controls, selection, diagnostics, source inspection, and shareable state.
- Use the **exhibit as the communication discipline**: authored reading order,
  clear claims, visible evidence status, adjacent limitations, and a final
  provenance/decision record.

Do **not** combine them as a dense dashboard followed by a decorative essay.
The narrative should explain the current interactive state, and interaction
should test the narrative's claims.

---

## 3. Choose the product posture before choosing the layout

Classify the artifact before writing code.

| Posture | Primary user need | Default form | Main failure to avoid |
|---|---|---|---|
| **Instrument** | Compare scenarios and inspect mechanisms | Persistent workspace with linked views | Controls become the product |
| **Exhibit** | Understand a bounded argument and its evidence | Authored chapters with embedded figures | Story outruns evidence |
| **Hybrid** | Reach a decision, then understand and challenge it | Instrument first, guided interpretation second | Two disconnected products on one page |

For a parameterized scientific model, default to **hybrid with an
instrument-first posture**. The first viewport should support the primary
decision. Longer interpretation belongs below it or in a persistent inspector,
not before it.

---

## 4. Write an artifact contract before implementation

A weaker implementation model will otherwise let layout choices silently make
scientific decisions. Require it to write the following one-page contract
before editing application code.

### 4.1 Contract template

```text
Decision purpose
  What decision or comparison should this artifact improve?

Primary audience
  Who uses it, and what can they reasonably be assumed to know?

Primary question
  One sentence ending in a question mark.

Authoritative output
  The exact quantity or classification that answers the question.

Supporting outputs
  Mechanisms or diagnostics that explain but do not replace the answer.

Scientific state
  Inputs, fixed parameters, derived values, and uncertainty objects.

Comparison contract
  Baseline, comparators, threshold, direction of improvement, and tie behavior.

Uncertainty contract
  What varies, what does not, what the interval/range means, and what is absent.

Prohibited inference
  The most tempting conclusion the artifact does not support.

Default scenario
  A named, versioned, scientifically legitimate starting state.

Interaction promise
  Which user actions change the scientific scenario, and which only change view.

Reproducibility promise
  URL state, export identity, parameter/model versions, and deterministic build.

Release boundary
  Required browsers, viewport range, performance, exports, and runtime services.
```

### 4.2 Stop conditions

Stop and obtain a contract decision when any of the following is unclear and
would change the result's meaning:

- whether a quantity is observed, fitted, assumed, or derived;
- whether a threshold is strict or inclusive;
- whether an interval describes heterogeneity, sensitivity, posterior
  uncertainty, bootstrap uncertainty, or something else;
- whether a comparator is fixed or user-parameterized;
- whether a control changes the model or only the view;
- whether the displayed maximum is evaluated directly or interpolated;
- whether a summary metric is authoritative or diagnostic;
- whether a scientific unit is internal, displayed, or converted at the UI
  boundary.

Do not resolve these with a convenient default, a clamp, or a sentence that
sounds cautious.

---

## 5. Organize the experience around an answer, not a control panel

The default user flow is:

1. **Orient** -- understand the question, scope, and starting scenario.
2. **See the answer** -- encounter the current result before editing anything.
3. **Change one consequential assumption** -- use a small primary control set.
4. **Watch one coherent update** -- status, charts, prose, and exports change as
   one transaction.
5. **Ask why** -- inspect the mechanistic decomposition.
6. **Ask where** -- test the result over the declared setting or sensitivity
   envelope.
7. **Challenge it** -- inspect uncertainty, limitations, assumptions, and
   provenance.
8. **Carry it away** -- copy a link or export a complete, versioned scenario.

### 5.1 First-viewport order

Use this order unless the scientific contract requires another:

1. product name and one-sentence question;
2. scenario identity and prototype/release status;
3. authoritative result sentence;
4. primary figure or linked figure pair;
5. compact primary controls;
6. one adjacent qualification stating what the result does not mean;
7. a visible route to methods, provenance, and export.

Do not open with an undifferentiated wall of sliders. A default scenario should
already tell a meaningful story.

### 5.2 State changes are transactions

When an input changes, update all scientifically dependent surfaces together:

- selected point or contour;
- authoritative numerical readout;
- pass/fail or other classification;
- interpretive sentence;
- uncertainty display;
- mechanism panel;
- URL/export state;
- stale-computation or validation status.

Never leave a new slider value beside an old result. If computation is not
instantaneous, show an explicit pending state and keep the old result visibly
marked as stale until the update commits.

### 5.3 Preserve orientation

- Keep the selected scenario named and visible.
- Keep the threshold visible when the user explores away from it.
- Use linked hover and selection across figures.
- Let Escape close transient surfaces without changing scientific state.
- Make Reset restore the versioned default, not a hand-maintained collection of
  UI literals.
- Use breadcrumbs only when there is real hierarchy.
- Do not navigate away from the result to show an explanation; prefer an
  inspector, drawer, anchored section, or expand-in-place pattern.

---

## 6. Interpretive writing: make the epistemic move visible

Scientific prose in an interactive artifact has a different job from prose in
a report. It must interpret the current state without implying more than the
model supports.

### 6.1 Use a seven-level claim grammar

Keep these categories conceptually distinct even if the interface uses more
domain-specific labels.

| Category | Meaning | Appropriate language |
|---|---|---|
| **Observed / source evidence** | Quantity or statement read directly from a declared source | "The source reports..." |
| **Scenario input** | User-selected or preset value that defines the question being evaluated | "The selected scenario uses..." |
| **Calibrated parameter** | Model quantity estimated through a declared fitting or calibration procedure | "The calibration estimates..." |
| **Assumption / fixed convention** | Quantity or structural choice held fixed for the current model version | "The model assumes..." or "Version 1 fixes..." |
| **Derived result** | Deterministic output of declared inputs and equations | "The model computes..." |
| **Interpretation / decision** | Meaning assigned to a result under a declared rule | "Under the stated criterion, this indicates..." |
| **Limit / gap** | Unsupported, unmodeled, unresolved, or unavailable issue | "This does not evaluate..." |

Do not label a scenario choice as observed merely because a named preset
supplies it. Do not label a calibrated value as direct evidence. Do not relabel
an assumption as a calibrated parameter merely because it is numerical. Do not
label a modeled output as evidence merely because it is numerical. Do not label
a judgment as derived merely because it follows a chart.

### 6.2 The five-sentence result block

Write the primary interpretation in this order:

1. **Scenario:** name the schedule/product/setting currently evaluated.
2. **Result:** state the authoritative output and its threshold relation.
3. **Mechanism:** identify the one or two dominant reasons in model terms.
4. **Qualification:** state the model envelope and most important excluded
   interpretation.
5. **Next discriminator:** name the control, setting, comparison, or source that
   would most usefully test the conclusion.

Example structure, to be filled with domain-correct terms:

> Under **[scenario]**, the model computes **[authoritative result]**, which
> **[meets/does not meet] [criterion]**. The result is driven primarily by
> **[mechanism A]** and **[mechanism B]**. It applies to **[declared model
> envelope]** and does not establish **[prohibited inference]**. To test the
> conclusion, compare **[named discriminator]**.

### 6.3 Put qualifications where the claim is made

Do not hide decisive limitations in a methods drawer or footer. Use three
layers:

- **Adjacent qualification:** one sentence beside the result.
- **Details on demand:** fuller definition, units, sources, and uncertainty in
  a drawer or inspector.
- **Persistent provenance:** model and parameter versions in the footer/export.

Tooltips may define a term; they must not carry the only copy of a scientific
limitation.

### 6.4 Write for decision pressure

- Lead with what changes the decision.
- Prefer mechanisms over flattering adjectives or vague summaries.
- Name the comparator and direction: "lower than X," not "improved."
- Name the threshold: "below 1," not "safe."
- Name the condition: "under the selected envelope," not "in all settings."
- Separate a point result from uncertainty or sensitivity results.
- Say "unavailable" when required evidence or an uncertainty object is absent.
- Say "not modeled" rather than implying a favorable null effect.

### 6.5 Avoid synthetic authority

Do not use these forms unless the scientific contract literally supports them:

- "proves";
- "guarantees" without the adjacent axiom and envelope;
- "real-world impact" for a modeled endpoint;
- "confidence interval" for an unrelated sensitivity range;
- "optimal" when only a searched grid or scalar ranking was used;
- "robust" without naming the perturbations survived;
- "significant" when no inferential test is defined;
- "safe" as shorthand for an out-of-scope safety assessment.

### 6.6 Let the prose respond to interaction

Dynamic writing should be template-driven, not improvised from arbitrary
numbers. Build sentences from tested semantic states:

- threshold side;
- dominant mechanism;
- binding setting corner or envelope region;
- uncertainty availability and rule;
- comparator relation;
- invalid or incomplete scientific state.

Test each state as code. Dynamic prose is part of the result contract.

### 6.7 Structure longer interpretive passages

For a paragraph or explanatory panel, use this internal sequence:

1. **Observation:** the concrete state, pattern, or source-backed fact.
2. **Interpretation:** the narrow meaning assigned to it.
3. **Counterweight:** the strongest boundary, alternative explanation, or
   missing comparator.
4. **Decision implication:** what the user should inspect, compare, or do next.

If the epistemic status changes inside a paragraph, split the paragraph or mark
the transition explicitly. Do not place a mixed evidence-and-inference passage
under a single "Evidence" label.

Longer artifacts should include negative space on purpose: at least one
counterexample, failure mode, excluded mechanism, or unresolved comparator that
could weaken the preferred interpretation. This is not a ritual caveat. Choose
the one that could actually change the decision or claim strength.

### 6.8 Use an exact, non-promotional voice

- Put the claim in the first sentence rather than approaching it through scene
  setting.
- Prefer concrete verbs: computes, conditions, excludes, exceeds, reproduces,
  conflicts, remains unavailable.
- Prefer named mechanisms and quantities to abstractions such as "impact," "the
  landscape," or "complexity."
- Vary sentence length, but keep status and comparator clauses close to the
  claims they limit.
- Do not call every interaction an insight. State what changed and why it
  matters for the declared decision.
- Delete generic transitions such as "It is important to note," "This
  highlights," "At its core," and "In today's rapidly evolving landscape."
- End an interpretive section with a discriminator, residual uncertainty, or
  bounded next action, not a motivational crescendo.

---

## 7. Visual style guide

The visual target is **editorial scientific modernism**: calm, materially
grounded, compact in controls, generous in interpretation, and free of generic
dashboard chrome.

### 7.1 Palette

Use a small, role-based palette. A suitable starting point is:

```css
:root {
  --paper: #f4efe5;
  --panel: #fffdf8;
  --ink: #17201d;
  --muted: #69716d;
  --line: #cfc7b8;

  --accent: #a9562e;       /* selection and editorial emphasis */
  --evidence: #176f69;     /* observed/direct/source-backed */
  --derived: #355f7a;      /* modeled or computed */
  --inference: #a56e16;    /* interpretation */
  --gap: #72546f;          /* missing, invalid, unsupported */

  --pass: #236b56;
  --fail: #9d332b;
  --focus: #2d66b3;
  --shadow: 0 12px 38px rgb(35 31 24 / 10%);
}
```

These values are a starting grammar, not a branding mandate. Before using
them, check contrast in their actual foreground/background pairings.

Rules:

- Use paper and ink for most of the interface.
- Reserve the accent for selection, threshold emphasis, and authored emphasis.
- Give epistemic categories stable colors across prose, plots, legends, and
  exports. Scenario inputs, calibrated parameters, and assumptions may use
  distinct neutral labels rather than forcing every category into a bright hue.
- Do not reuse pass/fail colors for unrelated series.
- Never communicate pass/fail or evidence status through color alone. Pair
  color with text, line style, shape, icon, or pattern.
- Avoid categorical rainbow palettes unless the categories genuinely require
  many distinct hues.

### 7.2 Typography

Use three typographic roles, preferably from system fonts so the artifact
remains self-contained:

- **Serif:** product title, chapter/section claims, interpretive callouts.
- **Sans serif:** controls, axes, legends, metadata, buttons, status labels.
- **Monospace:** values where digit alignment matters, code/field names,
  hashes, versions, dates, and source locations.

Recommended stacks:

```css
--serif: Iowan Old Style, Baskerville, Georgia, "Times New Roman", serif;
--sans: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
--mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
```

Rules:

- Body prose: 17--19 px desktop, 16--17 px narrow, 1.5--1.65 line height.
- Control labels: 11--13 px, high weight, modest letter spacing.
- Axis labels: never below 10 px at rendered/exported size.
- Use `clamp()` for major headings, but cap them before they overwhelm the
  scientific content.
- Use sentence case for most interface copy. Reserve all caps for short
  eyebrows, status tags, and compact metadata.
- Do not use a display typeface merely to signal sophistication.

### 7.3 Spacing and composition

Use a base spacing unit of 4 px, with most layout gaps drawn from:

```text
4, 8, 12, 16, 24, 32, 48, 64, 96
```

Rules:

- Use whitespace to separate interpretive levels, not to float every item in a
  card.
- Use hairline rules and changes in typographic scale before adding containers.
- Group controls by scientific role, not by input widget type.
- Keep labels close to their controls and units inseparable from values.
- Prefer asymmetric editorial layouts to equal-sized dashboard tiles when the
  content has a real hierarchy.
- Use one strong visual field, not many equally loud panels.

### 7.4 Surfaces and depth

- The page background may use a very subtle paper gradient or texture.
- Primary scientific panels should be quiet: panel color, one border, little or
  no shadow.
- Use a strong dark surface for a source/method drawer when it helps distinguish
  inspection from the main reading layer.
- Use shadows only for temporary elevation: drawer, tooltip, command/search
  palette, or selected floating readout.
- Avoid glassmorphism, neon glows, saturated gradients, and stacks of rounded
  cards. Those styles imply product marketing, not scientific inspection.

### 7.5 Borders, radii, and controls

- Default border: 1 px quiet line.
- Strong analytical boundary: 1--4 px ink or accent rule.
- Controls: 4--7 px radius.
- Status tags and compact filters: pill radius is acceptable.
- Analytical panels should not all become rounded cards.
- Use native form controls where they are adequate; style focus, spacing, and
  accent without replacing their accessibility behavior.

### 7.6 Figures

Every scientific figure must answer one explicit question.

Required figure anatomy:

- a question-like title or a declarative takeaway;
- axes with units and basis;
- a direct marker for the selected scenario;
- a visually dominant decision threshold when one exists;
- direct labels for important comparators and anchors;
- a legend only for encodings that cannot be labeled in place;
- an uncertainty/sensitivity description that names what varies;
- a figure-level note distinguishing direct calculations from interpolated or
  display-only values;
- an accessible text summary that updates with the figure.

Chart rules:

- Encode the authoritative output with position before color where possible.
- Use log scales only when scientifically appropriate and label them plainly.
- Keep pass and fail sides perceptually distinct at the threshold.
- Use contour line style, hatching, symbol shape, or annotation in addition to
  fill color.
- Show the selected value at full precision needed for the decision, while
  keeping tick labels readable.
- Do not smooth, interpolate, or animate across values in ways that imply model
  evaluations that were not performed.
- If hover reveals an exact value, keyboard focus must reveal the same value.
- Exported SVG must preserve the threshold, selected point, labels, units,
  scenario identity, and figure note.

### 7.7 Motion

Use motion only to preserve object constancy:

- 160--240 ms for selection and disclosure;
- up to about 420 ms for a meaningful projection or state morph;
- no looping motion in analytical views;
- honor `prefers-reduced-motion`;
- never animate a threshold crossing so slowly that the result appears to pass
  through evaluated intermediate states.

### 7.8 Responsive modes

Do not merely shrink the desktop grid.

**Wide desktop:**

```text
control rail | primary linked views | interpretation / inspector
```

**Tablet:**

```text
compact controls | primary view
                 | inspector below or in drawer
```

**Narrow/mobile:**

```text
question
result sentence + status
primary controls
primary figure
interpretation
secondary figure(s)
assumptions / sources / export
```

At narrow widths:

- convert persistent side rails into anchored sections or drawers;
- retain the authoritative result near the top;
- avoid horizontal chart scrolling when reflow or a focused small multiple is
  possible;
- keep touch targets at least 44 by 44 CSS pixels where practical;
- never hide a scientific qualification solely to save space.

---

## 8. Interaction components and their contracts

### 8.1 Summary strip

The summary strip is the result, not a row of vanity metrics. It should include:

- current scenario/preset;
- authoritative metric and threshold relation;
- explicit status text;
- uncertainty or sensitivity rule;
- one key derived diagnostic if it explains mechanism;
- a nearby qualification.

Avoid more than three large numbers. If every output is promoted, none is
authoritative.

### 8.2 Primary controls

Show only controls that support the first consequential comparison. Each
control must have:

- a plain-language label;
- scientific symbol only as secondary text;
- displayed unit and basis;
- valid domain;
- definition;
- source/status classification;
- current value;
- reset behavior;
- a test showing every dependent output invalidates and recomputes.

Use named presets to teach the model space. A preset selection should remain
named only while all defining values match it; otherwise display "Custom."

### 8.3 Advanced controls

Advanced controls are not a dumping ground. Group them by mechanism or setting,
and state why a user would open each group. Fixed parameters belong in a
read-only assumptions table unless the contract explicitly makes them inputs.

### 8.4 Inspector or source drawer

Use one persistent inspector or dismissible drawer for:

- definition and units;
- source/provenance;
- model role;
- uncertainty coverage;
- neighboring/comparator scenarios;
- diagnostics;
- exact values and export identifiers.

The drawer must preserve the scenario and reading position. On open, move focus
deliberately; on close, return focus to the invoking control.

### 8.5 Evidence/status lens

For interpretive sections, allow users to distinguish or filter:

- observed/source evidence;
- selected scenario input;
- calibrated parameter;
- assumption or fixed convention;
- modeled/derived result;
- interpretation or decision rule;
- limitation/gap.

Dimming is safer than deleting when absence could be mistaken for lack of
content. If filtering hides content, announce the count and make the active
filter unmistakable.

### 8.6 Search or command palette

Search is useful when the artifact contains many scenarios, sources,
definitions, or chapters. It should search curated labels and visible source
metadata, return short contextual results, and move the user to the relevant
state without resetting the scenario.

### 8.7 Export and share

Treat export as a scientific feature.

- A URL must restore the canonical scenario or show a visible invalid-state
  warning.
- JSON must contain schema version, scenario, outputs, model/parameter versions,
  and identity/hash fields required to reproduce the result.
- CSV must name dimensions, units, and whether cells are direct evaluations or
  display products.
- SVG must be understandable outside the app.
- Export controls must state whether they export the selected scenario, the
  displayed grid, or the full configured envelope.

---

## 9. Recommended technical architecture

### 9.1 Runtime posture: usually no backend

For a deterministic scientific widget, the preferred "backend" is a
**build-time data and verification pipeline**, not a runtime web service.

Default architecture:

```text
source data / reference models
        |
        v
validated build-time transforms and fixtures
        |
        v
versioned manifests + pure browser model
        |
        v
UI state adapter -> linked figures / prose / exports
        |
        v
one deterministic self-contained HTML artifact
```

Benefits:

- reproducibility and offline use;
- no server, account, telemetry, or runtime availability dependency;
- a stable release artifact that can be hashed and audited;
- simpler security and privacy boundaries;
- exact correspondence among displayed, shared, and exported state.

Add a runtime backend only when the product truly requires authenticated data,
collaboration, data too large to ship, secret computation, or server-owned
state. Do not add one to compensate for an unclear client architecture.

### 9.2 Default toolchain for this class of artifact

- **TypeScript** for model contracts, UI, serialization, and exports.
- **Node.js** scripts for build orchestration and artifact checks.
- **D3 modules** for scales, axes, contours, geometry, and formatting; do not
  adopt a hosted chart service.
- **SVG** for semantic scientific figures and exportable charts.
- **Canvas** only for genuinely dense fields where SVG element count becomes a
  problem; provide an accessible DOM mirror.
- **esbuild** for deterministic bundling.
- A small custom inliner to embed bundled JavaScript, CSS, manifests, and data
  into the final HTML.
- The **native Node test runner** for pure-model and serialization tests.
- **Playwright** for browser, keyboard, responsive, export, and console-error
  smoke tests.
- **Python through `uv`** only when an offline extraction, validation, or
  scientific preprocessing task is substantially clearer in Python. Python is
  not the runtime browser model.

Do not add a UI framework by reflex. For one bounded instrument with a clear
state model, browser-native TypeScript and explicit render functions often make
scientific dependencies easier to audit. If a local contract already locks the
stack, follow it.

### 9.3 Layer ownership

Use hard boundaries:

| Layer | Owns | Must not own |
|---|---|---|
| Reference/preprocessing | source extraction, calibration, fixtures, manifests | runtime DOM |
| Pure scientific model | equations, units, validation, scenarios, outputs | chart geometry or prose DOM |
| State/serialization | canonical scenario, URL, migrations, cache identity | scientific formulas |
| Presentation adapter | view models, labels, formatting, epistemic status | independent recalculation |
| UI/rendering | controls, figures, focus, responsive layout | duplicated scientific logic |
| Export | serialization and figure packaging from canonical state | alternate result definitions |

The UI may format a model result; it may not rederive it.

### 9.4 Canonical state

Maintain one canonical, serializable application state with an explicit schema.
Separate:

- **scientific state:** changes outputs;
- **view state:** zoom, open tab, active lens, hovered item;
- **release identity:** model, parameters, grid, ensemble, and app version.

Only scientific state belongs in result identity. Include view state in the URL
only when restoring it improves communication and cannot be confused with a
scientific input.

Required properties:

- reject unknown or nonfinite imported fields;
- validate units and domains before evaluation;
- use explicit migrations, never permissive aliases;
- sort keys for canonical serialization;
- exclude `NaN`, `Infinity`, and locale-dependent number strings;
- show a visible warning when URL/import state is invalid;
- never silently clamp invalid scientific state unless an equation explicitly
  defines the clamp.

### 9.5 Rendering choice

Use SVG when:

- elements are meaningful and should be focusable;
- export quality matters;
- there are hundreds, not tens of thousands, of marks;
- axes, contours, annotations, and labels dominate.

Use Canvas when:

- the field has thousands of points or continuous redraw during pan/zoom;
- per-mark DOM cost is material;
- an accessible list or alternative table can mirror selection.

Do not use Canvas because it feels more custom. Do not use SVG for a dense field
that becomes unresponsive.

### 9.6 Performance

Optimize meaningfully:

1. precompute invariant kernels or layouts;
2. memoize by canonical scientific-state identity;
3. render only dependent views;
4. batch DOM changes;
5. cap device-pixel ratio for large canvases;
6. consider workers only after profiling;
7. require a parity test for every approximation.

Do not debounce a result so aggressively that a control and displayed answer
feel disconnected. During continuous slider input, it is acceptable to render a
lightweight preview and commit the authoritative calculation on a defined
event, but the preview must be labeled as such.

### 9.7 Security and privacy

For self-contained or private artifacts:

- issue no runtime network requests;
- embed no analytics, telemetry, remote fonts, or hosted libraries;
- define a restrictive Content Security Policy when feasible;
- serialize embedded JSON so source text cannot terminate a script element;
- render untrusted text with `textContent`, not raw HTML;
- keep private source paths and content out of public builds;
- make artifact privacy/release status visually persistent when consequential;
- test that exported or copied content does not include hidden private fields.

---

## 10. Scientific figures as an argument

Do not choose charts independently. Assign each figure a role in the user's
reasoning.

### 10.1 A strong three-question sequence

1. **What is enough?**
   - Primary requirement/frontier view.
   - Shows criterion, passing side, selected candidate, and comparators.
2. **Why does it pass or fail?**
   - Mechanistic decomposition.
   - Separates distinct causal/model pathways rather than compressing them into
     a shared index.
3. **Where does that conclusion hold?**
   - Setting or sensitivity surface.
   - Shows named anchors, modeled envelope, threshold contour, and binding
     region.

Keep this order even if the figures are displayed side by side. Visual order
and tab order should follow the argument.

### 10.2 Linked views

Linked views must share:

- the same canonical scenario;
- the same selected candidate;
- consistent comparator styling;
- consistent threshold semantics;
- consistent number formatting;
- one hover/focus identity;
- one export identity.

A selection in one view should visibly identify the corresponding object in the
others. A hover may be transient; a click or keyboard activation should create a
persistent selection.

### 10.3 A decomposition is not a second scorecard

The decomposition exists to prevent category error. Show distinct mechanisms
in their native quantities. If a scalar summary is included, label it as a
diagnostic and keep the authoritative outcome visually stronger.

### 10.4 A setting surface is not wallpaper

The setting view must reveal where the decision changes. Include:

- exact axes and units;
- direction of increasing pressure;
- named anchors and their provenance class;
- the threshold contour;
- selected setting or envelope;
- the direct decision value if the raster is interpolated;
- a clear statement of what setting dimensions are held fixed.

---

## 11. Accessibility is part of scientific fidelity

Accessibility is not a release polish step. It is a test that the interaction
has an intelligible structure independent of its visual surface.

Required:

- semantic landmarks, heading order, labels, and buttons;
- visible `:focus-visible` states;
- complete keyboard operation for controls, figures, drawers, and tabs;
- accessible names that include scientific quantity and unit where useful;
- a live textual result summary after committed scientific state changes;
- an accessible table/list mirror for Canvas content;
- hover information also available by focus and touch;
- status encoded with text and shape/style, not color alone;
- reduced-motion support;
- sufficient contrast in default, selected, disabled, and dimmed states;
- focus containment and restoration for modal/drawer surfaces;
- no essential content created only with CSS pseudo-elements;
- usable layout at 200% zoom and the contract's minimum width.

For a figure, provide a concise text alternative that answers:

1. what is plotted;
2. what the selected state is;
3. where it sits relative to the criterion;
4. what uncertainty/sensitivity is shown;
5. where exact data can be obtained.

---

## 12. Build sequence for a less design-experienced model

Follow this order. Do not start by styling the final chart.

### Phase 1: meaning

1. Read the authoritative contract and schemas.
2. Complete the artifact contract in Section 4.
3. Inventory every displayed quantity with:
   - name;
   - scientific role;
   - unit and basis;
   - source/status;
   - valid domain;
   - uncertainty coverage;
   - owning model output;
   - intended display precision.
4. Write the five-sentence result block for:
   - clear pass;
   - clear fail;
   - threshold tie if relevant;
   - unavailable uncertainty;
   - invalid input/state.
5. Identify the prohibited inference and place its qualification beside the
   primary result in the wireframe.

**Gate:** another reviewer can distinguish authoritative outcome, diagnostics,
assumptions, and gaps without looking at code.

### Phase 2: information architecture

1. Draw the first viewport as plain boxes and text.
2. Assign one question to each figure.
3. Reduce primary controls to the smallest useful set.
4. Put remaining inputs into named advanced groups.
5. Define desktop, tablet, and narrow order.
6. Define focus order and drawer behavior.

**Gate:** a user can follow the path "answer -> why -> where -> source ->
export" without backtracking or losing state.

### Phase 3: data and state

1. Define the canonical scenario and output schemas.
2. Implement validation and invalid-state behavior.
3. Implement canonical serialization and URL round trip.
4. Define scientific-state dependencies for each output surface.
5. Implement pure model calls and view-model adapters.

**Gate:** the same canonical state produces the same outputs under tests and in
the browser; the UI contains no scientific equations.

### Phase 4: figures without polish

1. Render axes, units, threshold, passing side, selection, and comparators.
2. Link hover, focus, and persistent selection.
3. Add text alternatives and exact readouts.
4. Verify direct model values against selected plotted cells/points.
5. Verify all figure states with monochrome or grayscale.

**Gate:** the decision remains legible without decorative color or animation.

### Phase 5: visual system

1. Apply typography roles and tokenized colors.
2. Establish spacing hierarchy and remove unnecessary cards.
3. Add only meaning-preserving motion.
4. Tune labels and annotation collisions at target sizes.
5. Verify wide, tablet, 360 px, 200% zoom, and print/export layouts.

**Gate:** visual hierarchy matches scientific hierarchy.

### Phase 6: interpretive layer

1. Bind result prose to tested semantic states.
2. Add adjacent qualifications.
3. Add definitions, methods, sources, and diagnostics to the inspector.
4. Add evidence/status distinctions to longer prose.
5. Add provenance, release status, and version information.

**Gate:** no sentence implies a broader estimand, population, setting, or
certainty than the displayed state supports.

### Phase 7: export and verification

1. Implement JSON, CSV, and figure exports required by the contract.
2. Verify URL and import/export round trips.
3. Run interaction, keyboard, console, responsive, and offline tests.
4. Rebuild twice and compare the artifact.
5. Audit network requests and external assets.
6. Review the final artifact against the fatal defects and rubric below.

**Gate:** every displayed result can be reproduced from an exported or shared
canonical scenario and versioned inputs.

---

## 13. Verification matrix

### 13.1 Meaning and scientific state

- Every scientific control maps to one schema field.
- Every displayed output maps to one pure-model output or declared formatting
  transform.
- Units are tested at the UI/model boundary.
- Invalid scientific state fails closed with an actionable message.
- Comparator definitions do not change when hypothetical-product controls move.
- Threshold equality behavior is tested.
- Point, range, and uncertainty results are not relabeled as one another.
- The primary status uses the authoritative result, not a plotted interpolation.
- Dynamic prose is tested for each semantic branch.

### 13.2 Interaction

- Reset restores the versioned default.
- Named presets become Custom after any defining edit.
- All dependent views update after every scientific input.
- View-only actions do not change exports or result identity.
- Hover, keyboard focus, and click selection agree.
- Drawers and modals preserve scenario state and restore focus.
- Browser back/forward behavior is intentional.
- Invalid URL state is visible and unevaluated until resolved.

### 13.3 Visual and responsive

- The authoritative result is identifiable in five seconds.
- Threshold and passing side remain legible in grayscale.
- No axis label, legend, tooltip, or annotation is clipped.
- No text is smaller than the defined minimum.
- Narrow layout preserves question, result, qualification, and primary figure.
- 200% zoom does not obscure controls or trap content.
- Long labels and extreme formatted values do not break layout.
- Reduced motion removes nonessential transitions.

### 13.4 Artifact and reproducibility

- No runtime network dependency.
- No external script, style, font, image, or data request when self-contained
  delivery is required.
- No console error during load or a scripted interaction sweep.
- Repeated clean builds are byte-stable when the contract requires it.
- JSON and CSV include schema/version/unit metadata.
- SVG exports contain the scenario and decision context needed to interpret them.
- Build/version/manifest identity is visible and exported.
- Private or non-release fields are absent from public artifacts.

---

## 14. Common failure modes and repairs

### Failure: the control wall

**Symptom:** the first viewport is mostly sliders and selects.

**Repair:** restore a meaningful default result, keep only the first three to
five consequential controls visible, and move fixed/advanced state into named
groups or an assumptions inspector.

### Failure: metric soup

**Symptom:** several large numbers compete without a declared authoritative
output.

**Repair:** choose one primary status and demote mechanism metrics to a labeled
decomposition.

### Failure: dashboard-card monoculture

**Symptom:** every sentence, number, and chart floats in an equal rounded card.

**Repair:** rebuild hierarchy with type scale, rules, whitespace, and one strong
visual field. Use containers only for real functional groups.

### Failure: caveat cemetery

**Symptom:** accurate limitations exist only in a collapsed methods section.

**Repair:** put the decision-changing qualification beside the result, then
link to details.

### Failure: tooltip epistemology

**Symptom:** observed, assumed, calibrated, and derived quantities look the
same until hovered.

**Repair:** use persistent status labels or an assumptions table; tooltips add
definition, not category.

### Failure: color carries the decision

**Symptom:** green and red regions have no textual, line-style, or shape cue.

**Repair:** add threshold labels, passing-side text, contour styles, and explicit
status copy; verify in grayscale.

### Failure: animated false precision

**Symptom:** smooth interpolation looks like evaluated model behavior.

**Repair:** animate only object identity or use discrete transitions; label any
display interpolation and keep direct values authoritative.

### Failure: prose that re-computes science

**Symptom:** UI code infers pass/fail or dominant mechanism independently from
raw inputs.

**Repair:** return semantic flags and decomposed outputs from the pure model or a
single tested presentation adapter.

### Failure: source theater

**Symptom:** a citation icon exists, but it opens a vague reference or cannot
show which claim the source supports.

**Repair:** attach source, location, status, and note to the exact quantity or
claim; distinguish provenance from validation.

### Failure: hidden invalid state

**Symptom:** malformed URL/import data silently becomes defaults.

**Repair:** fail closed, show the invalid fields, and offer an explicit reset to
the versioned default.

### Failure: polish before contract

**Symptom:** the interface looks finished while threshold semantics, uncertainty,
or unit basis remain unresolved.

**Repair:** stop styling, complete the artifact contract, and add discriminating
tests before continuing.

---

## 15. Fatal defects

Any one of these blocks release regardless of visual quality:

- a scientific result is computed or modified in UI code;
- the visible result and exported result can disagree;
- invalid scientific state is silently clamped or defaulted;
- the artifact implies a broader population, setting, safety claim, or causal
  claim than the model supports;
- a diagnostic summary controls the decision when the contract names a
  different authoritative endpoint;
- a comparator changes with hypothetical-product controls;
- uncertainty language does not match the actual uncertainty object;
- pass/fail is available only by color;
- the primary workflow cannot be completed by keyboard;
- a self-contained artifact makes undeclared runtime requests;
- a shared URL does not restore or visibly reject the scenario;
- a clean build cannot reproduce the released artifact;
- provenance or release status is materially misleading.

---

## 16. Quality rubric

Score each dimension from 0 to 4. A release candidate should score at least 3
in every dimension and 28/32 overall, with no fatal defect.

| Dimension | 0 | 2 | 4 |
|---|---|---|---|
| **Decision clarity** | No primary question/result | Result exists but competes | Question, answer, criterion, and next test are immediate |
| **Scientific fidelity** | UI blurs semantics | Mostly correct with weak boundaries | Roles, units, thresholds, and uncertainty are explicit and tested |
| **Interpretive honesty** | Polished overclaim | Caveats exist but are remote | Claim, qualification, gap, and discriminator are adjacent |
| **Visual hierarchy** | Generic dashboard/no hierarchy | Attractive but panel-heavy | Visual emphasis exactly tracks scientific importance |
| **Interaction coherence** | Views drift or reset | Basic linking works | All surfaces share one state and preserve orientation |
| **Accessibility** | Pointer/color dependent | Common controls work | Keyboard, text alternatives, focus, contrast, and narrow layout are complete |
| **Reproducibility** | Display cannot be reconstructed | Partial export/state | URL, exports, versions, hashes, and deterministic build agree |
| **Technical restraint** | Unnecessary stack/backend | Mostly appropriate tools | Small auditable stack, pure model boundary, offline artifact |

### Required review questions

Before release, the implementation model must answer in writing:

1. What would a user be most likely to over-interpret?
2. Where does the interface prevent that interpretation?
3. Which visual object is authoritative at a threshold disagreement?
4. Which uncertainty sources are included and excluded?
5. Which controls change science and which change only the view?
6. Can a user reconstruct the displayed result from the exported state?
7. What breaks first at 360 px, 200% zoom, or keyboard-only use?
8. What complexity was deliberately *not* added?

---

## 17. Concrete pattern for a frontier-based scientific tool

For a tool whose primary result is a sufficiency frontier across product and
setting dimensions, use this structure:

### Top bar

- short product name;
- prototype/release status;
- named scenario or Custom;
- Reset, Share, Export;
- version/provenance entry point.

### Result strip

- exact criterion status in words;
- authoritative direct result;
- selected success/uncertainty rule;
- derived diagnostic, visually secondary;
- one-sentence model-envelope qualification.

### Primary workspace

**Left:** compact controls grouped as Setting, Schedule, and Product.

**Center:** linked requirement and product-design maps visible together. Both
show the threshold, passing side, selected candidate, and fixed comparators.

**Right:** interpretation inspector with tabs such as Result, Why, Assumptions,
and Sources. The Result tab uses the five-sentence result block.

### Secondary analytical section

- setting surface answering "where does this hold?";
- named anchors and selected envelope;
- mechanistic decomposition answering "why?";
- direct explanation of which summary metrics are diagnostic rather than
  authoritative.

### Methods/provenance section

- observed/calibrated/assumed/derived parameter table;
- uncertainty coverage and absent ensembles/data;
- model scope and prohibited inference;
- source and parameter versions;
- export definitions;
- release and verification status.

### Narrow order

On mobile, preserve this exact reasoning sequence:

```text
status -> result -> qualification -> primary controls -> requirement map
-> product map -> why -> setting surface -> assumptions -> export
```

Do not place advanced controls between the two linked primary maps.

---

## 18. Handoff brief for an implementation model

The following can be copied into a task brief for a Terra- or Luna-class model.
Fill the bracketed fields from the authoritative local contract.

```text
Build a deterministic scientific web instrument, not a generic dashboard.

Decision purpose:
[one sentence]

Primary question:
[one question]

Authoritative result and criterion:
[exact output, threshold, rule, tie behavior]

Prohibited inference:
[the tempting claim the model does not support]

Required flow:
1. Show the default scenario and authoritative answer immediately.
2. Let the user change only the primary consequential controls.
3. Update result, figures, interpretation, uncertainty, URL, and export state
   as one transaction.
4. Let the user inspect why the result occurs.
5. Let the user inspect where it holds over the declared envelope.
6. Keep assumptions, sources, uncertainty coverage, and gaps one action away.
7. Export a complete, versioned, reproducible scenario and figures.

Visual posture:
- editorial scientific modernism;
- warm light background, dark ink, one restrained accent;
- serif for authored claims, sans for UI, mono for exact metadata;
- one dominant analytical field, not equal card tiles;
- color is role-based and never the only status encoding;
- restrained motion used only for object constancy;
- purpose-built desktop, tablet, and 360 px layouts.

Architecture:
- pure scientific model behind a serializable schema;
- no scientific formulas in UI code;
- canonical separation of scientific state, view state, and release identity;
- TypeScript + local D3 modules + SVG by default, Canvas only for dense fields;
- deterministic esbuild bundle and self-contained HTML when required;
- no runtime network dependency or silent defaults;
- Node tests for model/state and Playwright for browser/accessibility/artifact
  behavior;
- use Python only through uv for justified offline preprocessing.

Writing:
- distinguish observed evidence, scenario input, calibrated parameters,
  assumptions/fixed conventions, derived result, interpretation/decision, and
  gap;
- use scenario -> result -> mechanism -> qualification -> discriminator;
- put the decision-changing qualification beside the result;
- never broaden the endpoint, population, setting, or uncertainty semantics;
- dynamic prose must be template-driven and branch-tested.

Before implementation, return:
1. the completed artifact contract;
2. the quantity/status inventory;
3. a text wireframe for wide and narrow layouts;
4. the state dependency map;
5. the semantic branches for result prose;
6. the verification plan.

Stop rather than guess if threshold semantics, units, comparator ownership,
uncertainty meaning, authoritative output, or model/view state are unclear.

Release only after the fatal-defect audit and quality rubric pass.
```

---

## 19. Final principle

The sophistication of a scientific interactive does not come from the number
of charts, the novelty of the layout, or the smoothness of its animation. It
comes from maintaining a disciplined correspondence:

```text
scientific state
    -> authoritative result
    -> visual hierarchy
    -> interpretive claim
    -> visible qualification
    -> reproducible export
```

Every break in that chain creates a place where polish can outrun meaning.
Keep the chain intact, and a relatively small, framework-free, self-contained
artifact can communicate with unusual depth.

---

## Reference artifacts used to derive this guide

- `/Users/famulare/git/famulare/fermi-knowledge-base/special_projects/fermi-atlas/dist/fermi-atlas.html`
- `/Users/famulare/git/famulare/fermi-knowledge-base/special_projects/fermi-atlas/design-contract.md`
- `/Users/famulare/git/famulare/IDM-archival-recovery/private/exhibits/the-work-between-messages.html`

The first reference informed the instrument, linked-state, representation,
diagnostic, accessibility, and deterministic-build guidance. The second
informed the editorial hierarchy, evidentiary-status, source-drawer,
interpretive-writing, limitation-ledger, and authored-user-flow guidance.
