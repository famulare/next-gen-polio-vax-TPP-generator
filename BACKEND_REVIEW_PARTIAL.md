# Backend review completion record

**Status:** Backend review and its remediation task list are complete through
commits `0a85b7c` and `8595482`. This is not an overall application-release
approval; the separate web-visualization/science-communication review remains
outside this document's scope.

**Review baseline:** commit `d3c18e4bebe7aa0aa588201411f19b09e6350384`

**Review date:** 2026-07-17

**Scope:** Backend model, mathematical implementation, schemas, fixtures,
calibration, determinism, performance, and build/release pipeline. The review is
being conducted as a defensive scientific-software review. It is not a biology
review, and the web visualization and science communication are deferred.

## User decisions recorded during review

The intended versioned default for the hypothetical new vaccine is:

- `take_context = 1`
- `mu0_new = 6`
- `sigma0_new = 2.4` remains fixed

The baseline manifest instead used `take_context = 0.8` and `mu0_new = 4`.
Contract 1.7 and parameter manifest 1.1.0 now record and implement the selected
`take_context = 1`, `mu0_new = 6` default explicitly.

At current parameters, the default change materially changes the reported
model output:

| Default | `R_loc` envelope maximum | `q_acq` | `q_shed` |
|---|---:|---:|---:|
| baseline `take=0.8, mu0=4` | 31.3458069892 | 0.2144967561 | 0.1459338521 |
| versioned `take=1, mu0=6` | 12.1133719492 | 0.0928709707 | 0.0068430156 |

These values are included to show that this is a consequential default, not to
make a biological claim about either design.

## Final backend bottom line

All P1--P3 findings and all eight handoff tasks recorded below have been
resolved. The audited backend now implements the controlling Contract 1.7
semantics for the exact dose-response equation, exact Cessation shedding
constants, independent per-infection transmission horizon, selected-design
identity, linked/unlinked envelopes, hard validation bounds, and explicit
point-rule uncertainty limitation. The model and generated artifact remain
deterministic and self-contained.

This conclusion is narrower than product release or scientific validation.
The reviewed joint uncertainty ensemble remains absent and therefore fails
closed; no upper-95 or complete-population decision claim is available. Source
fixtures with deliberately different numerical policies remain clearly labeled
diagnostics, not production-parity evidence. The separate visualization and
science-communication review is still deferred.

## Original findings at the baseline (all resolved)

The findings below preserve what was observed at `d3c18e4`; their present-tense
descriptions are historical, not descriptions of the remediated backend.
Severity convention used during the review:

- **P1:** resolve before treating the backend as an implementation of the
  locked design contract or relying on its canonical outputs.
- **P2:** important correctness, completeness, or auditability defect, but
  currently fail-closed, bounded, or not known to change the default result.
- **P3:** test hardening, performance polish, or misleading maintenance residue.

### Resolution index

| Baseline finding | Resolution |
|---|---|
| Wrong default and off-grid selected output | Contract 1.7 and parameter manifest 1.1.0 set `take_context=1`, `mu0_new=6`; `selectedDesign` is the exact scenario and `nearestGridPoint` is separately named. |
| Grid cell substituted for selected scenario | Direct selected-design evaluation is retained even outside the display grid; rendering does not imply an in-grid selected cell. |
| Approximate low-dose production branch | Production uses the stable exact beta-Poisson equation. The India branch is a discriminating source diagnostic only. |
| Global rather than per-infection horizon | Each link receives an independent 120-day post-infection horizon; all product/anchor cases pass the 120-to-240-day tail test. |
| Unbounded transmission caches | Large transmission caches are content-keyed LRU caches capped at 12. Small boost, integrated-shedding, and surface-value caches are also explicitly bounded. |
| Nonreproducible CI build identity | Build identity is a deterministic source hash; the committed artifact has a recorded SHA-256, CI checks a clean rebuild, and negative tests prove stale-artifact rejection and `GITHUB_SHA` independence. |
| Inconsistent shedding `b2` | Production uses exact Cessation `ln(1.164)`; the India rounded value remains diagnostic and is not claimed as parity. |
| Mutable cached/output state | Scenario and provenance are owned copies; committed manifests and cached boost matrices are frozen; invalid mutations cannot corrupt later evaluations. |
| Missing unlinked envelope | `Tih` and `Ths` bounds are independently represented and validated; linked envelopes require equal bounds. |
| Undeclared hypothetical hard bounds | Contract 1.7 and the versioned parameter manifest declare and enforce alpha, beta, dose, take, and boost bounds. |
| Invalid bins silently repaired | Nonfinite, negative, and zero-mass state fails closed; floating residual is assigned to the largest existing component. |
| Missing runtime manifest/output schemas and weak identity | All committed scientific manifests and `ModelOutputsV1`, including provenance, receive exact-key/type/range validation; identities use SHA-256 scientific content. |
| Missing cross-path regression | Direct factorized `R_loc` is compared with explicit independently timed `transmitLink` composition over products and anchors; maximum allowed relative difference is `1e-12`. |
| Performance/test-discovery residue | Redundant shedding work is bounded-memoized, surface scalar results use a four-entry content cache, tests are recursively discovered, and stale partial wording was reconciled. |

