# Contract 2.1 immune-response teaching implementation

**Status:** ready for implementation after integrator review.

**Intended executor:** Claude Opus 4.8, working as a bounded implementation
agent. The primary integrator owns semantic review, test review, merge, and
release disposition. The executor must not amend the contract or reinterpret a
scientific choice.

## Decision purpose

Teach vaccine-development readers how a received OPV-like dose becomes a
distribution of immunity at assessment age:

1. a received live dose may or may not take in each pre-dose immunity bin;
2. successful take produces a distributed immune response whose maximum mean
   and maximum SD are controlled by `mu0` and `sigma0`;
3. immunity wanes between scheduled events; and
4. repeated take/no-take, boost, recombination, and waning operations build the
   cohort distribution used by the later WPV acquisition and shedding model.

For Sabin OPV and the hypothetical OPV-like product, the page may visualize
the modeled OPV-equivalent mucosal coordinate as a one-to-one
serum-equivalent neutralizing titer. This is an explicit non-mechanistic
correlate convention. The downstream model still uses mucosal immunity. IPV
must remain an explicit exception.

This work supports comprehension of the existing model. It does not create a
new endpoint, assay prediction, clinical target, mechanistic immune model, or
success rule.

## Requested output

Implement the contract-2.1 teaching sequence:

```text
02 / received dose and biological take
-> vaccine take figure
-> 03 / immune response and schedule composition
-> two-panel immune-response figure
-> assessment-age distribution figure
-> 04 / explore the product and schedule
-> existing controls
-> 05 / close-contact transmission
-> remaining chapters, renumbered in display only
```

The new two-panel figure must be deterministic, responsive, printable,
keyboard-readable in DOM order, exported as standalone SVG, and driven by a
versioned pure-model diagnostic. It must update through the existing live
preview and debounced auto-commit paths.

## Contract surface

Read these sections before editing:

- `DESIGN_CONTRACT.md` introduction and contract-2.1 amendment;
- Sections 5, 6.1-6.3, 7.1-7.5, 8.1-8.3;
- Sections 13, especially 13.1-13.4, 13.8, and 13.9;
- Sections 14.2-14.6, 15.3, 15.6, 16, 17, and 18.4-18.6, 18.18, 18.20-18.22.

Read these implementation files before changing code:

- `src/model/types.ts`
- `src/model/bins.ts`
- `src/model/dose-response.ts`
- `src/model/waning.ts`
- `src/model/schedule.ts`
- `src/model/diagnostics.ts`
- `src/model/model.ts`
- `src/model/serialization.ts`
- `src/model/manifest-validation.ts`
- `src/model/parameters.ts`
- `src/data/parameters.json`
- `src/ui/charts.ts`
- `src/ui/presentation.ts`
- `src/app.ts`
- `src/styles.css`
- `tests/model/model.test.ts`
- `tests/ui/presentation.test.ts`
- `scripts/browser-smoke.mjs`
- `scripts/build.mjs`
- `README.md`
- `IMPLEMENTATION_LOG.md`

Prototype reference for visual logic only:

- `https://famulare.github.io/typhoid-immune-dynamics/blog/2025/04/25/a-view-over-the-horizon-cohort-incidence-model/`

Do not copy the typhoid equations, parameters, labels, or individual-level
trajectory semantics. The relevant prototypes are the pre-response/fold-rise
view and the repeated-event rise-and-wane view. The polio implementation must
use the exact contract-2.1 distribution-native equations.

## Binding scientific and data invariants

1. **No scientific equation changes.** Reuse the existing take, boost, bin
   projection, and waning operators.
2. **One schedule engine.** Production state and teaching trace must pass
   through the same transition loop and dose-transition helper. Do not
   duplicate the schedule algorithm in diagnostics or UI code.
3. **Distribution-native propagation.** Never update an "average child."
   Every state transition operates on `ImmuneState.groups` and all 16 bins.
4. **Bin-specific take.** Aggregate take shown for a dose is a diagnostic sum
   over the same bin- and group-specific take weights used by the transition.
   It may not be calculated from mean immunity.
