# Design contract: next-generation polio vaccine TPP generator

**Status:** LOCKED FOR IMPLEMENTATION

**Contract version:** 1.2

**Locked:** 2026-07-15

**Process amendments:** 2026-07-15; supervised-agent/content-block fallback and
primary false-positive judgment

**Primary audience:** vaccine developers, polio program scientists, modelers, and funders

**Implementation target:** a deterministic, self-contained interactive HTML application suitable for static GitHub Pages hosting

This document is the implementation contract for the first version of the
next-generation polio vaccine target product profile (TPP) generator. It is
intentionally more specific than a product brief. Model semantics, units,
defaults, uncertainty claims, and acceptance tests are part of the contract.
They may not be replaced by convenient implementation choices without first
changing and re-approving this document.

This file is the canonical handoff artifact. An implementation agent must be
able to execute it without access to the conversation that produced it. If a
scientific or interface choice is not specified here or in a versioned manifest
named here, it is not silently delegated to implementation judgment: use the
most conservative existing source-model behavior, add a visible assumption, or
stop for a contract amendment when meaning would change.

---

## 1. Product question and decision purpose

The application will help users reason about:

> What combination of vaccine take, mucosal immune boosting, dose-response
> performance, and schedule is sufficient to prevent sustained close-contact
> transmission of wild poliovirus (WPV), including in very high-transmission
> settings?

The original motivating shorthand was "how much shedding reduction is
required?" That shorthand is not the primary TPP endpoint because a single
shedding index combines at least two biologically and developmentally distinct
effects:

1. reducing the probability that a vaccinated person acquires WPV; and
2. reducing the duration and amount of WPV shed after a breakthrough infection.

The primary output will therefore be a **Pareto frontier** showing combinations
of acquisition blocking and breakthrough infectiousness reduction that are
sufficient under the selected schedule and setting envelope. A scalar shedding
index may be displayed as a derived diagnostic, never as the sole definition of
product success.

The tool is a model explorer and TPP reasoning aid. It is not a clinical-trial
calculator, a forecast of outbreak size, or a substitute for a full population
transmission model.

---

## 2. Binding v1 premise: close-contact sufficiency axiom

Version 1 adopts the following **TPP sufficiency axiom** at Mike's direction:

> If a feasible vaccine schedule drives the modeled close-contact local
> reproduction number, `R_loc`, below 1 throughout a declared conservative
> setting envelope, the product is classified as sufficient to "guarantee a
> win" for this TPP exercise.

This is a deliberately high bar and a decision rule for the tool. It is not a
result inferred from the source paper. The source paper defines `R_loc` over an
index-person -> household-member -> close-social-contact motif and notes that it
is not a complete population reproduction number.

The application must therefore label the outcome precisely:

- **Allowed:** "Meets the v1 close-contact sufficiency criterion."
- **Allowed:** "Below `R_loc = 1` under the selected v1 success rule and modeled
  setting envelope."
- **Not allowed:** "Guaranteed to stop all poliovirus transmission everywhere"
  without the adjacent qualification "under the v1 close-contact sufficiency
  axiom and declared model envelope."

The app will expose the setting envelope and all assumptions used to make this
classification. It will not silently equate `R_loc` with a complete `R_e`.

---

## 3. Scope

### 3.1 In scope for v1

- WPV1 transmission as the visible target, while retaining serotype-indexed
  parameter structures.
- Sabin 2 OPV and IPV as fixed comparator products.
- A hypothetical OPV-like new vaccine with variable:
  - dose-response `alpha`;
  - dose-response `beta`;
  - setting-specific take multiplier in `[0, 1]`;
  - mean immune-boost magnitude;
  - administered dose;
  - routine schedule and booster timing.
- Fixed dose-response `gamma` in v1.
- Fixed immune-boost variance in v1.
- Exact composition of repeated doses over a distribution of immunity.
- Age-dependent shedding, immune waning, and immune boosting.
- Setting variation in fecal-oral exposure, close-contact frequency, and number
  of close social contacts.
- Named anchors for low transmission, Houston/Louisiana, Matlab, and UP/Bihar.
- Deterministic propagation of probability mass and a deterministic fixed
  parameter ensemble for uncertainty/sensitivity.
- One to three linked visuals, with the Pareto frontier primary.
- One self-contained HTML deliverable with no runtime network dependency.

### 3.2 Explicitly out of scope for v1

- Vaccine-associated paralysis, neurovirulence, genetic stability, reversion,
  or vaccine-virus evolutionary risk.
- OPV-derived secondary immunization as a benefit of the new vaccine.
- Explicit oral-oral, waterborne, or long-range environmental transmission.
- Stochastic outbreak probability, epidemic size, fadeout, or geographic spread.
- Full household, bari, village, or metapopulation simulation.
- Endemic equilibrium, campaign history reconstruction, or time-varying force of
  infection.
- Coverage inequity, access heterogeneity, and correlated dose dropout in the
  primary biological TPP result.
- Joint serum-mucosal immunity distributions.
- Other target poliovirus strains in the visible UI. Data structures must allow
  nOPV2 and other strains to be added later without changing scenario schemas.

---

## 4. Source-of-truth hierarchy

The browser model is a deliberate hybrid reduction. No one source model is a
complete template for the requested tool.

| Priority | Semantic role | Source |
|---|---|---|
| 1 | Current bins-native immunity, take conditioning, boosting, waning, susceptibility, and shedding kernels | `/Users/famulare/git/famulare/india-polio/model` |
| 2 | Definition and calculation of the index -> household -> close-social-contact `R_loc` motif | `/Users/famulare/git/famulare/cessationStability/analysis/transmission/primarySecondaryTertiaryDoseModel.m` |
| 3 | Published low, moderate, and high setting anchors and interpretation | Famulare & Selinger 2018, especially Figs 8-11 and S1 Text |
| 4 | Matlab-specific household exposure, immunity, and take calibration | Taniuchi et al. 2017 supplementary appendix, especially Table S6 |
| 5 | OPV/IPV biological event semantics | `/Users/famulare/git/famulare/india-polio/model/docs/amended_immunity_model_contract.md` and vaccination code |
| 6 | Hazard placement and one-episode observation checks | the Grassly episode submodel in `india-polio`; reference only |

If sources conflict, v1 follows this rule:

1. preserve the published meaning of `R_loc`;
2. use the current India implementation for individual biology and repeated-dose
   composition;
3. document deliberate deviations needed for a browser reduction; and
4. add a parity or sensitivity test rather than hide the conflict.

### 4.1 Why the Grassly episode model is not the core template

