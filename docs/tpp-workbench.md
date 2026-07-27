# TPP translation layer and model workbench

**Status:** LOCKED IMPLEMENTATION AND SETTING-SURFACE ADDENDUM  
**Approved:** 2026-07-27, by Mike's direction  
**Relationship to the canonical contract:** This addendum is subordinate to [`DESIGN_CONTRACT.md`](../DESIGN_CONTRACT.md). It governs the TPP translation and comparison layer added after contract 2.1 and the `settings-2.3.0` selected-frequency surface semantics. If it conflicts with the canonical scientific semantics, the canonical contract wins and this layer must be corrected.

## Purpose

The core application is a teaching-first scientific model explorer. This translation layer adds a second reading of the same deterministic model for vaccine-development users who think in target-product-profile terms but need help keeping the epidemiologic conditioning straight.

The central decision object is always:

> product x schedule x assessment time x setting x close-contact sufficiency premise

It is never presented as an intrinsic property of the vaccine product alone.

## Scientific invariants

The workbench must not change any production equation, parameter, schedule transition, comparator, success rule, or canonical export schema. It reads the same versioned scenario and public model functions as the core application. The setting-surface amendment changes only the nonbinding display surface and is versioned in the setting manifest; direct named-setting decisions are unchanged.

The following distinctions are binding:

1. Receipt is fixed at 100% in the current exercise.
2. `takeContext` is a multiplier on dose- and immunity-dependent productive vaccine take; it is not itself a take probability.
3. Productive WPV acquisition and infectious shedding after breakthrough are separate modeled effects.
4. `q_acq`, `q_shed`, and `q_index` are reference-challenge diagnostics. None is the authoritative decision rule.
5. Direct `R_loc` is conditioned on one breakthrough index child and counts expected tertiary infections along the declared two-link close-contact motif.
6. The selected cohort's probability of becoming the breakthrough index is displayed as context and is not multiplied into `R_loc`.
7. `R_loc` is not a complete-population `R_e`, an outbreak forecast, or a probability of success.
8. Parameter uncertainty and threshold-crossing probability are not quantified in this version.
9. The module addresses transmission efficacy only; it is not a complete vaccine TPP.
10. The setting surface holds `d_ih` and `d_hs` at the declared decision scope. Named anchors with different link frequencies are omitted from that two-dimensional slice rather than plotted over nonmatching raster values.

## Architecture

The implementation deliberately separates pure model interpretation from DOM integration.

### `src/ui/tpp-analysis.ts`

This module contains deterministic, testable projections of the existing model:

- the transmission-relevant TPP profile;
- exact link-level teaching diagnostics;
- fixed-comparator profiles under the current counterfactual schedule and setting;
- a controlled search for two designs with similar `q_index` but different acquisition-versus-shedding mechanisms; and
- a human-readable decision record.

The link-level diagnostic reconstructs the authoritative result as follows:

1. Build the exact schedule-derived immune state.
2. Condition the index source distribution on WPV acquisition at the reference challenge.
3. Use the production `transmitLink` function to calculate index-to-household incidence.
4. Aggregate that incidence by household source-immunity bin.
5. Rebase each infected household source bin to day zero before the second link, preserving the production rule that each link receives its own post-infection horizon.
6. Weight the household-to-social-contact probability by first-link incidence mass.
7. Multiply the one-social-contact probability by `N_s`.
8. Reconcile the result against direct `rLocForSetting`.

A reconciliation error above `1e-9` is surfaced in the browser console and covered by unit tests.

### `src/ui/tpp-workbench.ts`

This module installs the view layer after the core app mounts. It relies only on stable public model functions and existing DOM ids. It owns:

- Learn/Design mode selection;
- the TPP profile and point-estimate evidence status;
- pinned and fixed-comparator comparisons;
- controlled setting, timing, and mechanism experiments;
- the explicit causal map and direct-transmission waterfall;
- clarification of the take-context and acquisition language;
- setting-surface unit corrections at the view boundary; and
- the human-readable decision-record download.

The workbench listens to both canonical scenario hash changes and the core transaction's committed status. It therefore refreshes only after the core app has produced a scientifically coherent scenario, including reset cases where the canonical hash may not change. It does not participate in the core app's transaction, frontier, identity, or canonical export state.

### `src/ui/setting-surface-scope.ts`

The surface calculation in `src/model/model.ts` holds both link exposure frequencies at the declared decision scope. This view module labels that frequency slice and omits named anchor markers whose `d_ih` or `d_hs` differs from it. The selected scope marker therefore always belongs to the raster being displayed; no incompatible anchor is silently drawn over a color computed under another frequency convention.

### Single entrypoint, post-mount installation

`src/main.ts` imports the core application and then the workbench and setting-surface view adapter. The core application mounts synchronously; the explanatory layers schedule their installation for the following microtask. `scripts/build.mjs` bundles that dependency graph once and appends the workbench stylesheet to the existing stylesheet. The deliverable remains one self-contained HTML file with no runtime network dependency.

This arrangement keeps one copy of the scientific modules and their caches while preserving a clear ownership boundary: `app.ts` owns scientific transactions and canonical exports; the explanatory modules own read-only projections and view interaction. A future refactor may integrate the markup directly into `app.ts`, but only if the invariants above remain explicit and the resulting change reduces rather than increases coupling.

## TPP profile structure

The profile keeps five categories separate:

1. **Product assumptions**: take-context multiplier, vaccine HID50, heterogeneity, administered dose, and boost given take.
2. **Program conditions**: routine schedule, booster, assessment lag, and receipt assumption.
3. **Modeled biological effects**: aggregate take by dose, mean assessment-age mucosal state, acquisition reduction, and conditional shedding reduction.
4. **Epidemiologic context**: named decision setting, breakthrough-index conditioning, and close-contact motif.
5. **Decision and evidence status**: direct `R_loc`, margin to one, strict threshold status, and the absence of quantified parameter uncertainty.

Fixed comparators are labeled as counterfactual evaluations under the current schedule and setting. The default hypothetical product is identified when its editable assumptions equal the fixed Sabin-2 starting assumptions.

## Comparison semantics

Guided setting and timing experiments automatically pin the pre-change scenario. The mechanism-pair buttons pin the opposing matched design before applying the selected one. The comparison table then decomposes differences before showing the final endpoint:

- effective first-dose take;
- mean mucosal state at assessment;
- acquisition reduction;
- conditional shedding reduction; and
- direct `R_loc`.

The guided mechanism contrast searches the current hypothetical product family for two points with similar `q_index`, opposing `q_acq`/`q_shed` tradeoffs, and a visible difference in direct `R_loc`. This demonstrates why the shedding index is informative but not sufficient for the direct transmission decision.

## Validation contract

`tests/tpp-analysis.test.ts` checks:

- exact reconciliation of the teaching waterfall with direct `R_loc`;
- the linked Matlab setting convention and its one-exposure-per-day surface slice;
- the separation of the take-context multiplier from modeled take by dose;
- the mechanism-contrast construction and its direct-result separation;
- explicit hypothetical-family context when a fixed comparator is selected; and
- the conditioning and uncertainty language in the decision record.

The existing browser smoke suite remains the authority for the integrated artifact, responsive layout, accessibility, and export behavior. The generated artifact and its retained hash must be refreshed in an environment with the full Node, dependency, and Playwright toolchain before release.

## Human comprehension validation

Automated checks cannot establish that the intended audience has acquired the correct mental model. The moderated tasks and release criteria are specified in [`docs/comprehension-test-protocol.md`](./comprehension-test-protocol.md).