5. **Mass conservation.** Every trace snapshot must sum to one within `1e-12`.
6. **Final-state identity.** The trace's final assessment distribution must
   equal `combinedMucosal(buildScheduleState(...))` and the existing vaccinated
   diagnostic distribution within `1e-12`.
7. **Serum-equivalent display is bounded.** Apply it only when
   `vaccine.live === true`, currently Sabin OPV and the hypothetical OPV-like
   product. It is a display mapping, not a new computational state.
8. **IPV is not collapsed.** When IPV is selected, do not call its mucosal
   distribution serum-equivalent and do not display a live-vaccine take or
   taking-dose boost curve. State that serum boosting does not map one-to-one
   to mucosal transmission immunity in a live-virus-naive recipient.
9. **Transmission remains mucosal.** The new diagnostics never feed into
   acquisition, shedding, transmission, frontier, or verdict calculations.
10. **Response variation is not uncertainty.** A `mean +/- one modeled SD`
    band describes the conditional response kernel before bin projection. Do
    not label it confidence, credible, posterior, parameter uncertainty, or a
    population central interval.
11. **No assay claim.** Never describe a modeled titer distribution as measured
    serum data or a prediction for a named assay.
12. **Fixed comparators remain fixed.** Do not expose Sabin or IPV parameters
    as hypothetical controls.
13. **No new dependency, runtime request, randomness, or compatibility alias.**
14. **No output drift.** Default `R_loc`, frontier counts, comparator outputs,
    calibration fixtures, and scientific cache identity must remain unchanged
    except for intentional schema/manifest identity changes required to carry
    the new read-only diagnostic.

## Required diagnostic design

### Types

Add explicit types in `src/model/types.ts`. Names may vary only if semantics
remain equally explicit. Prefer:

```ts
interface BoostResponsePointV1 {
  preStateLog2: number;
  meanShiftLog2: number;
  responseCenterFoldRise: number;
  postMeanLog2: number;
  postSdLog2: number;
  postVarianceLog2Squared: number;
  bandLowLog2: number;
  bandHighLog2: number;
}

type ScheduleTracePhase =
  | "initial"
  | "pre-dose"
  | "post-dose"
  | "assessment";

interface ScheduleTraceSnapshotV1 {
  sequence: number;
  day: number;
  phase: ScheduleTracePhase;
  doseNumber: number | null;
  label: string;
  mucosalBins: number[];       // length 16, sums to one
  meanStateLog2: number;       // display summary only
}

interface ScheduleDoseDiagnosticV1 {
  doseNumber: number;
  day: number;
  aggregateTakeProbability: number | null; // null for IPV
}

interface ImmuneResponseDiagnosticsV1 {
  schemaVersion: "ImmuneResponseDiagnosticsV1";
  displayMapping:
    | "serum-equivalent-live-opv-like"
    | "mucosal-only-ipv";
  responseCondition:
    | "conditioned on successful live-vaccine take"
    | "not applicable to non-live IPV";
  boostResponse: BoostResponsePointV1[] | null;
  scheduleSnapshots: ScheduleTraceSnapshotV1[];
  doseDiagnostics: ScheduleDoseDiagnosticV1[];
}
```

Attach `ImmuneResponseDiagnosticsV1` to the versioned teaching diagnostics.
Because the serialized diagnostic shape changes, bump
`WithinHostDiagnosticsV1` to `WithinHostDiagnosticsV2`; do not silently add
keys while retaining the V1 discriminator. `ModelOutputsV1` and `ScenarioV1`
may retain their names because their top-level contracts already contain a
versioned nested diagnostic.

### Shared schedule transition

Refactor `src/model/schedule.ts` conservatively:

1. Extract the body of `applyDose` into one private or exported helper that
   returns:

   ```ts
   {
     state: ImmuneState;
     aggregateTakeProbability: number | null;
   }
   ```