The Grassly episode implementation is a modern, useful observation model for a
bounded close-contact episode. It correctly keeps viral dose inside the
nonlinear dose-response function and contact frequency outside it as repeated
exposure. It does not implement the local reproduction-number endpoint or a
vaccination-program reachability calculation. V1 will reuse its hazard semantics
as a cross-check, not its top-level simulator.

### 4.2 Why the full India simulator is not the core template

The full India model contains population dynamics, access, demography,
stochastic/Rao-Blackwellized regimes, and a heuristic transmission reporter.
Those components are broader than the requested static TPP tool, and the
reporter's spectral-radius quantity is not the paper's `R_loc`. V1 will port the
current biological kernels but not silently replace the endpoint.

### 4.3 Why the older Matlab model remains necessary

The cessation model directly encodes the requested close-contact motif,
published setting anchors, and `R_loc` interpretation. Its scalar-titer
implementation will be generalized to probability distributions using the
newer India kernels rather than copied literally.

### 4.4 Locked reference snapshot

The v1 reference fixtures must be generated from these source states:

| Repository | Commit | Tracked state at lock |
|---|---|---|
| `cessationStability` | `3d779963e9febe8e6262964b185c8277234f41e0` | clean |
| `india-polio` | `1e3e832742e84a36fbc75d81b3a2d19cde8208e6` | clean; untracked `AGENTS.md` is not a model input |

Fixture generation must fail if either source repository has tracked changes.
It must record the full commit, branch, tracked dirty flag, untracked paths,
declared source files read, generator command, and fixture schema version. A
source update requires regenerating fixtures and reviewing the resulting diff;
it may not enter through a copied constant with no provenance change.

---

## 5. Terminology and units

The UI and code must keep these quantities distinct.

| Term | Meaning | Unit/range |
|---|---|---|
| `n` | log2 OPV-equivalent mucosal-immunity state | 0 to 15 |
| OPV-equivalent titer | `2^n`; a correlate/latent scale tied to live-poliovirus immune history | reciprocal titer-like scale |
| vaccine administered dose | live vaccine-virus dose offered to a recipient | TCID50/CID50 |
| transmission exposure | virus delivered to a contact from shed stool | CID50 per exposure |
| stool-equivalent exposure | amount of stool transferred in one modeled exposure | grams or micrograms stool |
| take | productive live-vaccine infection after a received dose | probability |
| uptake/receipt | whether a scheduled dose is delivered | probability; fixed to 1 in core v1 |
| breakthrough infection | WPV infection after vaccination | event/probability |
| shedding survival | probability an infected person is still shedding at time `t` | probability |
| shedding intensity | virus concentration conditional on still shedding | TCID50 per gram stool |
| infectious shedding burden | time-integrated source potential, preserving survival-intensity dependence | derived |
| `N_s` | number of close social contacts outside the index household | people |
| `D_ih`, `D_hs` | daily index-household and household-social exposure frequencies | exposures/person/day |
| `T_ih`, `T_hs` | stool-equivalent amount per exposure | grams/exposure |
| `R_loc` | expected close social contacts infected per infected index along the declared motif | dimensionless |

The software must never use `take` as a synonym for dose receipt. It must never
use vaccine-virus dose-response parameters as WPV dose-response parameters.

Canonical internal units are grams of stool per exposure and exposures per
person-day. UI labels may display micrograms, but conversion occurs only at the
UI/model boundary. Every setting parameter record must retain `value`, `unit`,
and `basis` (`per_exposure` or `per_day`). The Matlab estimate
`10^-4.73 g/day = 18.6 micrograms/day` is retained with its source basis and is
numerically equivalent to `18.6 micrograms/exposure` only under the locked
`D_ih = 1 exposure/day` mapping. "Force of infection" is not a separate v1
input; exposure amount and contact opportunities are the setting controls.

---

## 6. Browser model state

### 6.1 Immunity representation

Each modeled role carries a 16-element probability vector over unit-width log2
immunity bins `0..15`.

- Bin 0 is true zero/naive mucosal immunity for never-infected people.
- Bins 1-15 represent increasing OPV-equivalent mucosal immunity.
- Probability mass must sum to 1 within `1e-12` after every operation.
- Transmission, susceptibility, and shedding depend only on mucosal immunity.

The core TPP model does not need to carry a separate serum distribution because
serum does not drive transmission in the current India model. The UI may report
an **OPV-equivalent correlate titer**, but it must not imply that any measured
serum neutralizing titer is universally causal for mucosal protection. For the
hypothetical OPV-like pathway, a successful take is assumed to generate aligned
serologic and mucosal boosting, so serum neutralization can be discussed as a
candidate measurable correlate of the latent mucosal state.

This wording is a contract item, not cosmetic copy.

### 6.2 Roles

The reduced transmission chain has three roles:

1. `index`: a vaccinated person who acquires WPV;
2. `household`: a vaccinated household contact exposed by the index; and
3. `social`: a vaccinated close social contact exposed by the infected
   household member.

The same selected schedule is applied to all three roles. All roles are assessed
at the same selected lag after the schedule's last dose. This encodes a
universal product profile and avoids changing age while moving through the
transmission motif.

The cessation model's 12-month index and 48-month contact assumptions are
retained only in a named **legacy compatibility fixture**. They are not primary
TPP defaults and do not appear as independent role-age controls.

### 6.3 Initial state

For the biological TPP comparison, each role begins life with all mucosal mass in
bin 0 and receives the selected schedule with 100% dose receipt. Natural WPV/OPV
exposure outside the schedule is absent. This isolates vaccine performance.

Maternal antibodies and enteric interference are not explicit state variables
in v1. Their effects on live-vaccine take are represented by the setting-specific
take multiplier. This simplification must be stated in the assumptions panel.

---

## 7. Biological kernels

### 7.1 Dose-response susceptibility

For virus dose `d`, log2 mucosal-immunity state `n`, and virus-specific
parameters `alpha`, `beta`, and `gamma`:

```text
p_infection(d, n) = 1 - (1 + d / beta)^(-alpha / 2^(gamma * n))
```

V1 fixed WPV defaults:

- `alpha_wpv = 0.444`
- `beta_wpv = 2.31`
- `gamma_wpv = 0.4624`

WPV parameters remain fixed when evaluating protection from WPV. The
hypothetical vaccine's `alpha_vax` and `beta_vax` describe **vaccine-virus take**
after an administered live dose; they do not alter WPV infectiousness.

Within each one-log2 bin, susceptibility will use the same fixed quadrature/bin
conventions as the India implementation rather than evaluating only at a bin
center.

### 7.2 Biological take of the new vaccine

For a received vaccine dose and pre-dose immunity bin `n`:

```text
p_take(n) = clamp01(
  p_infection(dose_vax, n; alpha_vax, beta_vax, gamma_fixed)
  * take_context
  * formulation_multiplier
)
```

Binding distinctions:

- `take_context` is setting-specific biological take modification in `[0,1]`.
- `formulation_multiplier` defaults to 1 for a monovalent hypothetical vaccine.
- receipt is fixed at 1 for the core biological TPP result.
- `gamma_vax` is fixed to `0.4624` in v1.
- `alpha_vax`, `beta_vax`, and administered dose are product properties.

For each dose, the pre-dose immunity distribution is split exactly:

```text
take mass in bin b    = pre[b] * p_take[b]
no-take mass in bin b = pre[b] * (1 - p_take[b])
```

The take subdistribution is therefore tilted toward lower immunity and the
no-take subdistribution toward higher immunity. The browser implementation must
not apply a mean take probability to an unchanged immunity distribution.

Recommended v1 exploration domain:

| Parameter | Default | Interactive range | Scale |
|---|---:|---:|---|
| `alpha_vax` | 0.444 | 0.2 to 1.0 | linear |
| `beta_vax` | 8 | 1 to 100 CID50 | logarithmic |
| `dose_vax` | `10^5.3` | `10^4` to `10^7` TCID50 | logarithmic |
| `take_context` | 1 | 0 to 1 | linear |
| `gamma_vax` | 0.4624 | fixed | n/a |

These are exploration bounds over an OPV-like design space, not a probability
distribution, feasibility prior, or regulatory specification. Typed input may
extend beyond a slider range only after validation against broad hard bounds.

### 7.3 Immune boosting

For pre-boost log2 immunity `x`, maximum state `N_max = 15`, maximum mean boost
`mu0`, and maximum boost standard deviation `sigma0`:

```text
scale(x)   = max(0, 1 - x / N_max)
post_mean  = min(N_max, x + mu0 * scale(x))
post_sd    = sigma0 * scale(x)
```

The post-boost Gaussian is projected to the 16 bins using the India model's
transition-matrix construction. V1 varies `mu0_new` and holds
`sigma0_new = 2.4` log2 units, the Sabin default. Recommended fixed comparators:

| Immunizing event | `mu0` | `sigma0` |
|---|---:|---:|
| Sabin OPV/live infection | 6.0 | 2.4 |
| WPV infection | 7.2 | 2.9 |
| hypothetical OPV-like vaccine | variable | 2.4 fixed |

After a dose, boosted take mass and unboosted no-take mass are recombined. This
is a Markov transition on the full distribution, so repeated doses compose
without inventing an average person.

Recommended `mu0_new` exploration range is 0 to 8 log2 units. Values outside
this range require typed advanced input and remain subject to the immunity cap.

### 7.4 Fixed comparator catalog

| Product | Live take model | Mucosal effect | Fixed v1 parameters |
|---|---|---|---|
| Sabin 2 monovalent OPV | yes | take boosts mucosal and serum immunity | `alpha=0.444`, `beta=8`, `gamma=0.4624`, dose `10^5.3`, `mu0=6.0`, `sigma0=2.4`, context take 1 |
| IPV | no | boosts mucosal immunity only after prior live infection | Sabin boost matrix (`mu0=6.0`, `sigma0=2.4`) when primed; serum-only when naive |
| hypothetical OPV-like vaccine | yes | take boosts mucosal and serum immunity | variable values in the declared exploration domain |

An all-IPV schedule in a live-virus-naive cohort therefore has no effect on the
v1 fecal-oral transmission endpoint. This does not mean IPV lacks value: serum
protection against paralysis is outside this tool's endpoint.

### 7.5 Waning

Between immunizing events, current log2 immunity is shifted down by:

```text
delta_n = lambda * log2(max(elapsed_months, 1))
```

with `lambda = 0.87`. Shifted mass below zero returns to bin 0. The browser uses
continuous elapsed days converted with `365.25 / 12` days per month. This is a
deliberate browser convention; reference tests will account for the India
simulator's structural 30-day month where needed.

### 7.6 Shedding duration

For days since infection `t` and log2 mucosal immunity `n`:

```text
S(t | n) = 1 - Phi((ln(t) - b1 + b2 * n) / b3)
```

WPV defaults:

- `b1 = ln(43 days)` (implemented value approximately 3.76)
- `b2 = ln(1.164)` (approximately 0.1519)
- `b3 = 0.52`

### 7.7 Shedding intensity

Conditional shedding concentration depends on age, time since infection, and
pre-infection immunity. V1 ports the India bins-native kernel with:

- age peak parameters `A_max = 6.67`, `A_min = 4.29`, `tau = 9.92 months`;
- immunity suppression `c = 0.056`;
- temporal parameters `mu = 1.64`, `sigma = 0.18`, `kappa = 0.32`;
- assay floor `10^2.6 TCID50/g`.

The implementation must compute the joint expectation of shedding survival and
intensity over immunity bins. It must not multiply independently averaged
duration and intensity, because low-immunity breakthrough infections both shed
longer and shed more.

### 7.8 Infection-induced boosting during the chain

An acquired WPV infection boosts the infected role with the WPV boost operator.
For the first-generation `R_loc` calculation, post-infection boosting does not
change shedding from that same infection and therefore does not feed back into
the current chain. It is retained in the model API for later multi-generation
extensions but is not needed to compute v1 `R_loc`.

---

## 8. Schedule semantics

### 8.1 Required schedules

The routine infant series is:

- dose 1 at 6 weeks (`42` days);
- dose 2 at 10 weeks (`70` days);
- dose 3 at 14 weeks (`98` days).

The user may select:

- no booster;
- one booster at age 1 year;
- one booster at age 2 years;
- one booster at age 3 years; or
- one booster at age 4 years.

Year-based doses use `365.25 * age_years` days. Schedule events are applied in
chronological order. Immunity wanes continuously between events. WPV assessment
occurs either 28 or 90 days after the selected schedule's last dose; 28 days is
the default. The assessment lag is applied identically to all three roles and
must be printed with every result and export.

### 8.2 Dose receipt and dropout

The core TPP question assumes all scheduled doses are received. This keeps
biological take separate from program delivery. A secondary delivery scenario
may later expose coverage and correlated dropout, but it must not alter or be
confused with the biological TPP frontier.

### 8.3 Correct repeated-dose composition

Every dose must:

1. derive the current waned immunity distribution at the exact dose age;
2. calculate bin-specific take;
3. condition take and no-take mass separately;
4. boost only take mass;
5. recombine all mass; and
6. reset the peak clock for the recombined current distribution.

Acceptance tests will compare this process with the India R implementation.

---

## 9. Reduced close-contact transmission model

### 9.1 Motif

The browser preserves the cessation paper's essential motif:

```text
infected index -> household member -> close social contacts in other households
```

Direct index-to-social transmission and additional household/social pathways
are omitted in v1. This is why the close-contact sufficiency rule is an axiom,
not an estimated total reproduction number.

