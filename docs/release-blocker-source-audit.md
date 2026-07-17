# Source audit supporting the 2026-07-17 contract amendment

**Date:** 2026-07-17
**Status:** superseded as a release-blocker record by Design Contract 1.6. No
source product-schedule `R_loc` fixture exists; the approved direct-port grids
and Section 15.2 prevalence calibration are the best available hybrid
equivalence check. Parameter-uncertainty intervals and the upper-95 rule are
out of scope for this iteration.

## Decision purpose

Determine whether a source-derived fixed-Sabin-2/IPV transmission fixture can
be added honestly, and whether the locked source snapshot contains an
admissible joint uncertainty ensemble for the formerly optional upper-central-95
success rule.

## Governing constraints

- Contract Sections 4.1--4.3 divide the hybrid model deliberately: India owns
  bins-native biology and schedule composition; Cessation owns the scalar-titer
  close-contact `R_loc` motif. The Grassly and full India endpoints are not the
  v1 `R_loc`.
- Section 7.4 fixes the Sabin-2/IPV catalog semantics. The amended Section
  15.1 requires the direct-port kernel grid and Section 15.2 calibration; it
  does not permit relabeling a scalar Cessation titer result as product parity.
- Contract 1.6 places parameter-uncertainty intervals and upper-95 success out
  of scope. Any future joint ensemble must satisfy the former Section 12.2
  safeguards rather than constructing a posterior from independent CI endpoints.

## Fixed-comparator transmission parity

| Source role | Pinned evidence | What it can establish | Why it cannot be relabeled as product-schedule transmission parity |
|---|---|---|---|
| India biological kernels | `model/R/{mixture,titer_bounds,susceptibility,immunity,vaccination}.R` at `1e3e832742e84a36fbc75d81b3a2d19cde8208e6` | Sabin-2 take/boost, IPV naive-versus-primed mucosal semantics, and distributional schedule composition | It does not compute the Cessation close-contact `R_loc` endpoint for a catalog schedule. |
| Cessation motif | `analysis/transmission/primarySecondaryTertiaryDoseModel.m` at `3d779963e9febe8e6262964b185c8277234f41e0` | Scalar fixed-titer primary -> secondary -> tertiary incidence and named-anchor `R_loc` context | Its inputs are `primaryLog2NAb`, `secondaryLog2NAb`, and `tertiaryLog2NAb`; it has no Sabin/IPV product identifier, dose schedule, take/no-take conditioning, or 16-bin state. |
| India Grassly/full model | contract Sections 4.1--4.2; Grassly episode sources under `projects/india-wpv-elimination/05_calibration_workflow/submodels/grassly_episode/` | Hazard-placement and bounded-episode cross-checks | Grassly has no local-reproduction-number endpoint, and the full model's spectral-radius reporter is not `R_loc`. |

**Decision:** do not add a purported original-source product-schedule
transmission fixture. Feeding an India schedule distribution into the scalar
Cessation model requires a scalarization rule that Section 7 and the
distribution-native model explicitly reject. Reimplementing the joined hybrid
in R/Matlab would create a new reference model, not execute an existing source
product-transmission model. The existing Cessation fixed-titer anchors and
`sourceRLocContextOnly` calibration values remain context only. Contract 1.6
instead accepts the direct-port grid plus the Section 15.2 prevalence
calibration as the hybrid-equivalence evidence for this iteration.

### Non-requirement

No original-source product-schedule transmission fixture will be requested as
a parity criterion. Such a source executable does not exist. A separately
implemented hybrid reference model would be a new scientific project, not an
original-source comparison, and is not required to establish the approved
bounded prototype evidence base.

## Uncertainty-ensemble audit

### Candidates inspected

| Candidate | Finding | Decision |
|---|---|---|
| Cessation `analysis/transmission/{modelFit,LouisianaFit,indiaFit}.mat` | The MAT records contain `betaBoot` arrays. However, `fitHouseholdModel.m`, `fitLouisiana.m`, and `fitIndia.m` evaluate their likelihoods through `primarySecondaryTertiaryDoseModel.m` with `confidenceIntervalSamplerSeed`. That model independently samples marginal CI endpoints through `resampleParametersFromCI`. The India fit also contains nonphysical failed values that its source CI summary excludes without preserving an ensemble protocol. | Not a reviewed, v1-mappable joint ensemble. Section 12.2 prohibits using that CI-resampling pathway as a posterior. |
| India Grassly round-04 outputs | The recorded design is `grouped_sobol`, with parameter ranges and deterministic design points, not posterior/bootstrap weights or a retained-draw protocol. Its target is also the separate Grassly/full-model setting rather than the v1 hybrid `R_loc`. | A sensitivity/design sweep only; do not assign probability weights or central-95 semantics. |
| Existing app manifest | `src/data/uncertainty-ensemble.json` has `status: "out_of_scope"`; the application exposes only the point rule. | Correct scope record. Its provenance says why the inspected candidates are not used. |

### What a future probabilistic extension would require

A reviewer must supply a versioned ensemble protocol and raw draw artifact(s)
before implementation. For each named uncertainty group, it must declare:

1. source repository, commit, immutable file hash, and extraction command;
2. joint parameter rows in their native units, with the semantic mapping to
   this browser model and the parameters intentionally held fixed;
3. optimizer/failure and physiological-validity filters declared before TPP
   outcome inspection, plus original, rejected, and retained counts;
4. weights (equal bootstrap weights if appropriate), a deterministic central
   quantile algorithm, and whether groups may be composed; and
5. an explicit scientific justification for any independence assumption across
   named fits.

Until that record is reviewed and a new contract amendment approves the
extension, named low/base/high evaluations may be added only as sensitivity and
may not enable upper-95 or be described as a confidence, credible, or posterior
probability interval.

## Verification and boundaries

This audit inspected the locked source commits and source code/metadata only.
The subsequent contract amendment did not alter browser equations, parameter
values, calibration targets or results, source commits, or public-health
interpretation. It changes only the accepted hybrid-equivalence evidence and
the current uncertainty scope. It does not make the close-contact endpoint a
complete population `R_e` or product-performance claim.