2. For live vaccines, calculate the aggregate as:

   ```text
   sum over incoming groups:
     group.mass * sum over bins(group.mucosal[bin] * p_take(group, bin))
   ```

   Use the same already-calculated take weights as the transition. Do not call
   a second approximation.

3. For IPV, return `null`; IPV has no live-vaccine take coordinate.
4. Keep public `applyDose(state, vaccine): ImmuneState` as a thin wrapper over
   the shared helper if existing callers require that signature.
5. Implement a single internal schedule runner with a `collectTrace` option, or
   equivalent design, so:
   - `buildScheduleState` runs without allocating trace snapshots in frontier
     loops;
   - `buildScheduleTrace` uses the identical event loop while recording
     snapshots;
   - both return the same final state.
6. Record snapshots:
   - initial state at day 0;
   - immediately before every dose, after exact waning to the dose day;
   - immediately after every dose;
   - assessment after exact waning from the last dose.
7. Keep same-day pre/post snapshots ordered with the integer `sequence`. Do not
   sort phases alphabetically.
8. Snapshot only cloned/immutable values; later state changes must not mutate
   earlier snapshots.

Do not make `buildScheduleState` call a trace-building function that allocates
all snapshots for every point in the 51 x 51 frontier. That would add avoidable
cost to the dominant model loop.

### Boost-response diagnostic

Build Panel A data in `src/model/diagnostics.ts` or a narrow pure helper in
`src/model/bins.ts`; do not calculate scientific coordinates in
`src/ui/charts.ts`.

For each integer `x` from 0 through 15:

```text
scale       = max(0, 1 - x / 15)
mean_shift  = vaccine.mu0 * scale
fold_rise   = 2^mean_shift
post_mean   = min(15, x + vaccine.mu0 * scale)
post_sd     = vaccine.sigma0 * scale
variance    = post_sd^2
band_low    = max(0, post_mean - post_sd)
band_high   = min(15, post_mean + post_sd)
```

Return `null` rather than a fabricated curve for IPV. This plotted curve is
conditioned on successful live-vaccine take and summarizes the Gaussian before
projection into bins. `fold_rise` is the response-center fold rise implied by
the additive log2 operator; it is not an arithmetic mean titer response and
does not import the typhoid prototype equation.

### Serialization and validation

Update `src/model/serialization.ts` with strict exact-key validation:

- require the V2 diagnostic schema;
- validate all enum strings and exact units/conditioning strings;
- require 16 boost points for a live vaccine and `null` for IPV;
- require each `preStateLog2` to equal its index 0-15;
- recompute mean shifts, response-center fold rises, boost means, SDs,
  variances, and clipped display bands from the selected vaccine and compare
  within `1e-12`;
- validate snapshot phases, sequence, finite days, 16 bins, nonnegative mass,
  mass sum, and mean summary;
- require snapshot days/phases to match the selected schedule exactly;
- validate live take values in `[0, 1]` and IPV values as `null`;
- require the final assessment snapshot to match
  `diagnostics.vaccinated.immunityBins`;
- preserve strict rejection of unknown keys and stale identities.

If diagnostic data participates in the hashed scientific identity, add only
the necessary version identifier. Do not cause the read-only trace values to
feed into the model calculation or frontier cache key.

## Required interface design

### Chapter 02 -- received dose and biological take

In `src/app.ts`:

- change the current product chapter heading to `02 / Received dose`;
- retain the receipt/take distinction and the take/no-take pathway;
- keep the selected-product summary and existing vaccine dose-response figure;
- end with a sentence that only the take branch is boosted;
- remove the final immunity distribution and controls from this chapter.

Do not say that `take_context` is coverage or dose receipt.

### Chapter 03 -- immune response and schedule composition

Add a new semantic `<section>` with its own id and heading. Required content:

- define `n` as the modeled OPV-equivalent immune coordinate;
- for a live product, state the one-to-one serum-equivalent correlate
  convention and its non-mechanistic limitation;
- explain `mu0`, fixed `sigma0`, diminishing boost at high prior immunity, the
  bin-15 cap, projection to all 16 bins, and the exact waning concept;