### 9.2 Daily transmission

For each source role, day since infection, and source immunity bin:

1. compute expected shedding survival and concentration;
2. multiply concentration by stool-equivalent exposure per contact;
3. evaluate the fixed WPV dose-response kernel for every recipient immunity bin;
4. combine repeated daily exposures with cumulative escape; and
5. condition newly infected recipient immunity on the actual dose-dependent
   infection event.

Contact frequency remains outside the nonlinear dose response. For `D` equal
exposures in a day with per-exposure infection probability `p`:

```text
p_day = 1 - (1 - p)^D
```

Fractional `D` is interpreted through the equivalent Poisson hazard, not by
rounding to an integer number of contacts.

The calculation is deterministic over infection day, source bin, and recipient
bin. Runtime sampling is prohibited in the core model.

Binding episode algorithm:

1. Represent source infections as mutually exclusive cohorts
   `(infection_day, preinfection_immunity_bin, probability_mass)`.
2. For each source cohort and later day, evaluate source shedding survival and
   concentration at time since infection.
3. For each recipient immunity bin, calculate the WPV infection probability
   from the resulting dose and contact frequency.
4. Multiply by recipient-bin mass and cumulative prior escape to obtain
   first-infection incidence by day and bin.
5. Carry those incidence cohorts forward as the source cohorts for the next
   link in the motif.
6. Sum mutually exclusive cohort contributions only after bin-specific
   conditioning and cumulative escape have been applied.

The implementation must not transmit from mean shedding at mean immunity, and
must not condition a recipient after averaging over its immunity bins.

Each role's schedule-derived preinfection immunity and common assessment age
are evaluated at episode start and held fixed during its 100-day infection
episode. Because assessment is after the schedule's last dose, no vaccination
event occurs during the modeled episode.

### 9.3 Index breakthrough conditioning

When all members have a distribution of immunity, WPV breakthroughs are not a
random sample of vaccinees. V1 conditions the index distribution on acquisition
from a reference WPV exposure of one WPV HID50. The reference exposure affects
which immunity bins become index cases, not WPV biological parameters.

For naive immunity, the HID50 implied by the beta-Poisson parameters is:

```text
HID50 = beta_wpv * (2^(1 / alpha_wpv) - 1)
```

The reference dose will be shown in advanced assumptions and tested in a
sensitivity range. This is a browser-model extension beyond the source paper's
fixed-titer calculation.

### 9.4 Definition of `R_loc`

With one infected index normalized to probability 1:

```text
R_loc = N_s * total_probability_one_social_contact_is_infected
```

Equivalently, matching the source Matlab model:

```text
R_loc = N_s * sum(tertiary incidence) / sum(primary incidence)
```

The horizon defaults to 100 days after each infection, matching the source
implementation. A horizon-extension test must show that omitted tail incidence
changes `R_loc` by less than `1e-4` relatively at all acceptance-test anchors.

### 9.5 Faithful modernization rule

The primary calculation is distribution-native at every link: index
breakthrough selection, index shedding, household acquisition and conditional
immunity, household shedding, and social acquisition. Means may be displayed
after integration but may not be propagated as state.

The earlier Matlab implementation mixes fixed values, means, and distributions.
It is a calibration target, not the new algorithm. A degenerate-distribution
compatibility mode must recover its fixed-titer calculations. The modern model
may differ modestly because it preserves heterogeneity, but a material change in
`R_loc` is evidence that the reduced transmission layer needs calibration or
refitting; it may not be accepted merely because the machinery is newer.

---

## 10. Setting model and anchors

### 10.1 Visible setting axes

The setting is defined by independent, visible quantities:

- `T_ih`: stool-equivalent exposure from index to household contact;
- `T_hs`: stool-equivalent exposure from household member to social contact;
- `D_ih`: index-household exposure frequency;
- `D_hs`: household-social exposure frequency;
- `N_s`: number of close social contacts.

The simple setting view links `T_ih = T_hs` and exposes:

1. sanitation/exposure (`T`, on a log scale); and
2. close-social-contact count (`N_s`).

The advanced view can unlink the two doses and vary `D_hs`. `D_ih` defaults to
one exposure/day. `D_hs` defaults to `8.9685` exposures/day, inherited from the
Houston fit.

`take_context` is varied independently from exposure/sanitation in v1. The tool
must not infer a correlation between them without a versioned empirical model.

### 10.2 Named anchors

| Anchor | `T_ih` | `N_s` | Interpretation/provenance |
|---|---:|---:|---|
| Low | 0.5 micrograms/exposure | 3 | Published Fig 9 low setting |
| Houston/Louisiana moderate | 5 micrograms/exposure | 3 | Houston fecal-exposure fit plus Louisiana/WPV calibration context; published Fig 9 moderate point |
| Matlab household exposure | 18.6 micrograms/day for contacts under 5 | 3 provisional | `10^-4.73 g/day` from Taniuchi 2017 Table S6; `N_s` is borrowed from the published moderate-setting reduction because the Matlab study did not fit the extrafamilial link |
| UP/Bihar high | 230 micrograms/exposure | 10 | Published Fig 9 high setting |

The Matlab marker must be visually distinguishable as a hybrid mapping, with an
exposure interval of approximately 3.2-61.7 micrograms/day from the reported
95% confidence interval. Its tooltip must state that the trial estimated the
index-to-household link only and that the social-contact component is inherited,
not calibrated in Matlab.

Additional Matlab validation values, not setting axes:

- tOPV infant OPV-equivalent titer: 200 (110-310);
- bOPV+IPV infant titer: 31 (20-50);
- contacts under 5 titer: 580 (320-1240);
- study/detection take multiplier: 1.55 (1.19-1.97), not a biological
  `[0,1]` probability and therefore not used as `take_context`.

### 10.3 Declared "any setting" envelope

Recommended conservative v1 envelope:

- linked fecal-oral exposure `T`: 0.1 to 2,000 micrograms/exposure;
- close social contacts `N_s`: 1 to 40;
- `D_ih = 1` exposure/day;
- `D_hs = 8.9685` exposures/day;
- default `T_hs = T_ih`.

The 2,000-microgram upper exposure bound follows the physiological range used
in the source paper. The 40-contact upper bound follows the source code's
maximum close-network exploration and is intentionally more demanding than the
published anchor points.

The primary status is based on the maximum `R_loc` over this declared envelope,
not only on the named settings. Users may narrow or widen the envelope, but the
status must then say "selected envelope" rather than "v1 global envelope."

