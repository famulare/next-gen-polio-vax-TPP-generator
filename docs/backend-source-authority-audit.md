# Backend fixture-input source and contract authority audit

**Audit date:** 2026-07-17
**Browser baseline:** backend-remediation work following commit `0a85b7c`
**Pinned sources:** `india-polio@1e3e832742e84a36fbc75d81b3a2d19cde8208e6`,
`cessationStability@3d779963e9febe8e6262964b185c8277234f41e0`

## Purpose and rule

This audit checks every scientific constant injected by
`scripts/generate-reference-fixtures.R` rather than assuming that executing a
source function makes its supplied parameters source-derived. The locked
design contract controls production semantics. A pinned source fixture can
remain a diagnostic when source and contract differ, but it may not be labeled
production parity for that input.

## Input audit

| Fixture input family | Generator values | Authority and disposition |
|---|---|---|
| GH5 nodes and weights | five committed nodes/weights | Direct India source constants in `model/R/mixture.R:13-16`; production parity input. |
| Bin-0 waned distribution | center `0.25`, SD `0.5/sqrt(12)` | Direct India source constants in `model/R/mixture.R:19-22`; production parity input. |
| Within-bin susceptibility SD | `0.289` | Direct India source convention in `model/R/susceptibility.R:14-17`; production parity input. |
| Within-bin shedding SD | `0.4` | Direct India source convention in `model/R/shedding.R:24-34`; production parity input. |
| Dose-response alpha/beta/gamma | grid plus WPV `0.444/2.31/0.4624`, Sabin beta `8` | Contract Sections 7.1--7.2 and fixed catalog; also accepted as parameters by the India kernel. Grid endpoints are versioned browser hard bounds, not estimates from the source. |
| Dose-response low-dose switch | `dose/beta <= 0.01` | India numerical policy in `model/schemas/params_schema.yaml:282`; **source diagnostic only**. Production uses the exact contract equation without a branch. Tests require at least one fixture case to discriminate the two. |
| Vaccine dose | `10^5.3` TCID50 | Contract fixed catalog/default. Passed into the parameterized India kernel; not inferred from the called R function. |
| `take_context` and formulation multiplier | product/grid values; multiplier `1` | Contract exploration/default and fixed catalog. They are external scenario inputs to the India take kernel, not source estimates. |
| Boost `mu0/sigma0` | grid `mu0=0,2,4,6,8`; fixed/default `6/2.4`; WPV `7.2/2.9` where used | Contract Sections 7.3--7.4. India schema independently records Sabin `6/2.4` and WPV `7.2/2.9` at `model/schemas/params_schema.yaml:197-204`. |
| Waning lambda | `0.87` | Contract Section 7.5 and India schema `model/schemas/params_schema.yaml:180`; production parity input. Browser day conversion `365.25/12` is the declared browser convention. |
| Schedule days/assessment lags | RI days `42,70,98`, optional annual booster, lag `28/90` | Contract Section 8. The R functions accept injected schedules; the fixture verifies composition under the browser schedule rather than claiming those days were discovered in source. |
| Shedding duration | India diagnostic `b1=3.76`, `b2=0.1519`, `b3=0.52`; production `ln(43)`, `ln(1.164)`, `ln(1.69)` | India schema rounded values at `model/schemas/params_schema.yaml:128-140`. Exact values are direct Cessation constants in `primarySecondaryTertiaryDoseModel.m:33-38` and control production under Contract Section 7.6. India shedding survival is therefore diagnostic, not exact production parity. |
| Shedding age amplitude | `6.67/4.29/9.92` | Shared parameter values. India applies the divergent no-offset equation; production deliberately uses the Cessation seven-month plateau/offset under the prior approved amendment. India joint intensity remains diagnostic. |
| Immunity suppression and temporal profile | `0.056`, `1.64/0.18/0.32` | Present in both the India schema (`model/schemas/params_schema.yaml:151-163`) and Cessation private parameters (`primarySecondaryTertiaryDoseModel.m:39-40`); production parity inputs. |
| Shedding titer floor | India diagnostic `398.1`; production `10^2.6` | India schema rounded constant at `model/schemas/params_schema.yaml:148`; production retains the exact equation value from the contract. Fixture is diagnostic at this input. |
| Cessation motif horizon and contacts | global array `1:100`, `D_ih=1`, `D_hs=8.9685` | Direct Cessation inputs in `primarySecondaryTertiaryDoseModel.m:3-15`. The scalar compatibility fixture retains that global 100-day window. Production instead uses the amended independent 120-day post-infection link horizon and does not relabel the scalar fixture as product-schedule parity. |
| Named motif doses/contact counts/titers | explicit fixture cases | Contract named-anchor mappings or source-executed Cessation inputs, recorded per case. They are context/compatibility cases, not fitted browser product defaults. |

## Conclusions

1. No remaining injected value is being treated as independent source evidence
   merely because it was passed into a source function.
2. The three consequential conflicts are explicit: India low-dose branch,
   India rounded shedding constants, and the Cessation global horizon. Their
   fixtures remain diagnostics/compatibility records while production follows
   the amended contract.
3. Default/product-grid fixtures intentionally use versioned contract inputs.
   They establish source-kernel behavior conditional on those inputs; they do
   not claim the source selected the browser's TPP defaults.
4. Regeneration remains pinned to exact clean source commits, and fixture
   manifests record files read, commands, runtime, and hashes.