- explain repeated composition without an average-child shortcut;
- render the new two-panel figure;
- then render the existing assessment-age distribution figure and caption it
  as the distribution supplied to WPV calculations.

Required nearby live-product wording:

> OPV-equivalent immune titer, visualized as a serum neutralizing correlate and
> mapped one-to-one to mucosal immunity for this live-vaccine pathway.

> Serum titer is a non-mechanistic correlate here. The WPV model uses the
> corresponding mucosal state; the figure is not a prediction of a particular
> serum assay distribution.

Minor copy edits are permitted for readability only if all meanings remain.

For IPV, replace the live mapping paragraph with a visible comparator-specific
explanation. Do not merely hide the qualification in a tooltip.

### Two-panel SVG

Add one renderer in `src/ui/charts.ts`, following the existing paired
desktop/mobile SVG pattern:

```ts
renderImmuneResponseTeaching(view: TeachingView): string
```

It must return a desktop SVG and a mobile SVG with unique IDs and
`aria-labelledby` references.

**Panel A**

- x and y domains are 0-15;
- draw the no-change diagonal;
- draw the exact post-mean line;
- draw the SD ribbon behind the line;
- label the ribbon `one modeled SD before bin projection`;
- show selected `mu0` and `sigma0`;
- explain that response variance is `post_sd^2`;
- label the implied response-center fold rise
  `2^(mu0 * (1 - pre-state / 15))` without presenting it as an arithmetic mean
  serum titer;
- state `conditional on successful take`;
- do not use uncertainty vocabulary;
- for IPV, show a deliberate explanatory not-applicable panel rather than a
  zero-valued live-response curve.

**Panel B**

- use schedule snapshots in `sequence` order;
- preferred encoding: a heatmap with snapshot/event columns and immunity bins
  as rows, color representing cohort probability;
- label birth, each dose, any booster, and assessment;
- visually distinguish pre-dose and post-dose columns;
- annotate waning intervals between event ages;
- show aggregate take for each live dose in accessible text or compact labels;
- any mean-state overlay must be visually secondary and labeled
  `summary only`;
- do not use animation, hover, or scrolling to reveal required information.

Provide exact `<title>` and `<desc>` content that covers the live correlate
assumption or IPV exception, boost conditioning, response SD meaning, full
distribution propagation, dose events, waning, and assessment.

Reuse existing visual tokens and chart helpers. Do not introduce a chart
library or new dependency.

### Existing distribution figure

Update labels dynamically:

- live product:
  `OPV-equivalent immune titer (log2 serum-equivalent correlate)` or an
  equivalently compact label;
- IPV:
  `Mucosal-immunity state used by transmission`.

The description must continue to say that the production calculation retains
take history and the full distribution. Never label the IPV mucosal
distribution as serum-equivalent.

### Chapter 04 -- interactive panel

Move the existing form, intact, into a new section after the distribution.
Add a concise description:

> Use these controls to change the candidate product and schedule. Every
> change recomputes vaccine take, each schedule transition, the full
> assessment-age immunity distribution, the downstream WPV calculations, and
> the final close-contact result. These values are scenario and product
> assumptions, not independently validated clinical endpoints.

Keep reset, live preview, debounce, URL state, fixed-comparator behavior,
validation, and export withholding exactly as they work now.

### Remaining page structure

- renumber displayed chapters after the insertion; do not rename model schema
  versions merely to match chapter numbers;
- update desktop and mobile navigation links;
- update skip links and `aria-labelledby` references;
- ensure every id is unique;
- preserve the rule that no verdict appears before the decision chapter.

### Export

- add a standalone `Immune response SVG` export action;
- serialize `ImmuneResponseDiagnosticsV1` in JSON through the nested V2
  diagnostic;
- do not change existing scientific CSV tables unless a separate clearly
  labeled schedule-trace CSV is deliberately added and reviewed;
- ensure SVG metadata includes selected product, schedule, assessment age,
  correlate convention or IPV exception, contract version, model identity,
  and prototype qualification consistent with existing figure exports.

