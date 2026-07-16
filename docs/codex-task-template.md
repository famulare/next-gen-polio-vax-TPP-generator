# Contract-grounded task brief

Use this template for substantial model, interface, data, or release work.
Keep the brief as short as the task permits; its purpose is to make the
scientific and software contract inspectable, not to add generic biological
background.

## Decision purpose

What user or release decision does this work support? State the relevant v1
endpoint precisely (for example, a selected-setting probe or the envelope
maximum), rather than using `R_loc` as shorthand for a complete population
reproduction number.

## Requested output

Name the exact artifact: function, schema change, fixture, visualization,
export, test, or build/release check. Name the expected observable behavior.

## Contract surface

- Relevant `DESIGN_CONTRACT.md` sections:
- Files, manifests, or pinned source fixtures to read:
- Terms, units, defaults, or labels that must remain unchanged:
- Explicitly deferred or out-of-scope behavior that this task must not add:

## Scientific/data invariants

State the invariant or discriminator that would reveal a semantic error. For
example: probability mass is conserved; take/no-take conditioning is preserved;
zero exposure yields selected-setting `R_loc = 0`; the envelope maximum is
reported separately; or a fixed comparator retains its catalog identity.

## Acceptance criteria and verification

- Required tests or direct numerical checks:
- Required typecheck, build, artifact, browser, fixture, or parity checks:
- Expected changed files and generated artifacts:
- Residual limitation that must be stated rather than implied away:

## Boundaries

This repository is limited to contract-defined computational public-health
modeling. No wet-lab protocol, biological construction, sequence design, or
optimization of pathogen properties is requested. If completing this task would
change a locked scientific default, unit, outcome definition, success rule,
uncertainty claim, calibration tolerance, or scope, stop and request a design
contract amendment.