Because `R_loc` must be nondecreasing in `T`, `D`, and `N_s`, the rectangular
envelope maximum is evaluated at its upper corner after the monotonicity tests
pass. A grid is still computed for display. If an advanced control unlinks axes,
the maximum uses every corresponding upper bound. Failure of monotonicity is a
model error, not a reason to search for a convenient maximum.

---

## 11. TPP outcomes and Pareto analysis

### 11.1 Mechanistic design vector

A hypothetical product/schedule design is:

```text
v = {
  alpha_vax,
  beta_vax,
  dose_vax,
  take_context,
  mu0_new,
  sigma0_new = 2.4,
  gamma_vax = 0.4624,
  schedule
}
```

### 11.2 Decomposed product outcomes

For the selected product and schedule, report:

```text
q_acq  = P(WPV acquisition | vaccinated) / P(WPV acquisition | naive)
q_shed = E[integrated infectious shedding | vaccinated breakthrough]
         / E[integrated infectious shedding | naive infection]
q_index = q_acq * q_shed
R_loc_max(v) = max_setting R_loc(v, setting)
```

The one-HID50 reference exposure is used for `q_acq` and index conditioning.
`q_shed` integrates the joint survival-intensity expectation. These ratios
describe a product outcome; neither is substituted for the full transmission
chain. `q_index` is a useful summary card but never determines pass/fail.

### 11.3 Outcome-space requirement frontier

The left primary panel plots the directly evaluated product family in outcome
space:

- x-axis: acquisition reduction, `1-q_acq`;
- y-axis: breakthrough infectious-shedding reduction, `1-q_shed`.

Every point is one design from the product grid in Section 11.4, evaluated with
the full distribution-native `R_loc` chain. The minimum-sufficient Pareto
boundary is the lower envelope of passing designs: passing design A removes B
from the boundary when A requires no more reduction on either axis and strictly
less reduction on at least one. Comparisons within `1e-9` are equal. Unattained
regions are visibly marked; the display must not imply that the axes are direct,
independently tunable vaccine parameters or that every coordinate pair is
biologically reachable.

This frontier is conditional on the current `alpha_vax`, `beta_vax`, vaccine
dose, schedule, assessment lag, and setting envelope. Changing those controls
recomputes both linked panels. If multiple designs produce the same displayed
outcome pair, the UI reports the non-uniqueness instead of selecting one
silently. Evaluated designs determine classification; interpolation is only for
drawing. Tie tolerance at `R_loc_max = 1` is `1e-9`, and ties are not passing.

### 11.4 Product-design frontier

The linked right primary panel is actionable product space:

- x-axis: setting-specific `take_context`, 0 to 1;
- y-axis: `mu0_new`, 0 to 8 log2 units;
- fixed-by-current-controls: `alpha_vax`, `beta_vax`, administered dose,
  schedule, assessment lag, and setting envelope;
- overlays: `R_loc_max = 1`, selected design, and Sabin 2-like anchor.

The panel uses a `51 x 51` direct-evaluation grid. The left panel is a second
coordinate view of these same 2,601 evaluations, not a separately parameterized
effect model. Changing dose, `alpha`, or `beta` moves the contour; they are not
collapsed into `take_context`. A tooltip also reports effective first-dose take
in a naive recipient. Schedule selection recomputes one grid at a time; cached
schedules may be overlaid only if the legend preserves their identity.

The two panels are simultaneously visible and linked by selection and hover.
A shared summary strip reports `q_acq`, `q_shed`, `q_index`, point `R_loc_max`,
its central 95% interval, assessment lag, and success rule. This satisfies the
need to show both the shedding-index intuition and its two-axis decomposition
without allowing the scalar to control the decision.

All grid coordinates, ordering, and contour conventions live in a committed
`frontier-grid.json` manifest and are included in JSON/CSV exports.

### 11.5 Success rules

The default rule is:

```text
point success := point R_loc_max < 1
```

The uncertainty interval remains visible. A versioned configuration option can
instead require:

```text
upper-95 success := upper central 95% bound of R_loc_max < 1
```

The UI labels the selected rule. An all-retained-draw rule is deferred. The word
"guaranteed" may appear only with the close-contact axiom and envelope
qualification from Section 2.

---

## 12. Uncertainty and probability propagation

The app must distinguish three different things commonly conflated as
"uncertainty."

### 12.1 Within-cohort heterogeneity: exact probability propagation

The 16-bin immunity distribution, take/no-take splitting, breakthrough
conditioning, infection-day distribution, and shedding survival are propagated
deterministically as probability mass. This is not Monte Carlo uncertainty and
must be present in every run.

### 12.2 Calibration uncertainty: fixed joint ensemble

Where joint bootstrap or posterior draws exist, implementation will curate a
fixed, versioned ensemble offline and bundle it into the HTML. Runtime results
will be deterministic.

Requirements:

- preserve joint draws from each fit;
- define optimizer-failure and physiological-validity filters before viewing
  TPP outcomes;
- record the source file, source commit, transform, filter, and retained count;
- never construct a posterior by independently drawing marginal confidence
  interval endpoints;
- never describe sensitivity ranges as posterior probability.

Draws from different fits remain in named uncertainty groups. The app may show
their separate effects or a documented composition only when independence is a
defensible modeling assumption. It must not imply that all parameter groups
come from one global posterior. The manifest records represented and fixed
groups, retained count, weights, and the quantile algorithm.

The legacy Matlab helper that independently resamples confidence intervals is
not an acceptable probabilistic posterior for v1.

### 12.3 Parameters without joint uncertainty: sensitivity envelope

For modern boost parameters and any other quantity without defensible joint
draws, the app may evaluate named low/base/high sensitivity values. These are
displayed as **sensitivity**, not a confidence or credible interval.

### 12.4 Runtime behavior and interval semantics

Point results render first; the fixed ensemble then computes deterministically
and updates the central 95% interval. The selected success rule is finalized only
when the needed computation is complete. No runtime random sampling is allowed.

The label is **central 95% range conditional on the included parameter groups**,
not an undifferentiated confidence interval. If the ensemble is absent, invalid,
or incomplete for the configured upper-95 rule, that rule is unavailable and
the app explains why; it may not silently fall back to point success.

---

## 13. Interaction and visual design

The application should answer three questions in order: **what product is
enough, why, and where?**

### 13.1 Visual 1 -- linked TPP maps (required, primary)

Two panels are visible together:

1. the effect-space requirement map from Section 11.3; and
2. the product-design map from Section 11.4.

Both show the `R_loc_max = 1` contour, passing side, selected candidate, and
applicable comparators. Selection and hover are linked. The summary strip above
them shows the derived shedding index and authoritative direct `R_loc` result.

### 13.2 Visual 2 -- setting surface (required)

- x-axis: fecal-oral exposure/sanitation, log scale;
- y-axis: number of close social contacts;
- fill: `log10(R_loc)`;
- strong contour at `R_loc = 1`;
- named anchor points and Matlab exposure interval;
- selected product/schedule reflected immediately.