### P1. The canonical hypothetical default is wrong, and the intended `mu0=6` default exposes a second output bug

The locked exploration table specifies `take_context` default 1 in
[`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L360-L372), while the parameter
manifest supplies 0.8 and `defaultScenario()` consumes it without an override
([`src/model/parameters.ts`](src/model/parameters.ts#L87-L110),
[`src/model/model.ts`](src/model/model.ts#L11-L28)). Reset, initial load,
fixtures labelled "default," and canonical exports therefore use the wrong
take default.

The user has additionally selected `mu0_new=6` as the intended new-vaccine
default. That value is not exactly on the current 51-point grid: the grid step
is 0.16, so 6 lies midway between 5.92 and 6.08. The current backend silently
reports 5.92 as `frontier.selectedDesign` while the scenario metrics are for 6.
For the intended default, the result currently contains:

- direct scenario `R_loc_max = 12.1133719492` at `mu0=6`;
- `frontier.selectedDesign.mu0 = 5.92`;
- `frontier.selectedDesign.rLocEnvelopeMax = 12.4943992892`.

Required remediation is not just a manifest edit: amend the default, regenerate
the appropriate default-labelled fixtures/reports, and fix the selected-design
contract described next.

### P1. `frontier.selectedDesign` silently substitutes a nearby grid design for the selected scenario

[`buildFrontier`](src/model/frontier.ts#L24-L34) populates `selectedDesign` with
[`nearestPoint`](src/model/frontier.ts#L91-L103), not with the selected
hypothetical design. This changes both the reported coordinates and all derived
metrics whenever a typed value is off-grid.

The error becomes qualitative outside the display grid. Scenario validation
accepts `mu0` through 15
([`src/model/serialization.ts`](src/model/serialization.ts#L53-L70)), while the
frontier grid ends at 8. A valid `take=1, mu0=15` scenario evaluates directly to
approximately `R_loc_max=0.0381` (passing), but `selectedDesign` is silently
replaced by `take=1, mu0=8`, approximately `R_loc_max=5.50` (not passing).
Thus a single `ModelOutputsV1` can report contradictory selected results.

The selected scenario should be evaluated exactly and represented separately
from the nearest display cell. If the UI wants a grid marker, the snapped cell
must have a different name and the snap must be explicit. This also needs tests
for off-grid values, the intended `mu0=6` default, and typed values outside the
display grid.

### P1. The production dose-response function does not implement the exact locked equation

The contract defines, without a branch:

```text
p_infection(d,n) = 1 - (1 + d/beta)^(-alpha / 2^(gamma*n))
```

See [`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L304-L327). Production instead
switches to a linear approximation whenever `dose/beta <= 0.01` in
[`src/model/dose-response.ts`](src/model/dose-response.ts#L4-L13), controlled by
a manifest value in
[`src/data/parameters.json`](src/data/parameters.json#L17-L19).

This is pinned India-source behavior, but it is not the equation in the locked
contract and the contract preamble does not amend Section 7.1 to authorize the
approximation. At the branch boundary for `alpha=0.444, n=0`, the linear result
differs from the exact result by about 0.72% relatively, far above the direct
port tolerance. The current fixtures pass because their source extraction uses
the same branch; that demonstrates source parity, not contract-equation parity.

This requires an explicit decision:

1. remove the branch and regenerate/calibrate under the exact contract equation;
   or
2. amend Section 7.1 to name the source branch, its threshold, and its accepted
   approximation error.

The branch is a correct first-order approximation and matches the pinned source;
neither fact resolves its conflict with the specified equation.

### P1. The implemented transmission horizon has different semantics from the contract, and the required extension criterion fails

The contract says the horizon is 100 days **after each infection** and requires
that extending it change `R_loc` by less than `1e-4` relatively at every anchor
([`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L602-L618)). Production instead uses
one 100-day clock beginning with the index infection. The second link receives
only `horizonDays - infectionDay` days in
[`rLocForSetting`](src/model/transmission.ts#L111-L125) and in the precomputed
tensor ([`src/model/transmission.ts`](src/model/transmission.ts#L259-L279)).

This matches the pinned scalar Cessation implementation's fixed global array,
but not the current words "after each infection." More importantly, a direct
100-day versus 200-day probe fails the contract's numerical discriminator at
several acceptance anchors. Relative omitted-tail changes were:

| Product/default | Low | Houston | Matlab | High |
|---|---:|---:|---:|---:|
| current hypothetical | `6.96e-4` | `1.57e-4` | `7.93e-5` | `1.47e-5` |
| Sabin-2 default | `3.64e-4` | `1.45e-4` | `1.16e-4` | `2.26e-5` |

This is not merely a missing test; the missing test would fail. Decide whether
the intended object is a global motif horizon matching Cessation or independent
100-day post-infection link horizons, amend either code or contract, and then
set a horizon long enough to satisfy the stated tail bound.

### P1. Module-global transmission caches retain roughly 160 MB per distinct setting envelope

The caches in [`src/model/transmission.ts`](src/model/transmission.ts#L27-L31)
are unbounded and keyed by continuous setting/age values. Each link kernel
retains full `daily` and `cumulative` `Float64Array`s
([`src/model/transmission.ts`](src/model/transmission.ts#L182-L212)); the setting
surface evaluates 81 exposure values at two different contact frequencies
([`src/model/model.ts`](src/model/model.ts#L83-L108)).

A Node process with exposed GC showed retained `arrayBuffers` increasing as
follows when evaluating valid envelopes whose exposure maximum differed by 1%:

```text
start:    0.1 MB
after 1: 159.9 MB
after 2: 319.7 MB
after 4: 639.3 MB
after 6: 958.8 MB
after 8: 1278.4 MB
```

This is much larger than a taste-level cache concern. A short sequence of valid
recomputations can retain more than 1 GB in a static browser page. Booster age
or assessment-lag changes also mint new age-specific kernels. The performance
check measures a warm, short process and does not detect lifetime growth.

Use bounded ownership: an evaluation-local cache, an explicitly sized LRU, or a
surface calculation that reuses/discards kernels as a batch. Add a repeated
recomputation memory discriminator. Cache keys must also incorporate actual
scientific manifest content, not only a version string.

### P1. The byte-identical release-rebuild guarantee is neither enforced nor achievable in CI

The contract requires a clean rebuild to leave committed `dist/index.html`
unchanged and says CI rebuilds the committed artifact without a diff
([`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L1293-L1314),
[`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L1335-L1341)). Neither workflow runs
`git diff --exit-code` after the build
([`.github/workflows/test.yml`](.github/workflows/test.yml),
[`.github/workflows/pages.yml`](.github/workflows/pages.yml)).

Moreover, [`scripts/build.mjs`](scripts/build.mjs#L8) embeds `GITHUB_SHA` in CI
but embeds `local-working-tree` locally. The committed artifact currently
contains `local-working-tree`, so a CI build necessarily differs. The artifact
checker prints a SHA-256 but does not compare it to a committed expected hash.

Choose one release model and make the contract/pipeline agree. Under the current
committed-artifact model, build identity must be reproducible and both workflows
must fail on a post-build diff; the recorded artifact hash should be checked,
not only printed.

### P2. The shedding-duration `b2` value has no consistent contract or source provenance

The contract specifies `b2 = ln(1.164)`, which is
`0.15186234930924603`, and describes it as approximately 0.1519
([`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L427-L439)). The pinned India source
uses the rounded value `0.1519`. The browser parameter manifest instead uses
`0.1519663281441243`
([`src/data/parameters.json`](src/data/parameters.json#L21-L26)). It is neither
the exact contract value nor the pinned source default.

The India shedding fixture does not discriminate this discrepancy because the
generator injects the browser's same hard-coded value into the source kernel
([`scripts/generate-reference-fixtures.R`](scripts/generate-reference-fixtures.R#L898-L928)).
The fixture therefore proves agreement conditional on the injected value, not
provenance of the value.

The effect is small but real: changing only `b2` from the browser value to the
source's 0.1519 changes envelope `R_loc` by roughly 0.009% for the current
hypothetical default and 0.031% for Sabin-2. Select exact-contract or
source-rounded behavior explicitly, update the manifest provenance, and make
the fixture distinguish it.

### P2. The nominal pure-model boundary exposes mutable cached state and aliases mutable input

The contract requires scientific calculations to be pure functions of a
serializable scenario and parameter object
([`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L1010-L1014)). Two concrete violations
are present:

1. [`buildBoostMatrix`](src/model/bins.ts#L89-L110) returns the same mutable
   array stored in its module-global cache. Mutating a returned matrix changes
   later `applyBoost` results. A probe that added 0.5 to one returned cell
   changed a later boosted bin probability by approximately 0.33.
2. [`evaluateScenario`](src/model/model.ts#L57-L80) returns the input `scenario`
   by reference. Mutating the caller's input after evaluation changes
   `outputs.scenario` while `metrics` and `modelIdentity` remain from the old
   state, making one output object internally inconsistent.

Return immutable/read-only cached structures internally and clone or freeze the
canonical input included in outputs. Also avoid exporting mutable scientific
manifest objects without an ownership contract.

### P2. The contract's advanced unlinked exposure envelope is not representable

The contract says advanced mode can unlink `T_ih` and `T_hs`, and an unlinked
envelope maximum uses both upper bounds
([`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L638-L655),
[`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L698-L705)). `EnvelopeV1` contains only
one `TMin/TMax` pair
([`src/model/types.ts`](src/model/types.ts#L47-L57)), and validation explicitly
rejects `linkedExposure:false`
([`src/model/serialization.ts`](src/model/serialization.ts#L99-L110)).

Failing closed is preferable to silently computing the wrong maximum, but this
is still a missing required backend scenario feature. Implement separate link
bounds and direct upper-corner evaluation, or remove the promise through a
contract amendment.

### P2. Accepted hypothetical-product values extend beyond the parity-tested domain without a declared hard dose bound

Validation accepts `alpha` through 5, `beta` through `1e6`, any finite positive
dose, and `mu0` through 15
([`src/model/serialization.ts`](src/model/serialization.ts#L53-L70)). The
susceptibility fixture covers alpha/beta bounds and dose cases through `1e9`;
the take/schedule fixtures cover the recommended dose range `1e4..1e7`; and
boost parity covers `mu0=0..8`. No finite upper dose bound is declared in code,
and `mu0=8..15` is accepted despite lying outside the direct-port grid named by
the Section 15.1 amendment.

The contract permits typed values beyond sliders only after validation against
broad hard bounds. Commit those bounds and cover them, or restrict accepted
canonical scenarios to the verified domain. This issue compounds the
`selectedDesign` snap but is independently an acceptance-domain problem.

### P2. Invalid probability state is silently repaired in bin helpers

[`normalizeBins`](src/model/bins.ts#L10-L17) converts negative and nonfinite
values to zero and replaces a near-zero total with a fully naive distribution.
[`shiftBins`](src/model/bins.ts#L40-L43) treats a nonfinite shift as if no shift
were requested. The contract says invalid scientific state fails closed and is
never clamped except where an equation explicitly specifies `clamp01`
([`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L1293-L1297)).

Small roundoff cleanup can be narrowly tolerated, but `NaN`, infinity,
meaningful negative mass, and zero-total state should throw. Do not turn a
numerical failure into a scientifically meaningful naive cohort.

### P2. Required manifest/output schemas are TypeScript assertions, not validated versioned schemas

[`src/model/parameters.ts`](src/model/parameters.ts#L1-L19) casts imported JSON
to TypeScript interfaces without runtime validation. The parameter interface
itself omits the manifest's `sourceSnapshot` field
([`src/model/types.ts`](src/model/types.ts#L76-L109)). There is strong strict
validation for `ScenarioV1`, but no equivalent exact-key/finite/range/unit
validation for `ParameterManifestV1`, setting/grid manifests, or
`ModelOutputsV1`, despite the explicit schema requirement in
[`DESIGN_CONTRACT.md`](DESIGN_CONTRACT.md#L1026-L1037).

The model identity is only a 32-bit FNV-1a string
([`src/model/serialization.ts`](src/model/serialization.ts#L9-L17)). That is weak
for an audit/cache identity, and kernel cache keys use only
`PARAMETERS.manifestVersion`, not content. The contract-named cache invalidation
tests after every scientific input or manifest change are absent.

Add strict runtime validators for every committed scientific manifest and
output, use a collision-resistant content identity already available in the
build/tooling environment, and test content-based cache invalidation.

### P3. A valuable cross-path identity is uncommitted

The external review supplied during this task reported an additional check
across all anchors and selected product/schedule variants:

```text
rLocForSetting == transmitLink(index -> household) then
                  transmitLink(household -> social)
maximum relative difference: 4.3e-15
```

It also reported consistent escape/survival handling between the optimized
kernel and `matlab-compat` implementation. These are strong results, but I have
not yet independently reproduced the exact external probe. The committed suite
checks precomputed-tensor versus factorized `R_loc`, not the production
factorized path versus the calibration chain. Reproduce the probe locally and
commit it as a regression test; it connects the reported model result to the
path exercised by the prevalence calibration gate.

### P3. Performance and test-discovery polish

- `integratedShedding` recomputes identical bin/age/horizon integrals throughout
  the 2,601-cell frontier instead of sharing the existing shedding profile.
  Current performance passes, but evaluation-local memoization would remove
  substantial redundant work without changing semantics.
- `npm test` names only `tests/model/model.test.ts`; a future second test file
  would not automatically join `npm run verify`. Use an explicit recursive test
  discovery pattern.
- The reference generator's header still says it writes only incomplete partial
  fixtures, while its generated manifest now marks Section 15.1 satisfied.
  Several test names still say "partial." These assertions should be reconciled
  with the v1.6 amendment so maintainers do not infer the wrong release state.
- `normalizeBins` places its final floating-point residual into maximum-immunity
  bin 15. This is normally around machine epsilon, but correcting the largest
  existing component or normalizing proportionally would avoid a directional
  convention with no mathematical justification.

## Final verification after remediation

`npm run verify` passed against commit `8595482` plus this documentation-only
closure:

- TypeScript typecheck: passed.
- Recursively discovered Node tests: 36/36 passed.
- R fixture-generator provenance preflight: passed.
- All seven Section 15.1 artifacts and the Section 15.2 calibration gate:
  current and passing.
- Calibration fixture validation: exact root/case/mapping/output schemas,
  finite/range checks, clean pinned provenance, consecutive day conventions,
  unique case IDs, full trajectory lengths, and explicit gate failure behavior.
- Performance medians: selected scenario 1.6 ms, setting surface 0.7 ms,
  frontier 410.7 ms; all below their fixed targets.
- Twelve distinct envelopes retained 17.0 MiB of ArrayBuffers. Cache entries
  remained within their declared capacities: 12 link kernels, 1 shedding
  profile, 12 per-exposure profiles, and 4 setting surfaces.
- Deterministic build identity: `source-434c9bfdda3bc11a`.
- Single-file artifact and Chromium smoke: passed, including local-file load,
  no runtime network requests, GitHub Pages path prefix, fixed-comparator UI
  semantics, stale/invalid output withholding, exports, and narrow viewport.
- Built artifact SHA-256:
  `a427fedcfde8b1bb658d63e081ce16ba325891e51da3567aeb0891377fab9ea8`.
- Negative release tests: a deliberately stale artifact was rejected and two
  builds with different CI-like `GITHUB_SHA` values were byte-identical.
- `git diff --check`: passed before each remediation commit.

The source/contract audit in
[`docs/backend-source-authority-audit.md`](docs/backend-source-authority-audit.md)
accounts for every generator input family and records which values are direct
source constants, versioned contract/grid inputs, or diagnostics. Calibration
optimization remains deterministic with declared grids and tie breaks. The
India joint-fit report exposes the near-optimal mean/`Tih` region rather than
presenting a point estimate as posterior identification; invalid mapped state,
invalid mass, invalid horizon, stale report, and failed calibration-gate paths
fail closed.

## Baseline verification (superseded)

### Repository suite

At the baseline, `npm run verify` passed from a clean worktree:

- TypeScript typecheck: passed.
- Node tests: 25/25 passed.
- R fixture preflight: passed.
- Section 15.1 fixture and Section 15.2 calibration checks: passed.
- Performance check: selected scenario 2.0 ms, setting surface 14.3 ms,
  frontier 959.0 ms in that run.
- Single-file build and artifact checks: passed.
- Chromium artifact smoke: passed.
- Built artifact SHA-256:
  `566954ee17799cdde12b34dd2548b0a2c3e0a842c2e2c547bd4d1ef93fd1e939`.
- The worktree remained clean after the local build.

That baseline command did not exercise the post-build git-diff release gate,
horizon-extension criterion, cache lifetime, or off-grid selected-design
consistency described above.

### Independent fixture regeneration

I copied the project to a temporary directory, linked its installed Node
dependencies, ran:

```text
Rscript scripts/generate-reference-fixtures.R
npm run generate:calibration-report
```

against the pinned, clean India-R and Cessation source repositories, and
compared every regenerated fixture and the calibration report to the committed
files. There were no differences. This is strong reproducibility evidence for
the current generator inputs. It does not make injected constants such as
`b2` independent source evidence.

## Important properties preserved and reverified

These baseline strengths were preserved during remediation:

- Scheduled live-vaccine take is split bin-by-bin into conditioned take and
  no-take subdistributions; it is not applied to an unchanged average-person
  distribution.
- Repeated doses compose full immunity distributions, and probability mass is
  conserved on tested valid paths.
- WPV susceptibility parameters remain separate from vaccine take parameters.
- The transmission kernel keeps conditional shedding concentration inside the
  nonlinear dose response, source survival outside it, and repeated contact
  frequency outside the per-exposure dose response.
- Index breakthrough conditioning changes which immunity bins become index
  cases without changing fixed WPV parameters.
- The selected named/custom setting is computed separately from the declared
  envelope maximum.
- Fixed Sabin-2 and IPV comparator identities fail closed if parameterized.
- Threshold ties are not passing, and monotonicity/zero-link invariants pass.
- Parameter uncertainty and the upper-95 rule fail closed as out of scope.
- There is no runtime network dependency or runtime randomness in the model.

## Handoff task-list disposition

1. **Complete.** The cross-path comparison is a committed regression over
   hypothetical/IPV states and every named anchor.
2. **Complete.** Calibration optimization, deterministic tie rules,
   near-optimal-region identifiability diagnostics, strict fixture/report
   schemas, and negative paths were audited and tested.
3. **Complete.** Every fixture-generator input family is classified in the
   source-authority audit, including all injected rather than inferred values.
4. **Complete.** Release negative tests cover deliberately stale `dist`,
   CI-like `GITHUB_SHA`, Pages path prefix, scientific-content identities, cache
   bounds, and CI clean rebuilds.
5. **Complete.** Contract 1.7 resolves all three conflicts: exact production
   dose response, independent 120-day per-infection horizons, and exact
   Cessation shedding constants. Divergent source behavior is diagnostic.
6. **Complete.** The default is versioned as `take_context=1`, `mu0=6`; exact
   selected-scenario output is distinct from `nearestGridPoint`.
7. **Complete.** Focused regressions were added and the complete fixture,
   calibration, invariant, performance, memory, build, artifact, browser, and
   release-negative chain passes.
8. **Complete for backend scope.** Backend output no longer carries the
   selected-design contradiction. The later visualization and
   science-communication review remains deliberately separate.

## Commit and worktree record

- `0a85b7c` — contract/default/equation/horizon/envelope/cache semantic fixes,
  regenerated fixtures, and focused regressions.
- `8595482` — strict output/calibration validation, complete source-authority
  audit, bounded secondary caches, deterministic build/artifact gates,
  release-negative tests, recursive test discovery, and the final artifact.
- No pinned source repository was modified. This completion update changes
  documentation only on top of those verified implementation commits.
