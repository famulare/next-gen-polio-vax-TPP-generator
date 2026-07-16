# Repository instructions

## Project context

This repository implements a deterministic, self-contained browser tool for
reasoning about next-generation polio vaccine target product profiles (TPPs).
It is computational public-health modeling and scientific software work. The
visible target is WPV1; the application evaluates a specified close-contact
transmission motif and reports the v1 `R_loc` sufficiency criterion.

Work from the smallest relevant technical context: named files, schemas,
equations, manifests, tests, and contract sections. Do not use euphemisms or
omit scientific constraints that affect the requested result, but do not expand
a routine software task into unrelated biological interpretation.

## Authority and scope

`DESIGN_CONTRACT.md` is the canonical, locked v1 specification. It controls
scientific meaning, scope, terminology, units, defaults, uncertainty claims,
acceptance tests, release conditions, and the delegation/content-block process.
The contract prevails over README wording, implementation convenience, and
prior conversation context.

Before changing model behavior, identify the controlling contract section. If
the requested behavior is unspecified or conflicts with the contract, use the
most conservative existing source-model behavior with a visible assumption, or
stop for a contract amendment when the choice would change meaning. Do not
silently substitute a convenient algorithm, default, unit, endpoint, or
interpretation.

V1 is limited to the contract's computational model, static visualization,
exports, and verification. Do not introduce wet-lab procedures, organism or
sequence construction, sequence engineering, pathogen-property optimization,
or experimental follow-up. The following remain explicitly out of scope unless
the design contract is amended: vaccine-virus transmission, reversion,
neurovirulence, genetic stability, evolutionary safety, full population or
geographic-spread simulation, and campaign/access reconstruction.

## Scientific-semantic guardrails

- Preserve the distinction between `R_loc` and a complete population `R_e`.
  Any "guarantee" language must retain the v1 close-contact sufficiency axiom
  and declared setting-envelope qualification.
- Keep vaccine dose-response/take parameters separate from fixed WPV
  susceptibility parameters. `take` is biological productive infection after a
  received dose; it is not dose receipt.
- Preserve distribution-native probability propagation. Do not replace
  conditioned take/no-take distributions, repeated-dose composition, or joint
  shedding survival-intensity expectations with averages of an "average
  person."
- Preserve canonical units and source basis. Internal exposure is grams of
  stool per exposure and contacts are exposures per person-day; conversion is
  only at the UI/model boundary. Fail invalid scientific state closed rather
  than clamping it, except where an equation explicitly specifies `clamp01`.
- Treat fixed comparators as their catalog products, not as parameterized
  hypothetical products. Do not change success rules, calibration tolerances,
  uncertainty semantics, named anchors, or defaults without a contract
  amendment.

## Task framing and execution

For a substantial task, use `docs/codex-task-template.md` or supply the same
information: decision purpose, requested output, relevant files and contract
sections, scientific/data invariants, acceptance tests, and boundaries. State
assumptions rather than silently expanding the model's biological scope.

Prefer the repository's existing TypeScript/Node tooling and data schemas.
Keep model code behind the pure-model boundary; retain deterministic inputs and
outputs, with no runtime randomness or network dependency. Do not introduce
new dependencies, compatibility aliases, broad fallbacks, or silent defaults
that obscure model meaning.

Run the focused verification implied by the changed surface. Changes to
scientific behavior normally require the applicable fixture/parity, invariant,
schema, frontier, and artifact checks in addition to type checking and unit
tests. Do not claim source parity, calibrated uncertainty, or upper-95
decision support when their contract-required fixtures or ensemble are absent.

## Delegation and content blocks

Direct implementation is preferred. When delegating, follow Section 14.6 of
the design contract: give a bounded manifest (objective, contract sections,
allowed files, inputs, expected output, discriminator, and tests); keep the
integrator responsible for review and merge; and record each delegation or
content-block fallback in `IMPLEMENTATION_LOG.md`.

A content block is evidence to assess, not a scientific judgment. For a
high-confidence likely false positive, truthfully narrow the request to the
needed file/function/equation/data transformation/test while preserving every
consequential semantic constraint, then follow the contract's limited retry
path. Never evade safeguards by concealment, fragmented tasks, or provider
hopping. A substantive block stops delegation; an unclear block requires
direct contract/source review and a contract amendment or human decision when
the distinction could change meaning or harm.