The display grid is 81 log-spaced exposure values over the selected `T` range
by every integer `N_s` value in the selected range (40 rows for the default
1-40 envelope). The status maximum remains the direct upper-corner calculation,
not an interpolated raster value.

### 13.3 Visual 3 -- mechanistic decomposition (optional for v1)

A compact plot or linked small multiples show:

- schedule-derived immunity distribution or median/interval by age;
- WPV acquisition probability;
- conditional breakthrough shedding burden;
- derived shedding index.

This visual exists to prevent users from reading a common shedding-index value
as evidence of a common mechanism.

### 13.4 Controls

The default control surface must stay small:

- named setting or global/custom envelope;
- RI plus booster choice and 28/90-day assessment lag;
- setting-specific take and immune boost strength;
- vaccine dose and Sabin-2-like/custom dose-response preset;
- point or upper-95 success rule.

The primary frontier also exposes a target crosshair/readout so a user can vary
the desired acquisition or shedding reduction and see where `R_loc` remains
uncontrolled. The official pass threshold remains `R_loc < 1`.

Advanced controls contain:

- `alpha_vax`, `beta_vax`, vaccine dose;
- `T_ih`, `T_hs`, `D_ih`, `D_hs`, `N_s`;
- setting-envelope bounds;
- index reference exposure;
- visible fixed parameters.

### 13.5 Usability requirements

- Every scientific control shows units and a plain-language definition.
- Tooltips distinguish observed inputs, calibrated parameters, assumptions, and
  derived outputs.
- A reset button restores the versioned default scenario.
- Current state is serialized in the URL hash for sharing without a server.
- The app supports keyboard operation and does not use color alone for pass/fail.
- The layout remains usable at 360 CSS pixels wide.
- Required exports are SVG for figures, JSON for the canonical scenario and
  outputs, and CSV for evaluated grids. PNG is optional. No backend is used.

---

## 14. Software architecture

### 14.1 Language and build

Use browser-native TypeScript compiled to JavaScript under Node 24 LTS and npm.
`package-lock.json` is committed. The model is small enough that WebAssembly, R
in the browser, and Matlab-generated code are unnecessary.

Locked stack:

- TypeScript for model and UI;
- D3 modules for scales, contours, and SVG rendering, bundled locally;
- esbuild for deterministic bundling;
- native Node test runner for model tests and Playwright Chromium for artifact
  smoke tests;
- a custom build step that inlines JavaScript, CSS, and parameter data into one
  `dist/index.html`.

No UI framework or hosted chart service is used in v1.

Required commands are:

```text
npm ci
npm run typecheck
npm test
npm run build
npm run check:artifact
npm run verify       # runs all of the above in release order
```

### 14.2 Proposed repository layout

```text
README.md
DESIGN_CONTRACT.md
IMPLEMENTATION_LOG.md
package.json
package-lock.json
tsconfig.json
src/
  app.ts
  styles.css
  model/
    types.ts
    parameters.ts
    bins.ts
    dose-response.ts
    boost.ts
    waning.ts
    shedding.ts
    schedule.ts
    transmission.ts
    metrics.ts
    frontier.ts
    uncertainty.ts
  ui/
    state.ts
    controls.ts
    frontier-chart.ts
    setting-chart.ts
    decomposition-chart.ts
  data/
    parameters.json
    setting-anchors.json
    frontier-grid.json
    uncertainty-ensemble.json
    provenance.json
scripts/
  build.mjs
  generate-reference-fixtures.R
  generate-uncertainty-ensemble.R
reference/
  fixtures/
tests/
  model/
  parity/
  browser/
dist/
  index.html
.github/workflows/
  test.yml
  pages.yml
```

R scripts use the local India model as the reference implementation and are run
with the machine's existing R setup. Any Python used for fixture inspection or
validation must be run through `uv`.

### 14.3 Pure model boundary

All scientific calculations must be pure functions of a serializable scenario
and parameter object. The UI may not contain scientific formulas. The same model
API must run under Node for tests and in the browser.

Ownership is binding:

| Layer | Owns | Must not own |
|---|---|---|
| source R/Matlab | reference behavior and fixture generation | runtime UI |
| `scripts/` | extraction, transforms, manifests, fixtures | hand-edited scientific defaults |
| `src/model/` | all equations, units, schedules, grids, uncertainty | DOM or chart state |
| `src/ui/` | controls, rendering, accessibility, serialization adapters | duplicated scientific formulas |
| committed data/manifests | parameters, grids, draws, provenance | undocumented copied constants |

Versioned schemas are required for `ScenarioV1`, `ScheduleV1`, `SettingV1`,
`VaccineV1`, `ParameterManifestV1`, `FrontierGridV1`, and `ModelOutputsV1`.
Fields include explicit units/bases, target/comparator ids, schedule days,
assessment lag, setting or envelope bounds, product parameters, success rule,
schema version, and manifest hashes. Objects reject unknown fields on imported
JSON. Invalid URL state falls back to defaults with a visible warning and is not
evaluated. Schema migrations are explicit functions, never permissive aliases.

Canonical serialization uses sorted keys, finite JSON numbers, and no `NaN` or
`Infinity`. The cache/export identity is a hash of canonical scenario,
parameter-manifest, uncertainty-ensemble, and frontier-grid content. Cache
invalidation and URL/export round trips require tests.

### 14.4 Performance

Targets on a current laptop:

- selected-scenario recomputation: under 100 ms;
- setting surface update: under 300 ms after parameter change;
- either point frontier grid: under 2 seconds;
- uncertainty summary for the selected scenario: under 5 seconds with
  progressive rendering.

Use memoization and precomputed kernel tables before considering workers or
WebAssembly. Any approximation introduced for speed requires a parity tolerance
and a named switch in tests.

### 14.5 Determinism

The same URL state, app version, and parameter manifest must produce bitwise-
stable serialized outputs on the same JavaScript engine and numerically stable
outputs across supported browsers. Runtime random draws are prohibited.

### 14.6 Implementation orchestration and content-block fallback

The primary implementation agent is the integrator and remains accountable for
the meaning and correctness of the merged result. Preferred execution is direct
implementation by that agent, aided where useful by as many as five or six
high-capability, fresh-context coding/scientific agents ("Sol/Terra-level" in
the planning shorthand). Suitable independent lanes are:

1. source extraction and fixture provenance;
2. bins-native biological-kernel port;
3. distribution-native transmission and calibration parity;
4. frontier/UI/accessibility implementation;
5. build, self-contained artifact, and GitHub Pages checks; and
6. adversarial semantic and test review.