## File-by-file implementation order

Follow this order. Do not start with markup.

### Task 1 -- contract and manifest identity

Allowed files:

- `src/data/parameters.json`
- tests or records that assert the contract/manifest version

Actions:

- set `designContractVersion` to `2.1`;
- bump `manifestVersion` only if repository convention requires it for the
  diagnostic-schema identity;
- do not change any scientific parameter value.

Gate:

- a diff of `parameters.json` shows identity-only changes.

### Task 2 -- shared schedule trace

Allowed files:

- `src/model/types.ts`
- `src/model/schedule.ts`
- `tests/model/model.test.ts`

Actions:

- add trace/dose diagnostic types;
- refactor one shared dose transition;
- add the non-allocating production path and trace-collecting teaching path;
- add unit tests before connecting diagnostics.

Gate tests:

- exact existing schedule outputs unchanged;
- trace final state equals `buildScheduleState`;
- all snapshots immutable and mass-conserving;
- default schedule snapshot order is:
  initial; pre/post routine dose 1; pre/post routine dose 2; pre/post routine
  dose 3; pre/post year-1 booster; assessment;
- no-booster schedule omits booster snapshots;
- IPV dose diagnostic take values are `null`.

### Task 3 -- versioned diagnostic and validation

Allowed files:

- `src/model/types.ts`
- `src/model/diagnostics.ts`
- `src/model/model.ts`
- `src/model/serialization.ts`
- `tests/model/model.test.ts`

Actions:

- add exact boost-response points;
- attach trace and response data to `WithinHostDiagnosticsV2`;
- update strict validation and export typing;
- update light and full evaluations through the same diagnostic builder.

Gate tests:

- all 16 response points match equations;
- live/IPV discriminated branches validate;
- malformed phases, bins, mass, days, mappings, take values, and final-state
  mismatches fail closed;
- full and light evaluation produce identical immune-response diagnostics for
  the same scenario.

### Task 4 -- chart renderer

Allowed files:

- `src/ui/charts.ts`
- focused chart/presentation test file if added

Actions:

- implement desktop and mobile two-panel SVGs;
- implement the IPV not-applicable branch;
- update the existing distribution renderer's dynamic labels;
- keep all scientific coordinates supplied by diagnostics.

Gate:

- SVG strings have unique ids, titles, descriptions, correct selected values,
  no `NaN`/`Infinity`, and no external resources;
- chart code contains no duplicate boost, take, or waning equation.

### Task 5 -- narrative structure and controls

Allowed files:

- `src/app.ts`
- `src/styles.css`
- `tests/ui/presentation.test.ts` if presentation data changes

Actions:

- create displayed chapters 02, 03, and 04;
- move, rather than duplicate, existing figures and controls;
- connect live rendering of the new figure;
- update navigation and displayed later chapter numbers;
- add the required live/IPV copy branches.

Gate:

- one and only one element exists for every control id;
- all current controls still change scenario state;
- static DOM order matches Section 13.3;
- live and committed renders both update the new figure.

### Task 6 -- exports, browser coverage, and documentation

Allowed files:

- `src/app.ts`
- `scripts/browser-smoke.mjs`
- `README.md`
- `IMPLEMENTATION_LOG.md`
- generated `dist/index.html`
- `reference/artifact-sha256.txt`

Actions:

- add immune-response SVG export;
- update browser smoke for order, live/IPV language, controls, SVG, mobile,
  print, URL round trip, and absence of external requests;
- update README's narrative description;
- record the bounded delegation and integrator disposition in
  `IMPLEMENTATION_LOG.md`;
- regenerate the deterministic artifact and hash only after all checks pass.

Gate:

- focused checks and full verification pass;
- two consecutive builds are byte-identical;
- generated artifact contains no external runtime resource.

## Required tests

At minimum add these named behaviors. Exact test names may differ.

### Schedule/model tests

