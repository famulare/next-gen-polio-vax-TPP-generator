# Comprehension test protocol for the TPP model explorer

## Objective

Evaluate whether a vaccine-development user can reconstruct the model's causal and decision logic after one guided session. This is not a preference survey and not a test of epidemiology vocabulary.

## Participants

Recruit users who are comfortable with vaccine product profiles, immunogenicity, or clinical-development evidence but who do not routinely build transmission models. Record prior familiarity with OPV, mucosal immunity, and reproduction numbers; do not use familiarity as an exclusion criterion.

## Session structure

1. Ask the participant to use **Learn the causal chain** without coaching.
2. Ask them to narrate what they think changes when one product input is moved.
3. Use **Compare product scenarios** for a pinned comparison and one fixed comparator.
4. Run the guided mechanism contrast and setting contrast.
5. Ask the participant to interpret a downloaded decision record without the website visible.

## Core tasks and pass criteria

### 1. Receipt, take, acquisition, and shedding

Prompt: "What are the four different events represented by receipt, vaccine take, WPV acquisition, and shedding after breakthrough?"

Pass: the participant distinguishes all four and does not call the take-context multiplier a take probability.

### 2. Authoritative endpoint

Prompt: "Which number determines whether this scenario meets the criterion?"

Pass: direct `R_loc < 1` at the selected setting. `q_acq`, `q_shed`, and `q_index` may be described as diagnostics but not as the pass/fail rule.

### 3. Conditioning

Prompt: "What is assumed to have happened before the `R_loc` calculation starts? Is the displayed index acquisition probability multiplied into `R_loc`?"

Pass: one breakthrough index is conditioned on; the acquisition probability is context and is not an outer multiplier.

### 4. Product versus program versus setting

Prompt: "Name one product assumption, one program condition, and one setting assumption in the current result."

Pass: examples are assigned to the correct categories.

### 5. Directional prediction

Before moving a control, ask the participant to predict the direction of change in modeled take, assessment-age mucosal immunity, acquisition, conditional shedding, and direct `R_loc`.

Pass: the participant gives a coherent causal prediction and revises it using displayed intermediate outputs rather than only the final verdict.

### 6. Similar shedding index, different mechanisms

Prompt: "These two designs have similar `q_index`. Why can their direct `R_loc` values differ?"

Pass: the participant identifies that acquisition and conditional shedding enter nonlinear repeated-exposure and two-link transmission calculations in different places.

### 7. Pareto boundary

Prompt: "What does the turquoise line mean, and what does it not mean?"

Pass: minimum-sufficient boundary within the currently evaluated product family and held-fixed context; not a confidence, credible, or uncertainty interval.

### 8. Scope and evidence

Prompt: "What claim is supported if the scenario clears UP/Bihar, and what claim is not supported?"

Pass: likely adequacy under less demanding modeled conditions under the declared sufficiency premise; not guaranteed global control, a complete-population `R_e`, an outbreak forecast, or a probability of success.

## Outcome measures

Record first-attempt correctness, time to answer, confidence before and after answering, and the exact language used for conditioning and scope. Treat confident category errors as more important than navigation errors.

The primary release criterion is that at least 80% of representative users answer tasks 2, 3, 4, and 8 correctly without coaching. Task 6 should improve between the initial explanation and the guided contrast; failure to improve indicates that the mechanism comparison needs redesign rather than more prose.

## Diagnostic interpretation

- Confusing take context with take probability: surface actual per-dose take earlier and more prominently.
- Multiplying index acquisition into `R_loc`: strengthen the start-condition label and waterfall.
- Treating `q_index` as the criterion: reduce its visual prominence and repeat the direct-rule label adjacent to it.
- Treating a comparator result as historical effectiveness: strengthen the counterfactual-schedule label.
- Treating the Pareto line as uncertainty: move the point-model/no-uncertainty statement into the figure itself.
- Treating the module as a complete TPP: keep excluded TPP domains visible in the profile and decision record.