Parallel agents receive bounded task manifests: objective, contract sections,
allowed files, source files, required outputs, invariants, and acceptance tests.
Use isolated worktrees for writers and read-only access for reviewers. Do not
give an agent the entire conversation when the contract and named sources are
sufficient. This limits context contamination without removing scientific
context needed to interpret the task. Delegates may commit only on isolated
task branches. Only the primary integrator merges into the integration branch,
pushes, or changes shared scientific state.

A **content block** means a model or provider refuses before producing a usable
technical result. The block is an input to judgment, not the judgment itself.
The primary integrator is expected to assess the actual requested operations,
inputs, and outputs and classify the block as `likely_false_positive`,
`substantive`, or `unclear`, with a short rationale. Source-model translation,
deterministic simulation, uncertainty propagation, static visualization, and
software testing under this contract are presumptively legitimate scientific
software work; biological vocabulary alone does not change that assessment.
Because this project has already produced false positives on a software-plan
review, that observed propensity is a legitimate prior: a block on a plainly
code-level task should increase the priority of an exact file/function/test
reframe rather than trigger automatic escalation. The prior does not override
the substance of the requested work.

When the primary integrator judges a block to be a likely false positive with
high confidence, the integrator may reframe and continue without asking Mike
first. A good reframe truthfully narrows the task to named files, equations,
data transformations, outputs, invariants, and tests. It may omit unrelated
conversation and earlier refusals, but it must preserve the scientific purpose,
target, requested output, and every consequential semantic constraint.

The false-positive path is:

1. record the classification and reason;
2. make the truthful technical reframe;
3. make at most one fresh-context retry with a high-capability agent if
   available; and
4. if needed, delegate the bounded task to GPT-5.5 under direct supervision.

A `substantive` block stops delegation. An `unclear` block triggers direct
source/contract review by the primary integrator; if it remains unclear and the
distinction could change harm or meaning, ask Mike before proceeding.

This fallback is not permission to evade a genuine safety restriction. Do not
ask an agent to ignore policy, conceal the purpose, reconstruct prohibited
material, or fragment a disallowed task across agents. If narrowing would change
the requested semantics, or if the block identifies a substantive safety issue,
the primary agent stops and asks for a compliant contract amendment.

If the supervised GPT-5.5 fallback also blocks, the primary agent either
implements the bounded task directly or records the blocker and asks Mike when
no safe progress remains. Do not continue hopping among providers to obtain a
different safety decision.

GPT-5.5 is an execution fallback, not a semantic authority. Each delegated task
must have a predeclared output and discriminator. The primary agent must inspect
the complete result or diff, compare it directly with the named source model,
run the applicable parity/invariant/schema/browser tests, and reject
helpfulness-shaped residue such as silent defaults, compatibility aliases,
mean-propagation shortcuts, or weakened uncertainty claims. GPT-5.5 may not
unilaterally change scientific defaults, model interpretation, calibration
tolerances, uncertainty semantics, or success criteria.

`IMPLEMENTATION_LOG.md` records each delegation's bounded objective, executor
and version when available, affected files, content-block classification and
rationale, retry status, output disposition, reviewer, and verification
performed. It records concise task contracts and outcomes, not full chat
transcripts. A blocked or fallback result is never merged merely because it is
the only result obtained.

---

## 15. Verification contract

### 15.1 Kernel parity

Reference fixtures will be generated from the source R/Matlab implementations
for grids spanning the UI domain.

Required parity tests:

1. dose-response probability for Sabin/OPV and WPV;
2. per-bin susceptibility quadrature;
3. take and no-take Bayesian tilting;
4. boost transition matrices;
5. one-, three-, and four-dose schedule composition;
6. waning at all schedule/assessment intervals;
7. WPV shedding survival;
8. conditional shedding intensity and joint survival-intensity expectation;
9. fixed-titer primary -> secondary -> tertiary incidence;
10. `R_loc` at published low, moderate, and high anchors.

Default numeric tolerance is relative `1e-8` for direct ports and `1e-5` for
integrated transmission outputs. Any looser tolerance must be justified in the
test name and contract amendment.

### 15.2 Faithful-modernization calibration gate

Release requires both levels:

1. **Degenerate parity:** distributions concentrated in the source fixed-titer
   bins reproduce primary, secondary, tertiary, and `R_loc` fixtures within
   relative `1e-5`.
2. **Distribution-native compatibility:** at every published low/moderate/high
   and named calibration case, the modern central `R_loc` stays within
   `0.1 log10` of its reference and does not cross `R_loc = 1` or reverse the
   source low/moderate/high control conclusion.

The second tolerance is a release discriminator, not an assertion that the two
models are identical. A failure blocks release and triggers calibration review.
Changing the tolerance is a contract change. Refitting the reduced transmission
layer requires a versioned artifact containing calibration data, objective,
free/fixed parameters, optimizer settings, diagnostics, before/after fixtures,
and explicit scientific approval. It may not be repaired by an undocumented
multiplier.

### 15.3 Scientific invariants

Tests must establish over the declared domain:

- probabilities remain in `[0,1]`;
- bin mass is conserved;
- higher mucosal immunity does not increase WPV susceptibility;
- higher mucosal immunity does not increase expected WPV shedding duration or
  intensity;
- larger fecal-oral exposure, contact frequency, or `N_s` does not decrease
  `R_loc`;
- with all else fixed, better take or larger boost does not increase `R_loc`;
- zero exposure or zero contacts gives `R_loc = 0`;
- identical product and schedule inputs give identical outputs;
- repeated doses use conditioned distributions, not repeated scalar efficacy;
- the frontier pass region agrees with direct `R_loc` evaluation;
- the rectangular setting maximum agrees with direct grid search;
- displayed contours do not change evaluated-point classifications.

### 15.4 Anchor reproduction

The fixed-titer compatibility mode must reproduce the qualitative published
categories:

- low setting: WPV fecal-oral `R_loc < 1` for naive immunity under the stated
  source assumptions;
- moderate setting: naive WPV can exceed 1, while one-dose-equivalent immunity
  controls transmission;
- high setting: one-dose-equivalent immunity is insufficient and substantially
  higher immunity is required.

Exact acceptance values will be stored as fixtures generated from the source
Matlab code rather than transcribed from plots.

### 15.5 Matlab validation

An optional compatibility scenario will use the Taniuchi 2017 Table S6
immunities and age-dependent exposure model to compare predicted infant and
household-contact shedding/incidence with the published supplement. This is a
validation of the reduced household link, not a claim that Matlab's full
multiscale contact structure has been reproduced.

### 15.6 Validation, frontier, and artifact tests

Schema tests cover missing, unknown, nonfinite, out-of-range, and unit-mismatched
inputs. Invalid scientific state fails closed with an actionable message; it is
never clamped except where the equation explicitly defines `clamp01`.