1. `schedule trace reuses production transitions and reaches identical final state`
2. `schedule trace conserves probability at every snapshot`
3. `schedule trace records exact routine booster and assessment chronology`
4. `aggregate take equals the transition's bin-specific take mass`
5. `no-booster trace contains no booster event`
6. `IPV trace exposes no live-vaccine take coordinate`
7. `boost response points match mean and SD equations at bins 0 through 15`
8. `boost response reaches zero SD at the bin-15 cap`
9. `live and full evaluations emit identical response diagnostics`
10. `strict validation rejects a trace that disagrees with vaccinated bins`

Include a regression assertion that the default direct UP/Bihar result remains:

```text
R_loc = 0.7366389853385256
passing designs = 120
Pareto designs = 9
```

### Browser tests

1. chapter/figure/control DOM order matches contract 2.1;
2. default hypothetical product shows the serum-equivalent correlate wording;
3. Sabin shows live-correlate wording without editable hypothetical controls;
4. IPV shows the non-equivalence explanation and no live response curve;
5. changing `mu0` changes Panel A and the schedule trace;
6. changing booster or lag changes Panel B and the final distribution;
7. changing dose/take inputs changes schedule trace through take but does not
   change the fixed WPV equation;
8. the controls exist once, remain keyboard operable, and auto-commit;
9. the new SVG export contains metadata and no external resource;
10. 360 px and print layouts expose all required explanations without
    animation or hover;
11. no verdict appears before the decision chapter;
12. no visible or accessible copy calls the response SD an uncertainty
    interval or the modeled distribution a measured serum distribution.

## Verification commands

Use the repository's existing Node tooling. No Python environment is needed.

Run focused checks during implementation:

```sh
npm run typecheck
npm test
npm run build
node scripts/browser-smoke.mjs
git diff --check
```

Before disposition, run:

```sh
npm run verify
npm run build
npm run check:artifact
git diff --check
git status --short
```

Then run `npm run build` a second time and confirm that the committed
`dist/index.html` does not change.

## Explicitly out of scope

- fitting serum-to-mucosal relationships;
- separate stochastic serum and mucosal response parameters for live vaccine;
- variable `sigma0`;
- individual longitudinal simulation or runtime random draws;
- natural infection or background boosting outside the schedule;
- maternal-antibody or enteric-interference state variables;
- a named clinical assay prediction or seroprotection threshold;
- IPV parameter redesign;
- new vaccine platforms;
- optimization of schedules or immune responses;
- any change to WPV acquisition, shedding, transmission, `R_loc`, frontier,
  uncertainty, calibration, or success classification.

## Stop conditions

Stop and ask the integrator rather than guessing if:

1. an apparently necessary change alters a scientific equation, parameter,
   default, comparator, or verdict;
2. the final trace cannot be made identical to `buildScheduleState`;
3. the live serum-equivalent wording cannot be kept separate from IPV;
4. a requested display requires treating response SD as parameter uncertainty;
5. existing dirty changes overlap an allowed file and their ownership is
   unclear;
6. a fixture or default output changes for a reason other than an explicitly
   reviewed schema/identity update.

## Integrator review checklist

The primary integrator must inspect, not merely accept test results:

- one shared schedule transition rather than duplicated helpfulness-shaped
  logic;
- exact bin-specific take conditioning;
- no average-person propagation;
- correct live-product correlate wording and IPV exception;
- no assay or uncertainty overclaim;
- strict schema validation;
- final trace/distribution identity;
- unchanged direct `R_loc` and frontier outputs;
- responsive, print, accessibility, and export behavior;
- complete `IMPLEMENTATION_LOG.md` delegation record.

The result is acceptable only when a reader can answer all of these correctly:

1. What is received dose, and how is it different from biological take?
2. Why does prior immunity affect take and the size of a successful response?
3. What do `mu0` and `sigma0` control?
4. How do take/no-take branches and waning compose across a schedule?
5. Why is the assessment state a cohort distribution rather than an average
   child?
6. In what limited sense is the plotted live-vaccine titer serum-equivalent?
7. Why does that equivalence not apply to IPV?
8. Which state is actually used by WPV acquisition, shedding, and
   transmission?
