# Backend review remediation task

## Decision purpose

Complete the defensive backend review recorded in
`BACKEND_REVIEW_PARTIAL.md` and make the deterministic browser model conform
to the locked scientific contract before its canonical outputs are relied on.

## Requested output

- Resolve every actionable P1/P2 backend finding and commit focused regression
  coverage for the P3 cross-path and verification findings.
- Finish the calibration, fixture-input, cache-lifetime, and release-pipeline
  review tasks and record their disposition in the review and implementation
  log.
- Regenerate versioned artifacts affected by approved equation/default changes.

## Controlling contract sections

Sections 4, 7.1, 7.2, 7.6, 9.4, 10.3, 11.4, 14.3--14.5,
15.1--15.3, 15.6, and 16 of `DESIGN_CONTRACT.md`.

## Scientific and data invariants

- The written contract controls where pinned source behavior conflicts with it:
  use the exact beta-Poisson equation, an independent post-infection horizon
  for each motif link, and exact `ln(1.164)` shedding-duration `b2`.
- Preserve distribution-native take/no-take conditioning, repeated-dose
  composition, breakthrough conditioning, and joint shedding propagation.
- Keep fixed WPV susceptibility parameters separate from hypothetical vaccine
  take parameters; fixed comparators remain fixed catalog products.
- Invalid scientific state fails closed. No compatibility aliases, hidden
  snaps, broad fallbacks, or silent defaults are introduced.
- The explicit user-selected hypothetical default is `take_context=1`,
  `mu0_new=6`, with `sigma0_new=2.4` fixed.

## Acceptance tests

- Exact off-grid selected design equals direct scenario metrics; any nearest
  display cell is separately named.
- Every acceptance anchor passes the contract's horizon-extension discriminator.
- Repeated valid recomputations have bounded retained transmission-cache memory.
- Mutable inputs/returned helpers cannot corrupt later model results.
- Linked and unlinked envelope upper corners are represented and evaluated
  exactly.
- Runtime schemas reject missing, unknown, nonfinite, unit-mismatched, and
  semantically inconsistent manifest/output state.
- Cross-path transmission identity, calibration negative paths, content-based
  model identity, deterministic release rebuild, artifact hash, and CI clean
  diff are tested.
- `npm run verify` and an explicit post-build clean-diff gate pass.

## Boundaries

Backend scientific model, schemas, fixtures, calibration, tests, performance,
and release pipeline only. Web visualization and science-communication review
remain separate except for adapting consumers to corrected backend schemas.