Frontier tests compare selected grid cells and contour sides with direct
`R_loc` calls, cover threshold ties, and verify cache invalidation after every
scientific input or manifest change.

The release build must pass:

- exactly one required runtime file: `dist/index.html`;
- no external script, stylesheet, font, image, or data requests;
- no JavaScript console errors at load or during a scripted interaction sweep;
- URL-state round trip;
- keyboard navigation smoke test;
- Chromium smoke tests; Firefox and WebKit are recommended pre-release checks
  but are not v1 release blockers;
- GitHub Pages path-prefix test;
- generated artifact hash recorded in the release workflow;
- a clean rebuild leaves committed `dist/index.html` unchanged.

---

## 16. Deployment and release

- GitHub Actions runs type checking, unit tests, parity tests, build, and artifact
  checks on pull requests.
- The Pages workflow deploys the tested `dist/index.html` from `main`.
- No CDN or API is required at runtime.
- The app footer displays:
  - app version/commit;
  - parameter-manifest version;
  - design-contract version;
  - links to the source paper, source repositories, and model assumptions.
- Release notes list any change to equations, defaults, setting anchors,
  uncertainty ensembles, or success classification.

Auditability is part of the release, not local scaffolding. Commit the lockfile,
fixture/ensemble generators, generated fixtures, parameter and grid manifests,
provenance records, `IMPLEMENTATION_LOG.md`, tests, workflows, and
`dist/index.html`. Generated records include commands, source commits, schema
versions, filters, and hashes. CI uses `npm ci`, runs `npm run verify`, rebuilds
the committed artifact without a diff, and deploys that tested artifact. No
release-critical input may exist only in an untracked local source checkout or
CI workspace.

---

## 17. Definition of done for the one-shot implementation

Implementation is complete only when all of the following are true:

1. The contract is locked before coding begins.
2. The app opens from the local filesystem and from GitHub Pages.
3. The release consists of one self-contained HTML file.
4. WPV1 is the visible target; Sabin 2 OPV, India-semantics IPV, and a
   hypothetical OPV-like vaccine can be compared.
5. RI at 6, 10, and 14 weeks and boosters at 1-4 years compose correctly, with
   assessment 28 or 90 days after the last dose for every role.
6. Users can vary take, boost, dose-response, setting, contacts, sanitation, and
   schedule.
7. The primary result is the linked requirement and product-design Pareto maps,
   not a scalar shedding target.
8. Acquisition blocking and breakthrough shedding are shown separately.
9. The setting surface includes low, Houston/Louisiana, Matlab, and UP/Bihar.
10. The default point and optional upper-95 success rules are distinguishable,
    and uncertainty coverage is explicit.
11. The app never reports a global guarantee without the v1 sufficiency axiom
    and setting-envelope qualification.
12. All parity, calibration-gate, invariant, schema, frontier, browser, and
    artifact tests pass.
13. The README explains the question, limitations, development commands, and
    Pages URL.
14. Versioned JSON/CSV/SVG exports and manifests reproduce every displayed
    result.
15. All audit inputs and the self-contained artifact are committed, and a clean
    CI rebuild produces no diff.
16. Every delegated or fallback task is dispositioned and verified in
    `IMPLEMENTATION_LOG.md`; no unreviewed agent output remains in the release.

---

## 18. Locked decisions and implementation discretion

The following decisions are binding for v1:

1. WPV1 is the visible target and Sabin 2 is the live comparator.
2. Schedule assessment is selectable at 28 or 90 days after the last dose.
3. The same selected schedule and assessment age apply to index, household, and
   social roles.
4. IPV follows current `india-polio` assumptions: serum boosting for everyone;
   mucosal boosting only after prior live infection.
5. The new-vaccine boost axis varies `mu0_new`; `sigma0_new = 2.4` is fixed.
6. Dose, `alpha_vax`, `beta_vax`, and `take_context` are independent TPP inputs;
   `gamma_vax` is fixed. Sabin-2-like dose and parameter anchors are present.
7. The Matlab base uses measured 18.6 micrograms/day household exposure and the
   borrowed `N_s = 3` moderate social link, visibly labeled as hybrid.
8. The v1 global envelope is `T = 0.1-2,000 micrograms/exposure`, `N_s = 1-40`,
   with source contact frequencies.
9. Index breakthrough is conditioned on one WPV HID50.
10. Point `R_loc_max < 1` is the default criterion with uncertainty shown; a
    configuration option can require the upper central 95% bound below 1.
11. Both the effect-space and product-design frontier views are simultaneously
    visible and linked; shedding index is a summary, not a pass axis.
12. Everything needed for auditability and reproducibility, including the built
    HTML artifact, is committed.
13. The primary model is distribution-native through index, household, and
    social links. The PLOS Biology calculation is a calibration comparator;
    material `R_loc` disagreement triggers refitting review.
14. Close-contact control is deliberately treated as sufficient for the v1 TPP
    criterion, with the qualification in Section 2.
15. Implementation may use bounded fresh-context agents and, after a
    high-confidence `likely_false_positive` block, supervised GPT-5.5 only under
    the controls in Section 14.6.

Implementation discretion is limited to presentation details, accessible color
choices, module decomposition below the ownership boundaries, and equivalent
algorithms that satisfy all fixtures, invariants, performance targets, and
schemas. Scientific defaults, units, outcome definitions, success rules, or
calibration tolerances require a contract amendment.

---

## 19. Deferred extensions

Potential v2 work, explicitly not required for the first implementation:

- additional WPV, Sabin, nOPV, and cVDPV strains;
- independent effects on acquisition, duration, and shedding concentration;
- variable boost variance and richer immune-response parameterization;
- serum and mucosal joint distributions;
- IPV formulations with empirically calibrated mucosal effects;
- dose coverage, dropout, access heterogeneity, and missed communities;
- background infection and natural boosting;
- explicit environmental and oral-oral pathways;
- age-structured population next-generation operators;
- Matlab household/bari/village contact structure;
- vaccine-virus transmission, reversion, and evolutionary safety;
- schedule optimization under dose, visit, stock, and delivery constraints;
- formal probabilistic calibration of product success; and
- all-retained-draw and other robust decision rules.

---

## 20. Provenance links

- Famulare M, Selinger C. *Assessing the stability of polio eradication after
  the withdrawal of oral polio vaccine.* PLOS Biology (2018):
  <https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468>
- Related interactive data explorer:
  <https://famulare.github.io/cessationStability/onlineVisualization/>
- Taniuchi et al. 2017 article and supplement:
  <https://pmc.ncbi.nlm.nih.gov/articles/PMC5610141/>
- Later Matlab multiscale-model context:
  <https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1009690>
