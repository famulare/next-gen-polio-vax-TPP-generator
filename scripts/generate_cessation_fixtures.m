function generate_cessation_fixtures(source_root, motif_output_path, calibration_output_path)
  % Execute the pinned Matlab motif through Octave and serialize direct outputs.
  % This wrapper deliberately calls the source implementation rather than a
  % translated equation. The TypeScript compatibility port is verified against
  % the resulting fixture separately.
  analysis_root = fullfile(source_root, "analysis");
  primary_model_path = fullfile(analysis_root, "transmission", "primarySecondaryTertiaryDoseModel.m");
  helper_path = fullfile(analysis_root, "helperFunctions", "keyValuePairVararginHandler.m");
  if (!exist(primary_model_path, "file") || !exist(helper_path, "file"))
    error("The Cessation Matlab fixture source files are missing.");
  endif
  addpath(genpath(analysis_root));

  cases = [
    make_case("default-wpv-motif", "Source default WPV motif", 10^(-5.2943), 10^(-5.2943), 1, 8.9685, 3, 0, 0, 0),
    make_case("low-naive", "Published low anchor; naive fixed titer", 0.5e-6, 0.5e-6, 1, 8.9685, 3, 0, 0, 0),
    make_case("moderate-naive", "Published moderate anchor; naive fixed titer", 5e-6, 5e-6, 1, 8.9685, 3, 0, 0, 0),
    make_case("moderate-fixed-titer-3", "Published moderate anchor; all roles fixed at log2 titer 3", 5e-6, 5e-6, 1, 8.9685, 3, 3, 3, 3),
    make_case("matlab-hybrid-naive", "Matlab daily-exposure hybrid anchor; naive fixed titer", 18.6e-6, 18.6e-6 / 8.9685, 1, 8.9685, 3, 0, 0, 0),
    make_case("high-fixed-titer-3", "Published high anchor; all roles fixed at log2 titer 3", 230e-6, 230e-6, 1, 8.9685, 10, 3, 3, 3),
    make_case("high-fixed-titer-8", "Published high anchor; all roles fixed at log2 titer 8", 230e-6, 230e-6, 1, 8.9685, 10, 8, 8, 8)
  ];

  results = arrayfun(@evaluate_case, cases);
  [commit_status, commit] = system(sprintf("git -C %s rev-parse HEAD", shell_quote(source_root)));
  if (commit_status != 0)
    error("Cannot resolve the Cessation source commit.");
  endif
  [branch_status, branch] = system(sprintf("git -C %s branch --show-current", shell_quote(source_root)));
  if (branch_status != 0)
    error("Cannot resolve the Cessation source branch.");
  endif
  [status_code, status_output] = system(sprintf("git -C %s status --porcelain --untracked-files=all", shell_quote(source_root)));
  if (status_code != 0)
    error("Cannot resolve the Cessation source status.");
  endif
  status_lines = strsplit(strtrim(status_output), "\n");
  if (isempty(strtrim(status_output)))
    status_lines = {};
  endif
  untracked = {};
  for index = 1:numel(status_lines)
    line = status_lines{index};
    if (strncmp(line, "??", 2))
      untracked{end + 1} = strtrim(line(3:end));
    else
      error("Refusing fixture generation with tracked Cessation source changes.");
    endif
  endfor

  fixture = struct();
  fixture.schemaVersion = "SourceMotifFixtureV1";
  fixture.coverage = "partial: Cessation Matlab fixed-titer primary-secondary-tertiary incidence and named-anchor motif outputs";
  fixture.releaseGateSatisfied = false;
  fixture.generatorCommand = "Rscript scripts/generate-reference-fixtures.R";
  fixture.source = struct(
    "repository", "cessationStability",
    "commit", strtrim(commit),
    "branch", branch_or_detached(strtrim(branch)),
    "trackedDirty", false,
    "untrackedPaths", {untracked},
    "runtime", ["GNU Octave " version],
    "sourceFilesRead", {{primary_model_path, helper_path}}
  );
  fixture.inputs = struct(
    "serotype", 4,
    "horizonDays", 100,
    "vaccineDoseTCID50", 1e6,
    "perDoseEfficacy", 0.8863,
    "primaryAgeMonths", 12,
    "secondaryAgeMonths", 48,
    "tertiaryAgeMonths", 48,
    "sourceFixedParameters", struct(
      "doseResponse", [2.31, 0.444, 0.4624],
      "sheddingDuration", [log(43), log(1.164), log(1.69)],
      "sheddingIntensity", [1.64, 0.18, 0.056, 0.32],
      "peakAge", [6.67, 4.29, 9.92],
      "titerFloor", 10^2.6
    )
  );
  fixture.cases = results;

  output_file = fopen(motif_output_path, "w");
  if (output_file < 0)
    error("Cannot open Cessation motif fixture output path.");
  endif
  cleaner = onCleanup(@() fclose(output_file));
  fprintf(output_file, "%s\n", jsonencode(fixture));

  calibration_cases = [
    make_calibration_case(
      "houston-naive-index", "Houston: naive index and naive contacts",
      {"primary", "secondary", "tertiary"}, 45, 1e6, 0.8863,
      18, 48, 48, 10^(-5.294306), 10^(-5.294306), 1, 10^(0.952719), 3, 0, 0, 0,
      calibration_state_mapping("naive", [], 0, 0, false, "naive", 0, false, false)
    ),
    make_calibration_case(
      "india-high-contact", "India: naive index, high-immunity household contacts",
      {"primary", "secondary"}, 45, 1e6, 1,
      12, 48, 48, 10^(-3.6347), 10^(-3.6347 + 0.97), 1, 8.9685, 3, 0, 9, 0,
      calibration_state_mapping("naive", [], 0, 0, false, "campaign-history-gaussian", 9, true, true)
    ),
    make_calibration_case(
      "matlab-schedule-index", "Matlab: 6/10/14-week OPV-proxy variance family, fitted index mean and Tih",
      {"primary", "secondary"}, 45, 1e6, 0.8863,
      5, 5, 5, 18.6e-6, 18.6e-6 / 8.9685, 1, 8.9685, 3, 8.374917615821225, 0, 0,
      calibration_state_mapping("schedule-calibrated-gaussian", [42, 70, 98], 5 * 365.25 / 12, 8.374917615821225, true, "naive", 0, true, false)
    )
  ];
  calibration_fixture = struct();
  calibration_fixture.schemaVersion = "SourcePrevalenceCalibrationFixtureV1";
  calibration_fixture.coverage = "partial: source-executed day-1-45 prevalence targets for the approved Houston, India, and Matlab simplified calibration scenarios";
  calibration_fixture.releaseGateSatisfied = false;
  calibration_fixture.generatorCommand = "Rscript scripts/generate-reference-fixtures.R";
  calibration_fixture.source = fixture.source;
  calibration_fixture.dayConvention = struct(
    "sourceOutputDays", 1:45,
    "browserElapsedDays", 0:44,
    "meaning", "Source day 1 is the initial-infection instant and has zero observable shedding."
  );
  calibration_fixture.cases = arrayfun(@evaluate_calibration_case, calibration_cases);

  calibration_file = fopen(calibration_output_path, "w");
  if (calibration_file < 0)
    error("Cannot open Cessation calibration fixture output path.");
  endif
  calibration_cleaner = onCleanup(@() fclose(calibration_file));
  fprintf(calibration_file, "%s\n", jsonencode(calibration_fixture));
endfunction

function fixture_case = make_case(id, label, tih, ths, dih, dhs, ns, primary_titer, secondary_titer, tertiary_titer)
  fixture_case = struct(
    "id", id,
    "label", label,
    "TihGramsPerExposure", tih,
    "ThsGramsPerExposure", ths,
    "dIhExposuresPerPersonDay", dih,
    "dHsExposuresPerPersonDay", dhs,
    "Ns", ns,
    "primaryLog2NAb", primary_titer,
    "secondaryLog2NAb", secondary_titer,
    "tertiaryLog2NAb", tertiary_titer
  );
endfunction

function result = evaluate_case(fixture_case)
  output = source_output(fixture_case, 100, 1e6, 0.8863, 12, 48, 48);
  result = fixture_case;
  result.output = output;
endfunction

function result = evaluate_calibration_case(fixture_case)
  output = source_output(
    fixture_case,
    fixture_case.horizonDays,
    fixture_case.vaccineDoseTCID50,
    fixture_case.perDoseEfficacy,
    fixture_case.primaryAgeMonths,
    fixture_case.secondaryAgeMonths,
    fixture_case.tertiaryAgeMonths
  );
  result = fixture_case;
  result.output = output;
endfunction

function output = source_output(fixture_case, horizon_days, vaccine_dose, per_dose_efficacy, primary_age, secondary_age, tertiary_age)
  experiment = primarySecondaryTertiaryDoseModel(
    "serotype", 4,
    "runNetwork", false,
    "t", 1:horizon_days,
    "vaccineDose", vaccine_dose,
    "perDoseEfficacy", per_dose_efficacy,
    "primaryAgeMos", primary_age,
    "secondaryAgeMos", secondary_age,
    "tertiaryAgeMos", tertiary_age,
    "secondaryContactAcquire", fixture_case.TihGramsPerExposure,
    "tertiaryContactAcquire", fixture_case.ThsGramsPerExposure,
    "numDailyPrimarySecondaryContact", fixture_case.dIhExposuresPerPersonDay,
    "numDailySecondaryTertiaryContact", fixture_case.dHsExposuresPerPersonDay,
    "primaryLog2NAb", fixture_case.primaryLog2NAb,
    "secondaryLog2NAb", fixture_case.secondaryLog2NAb,
    "tertiaryLog2NAb", fixture_case.tertiaryLog2NAb
  );
  primary = experiment.primary.incidence;
  secondary = experiment.secondary.incidence;
  tertiary = experiment.tertiary.incidence;
  primary_prevalence = experiment.primary.prevalence;
  secondary_prevalence = experiment.secondary.prevalence;
  tertiary_prevalence = experiment.tertiary.prevalence;
  primary_total = sum(primary);
  if (primary_total <= 0)
    error("Calibration source primary infection probability must be positive.");
  endif
  output = struct(
    "primaryIncidence", primary,
    "secondaryIncidence", secondary,
    "tertiaryIncidence", tertiary,
    "primaryPrevalence", primary_prevalence,
    "secondaryPrevalence", secondary_prevalence,
    "tertiaryPrevalence", tertiary_prevalence,
    "conditionedPrimaryPrevalence", primary_prevalence / primary_total,
    "conditionedSecondaryPrevalence", secondary_prevalence / primary_total,
    "conditionedTertiaryPrevalence", tertiary_prevalence / primary_total,
    "primaryTotal", primary_total,
    "secondaryTotal", sum(secondary),
    "tertiaryTotal", sum(tertiary),
    "rLoc", fixture_case.Ns * sum(tertiary) / primary_total
  );
endfunction

function fixture_case = make_calibration_case(id, label, target_roles, horizon_days, vaccine_dose, per_dose_efficacy, primary_age, secondary_age, tertiary_age, tih, ths, dih, dhs, ns, primary_titer, secondary_titer, tertiary_titer, browser_state_mapping)
  fixture_case = make_case(id, label, tih, ths, dih, dhs, ns, primary_titer, secondary_titer, tertiary_titer);
  fixture_case.targetRoles = target_roles;
  fixture_case.horizonDays = horizon_days;
  fixture_case.vaccineDoseTCID50 = vaccine_dose;
  fixture_case.perDoseEfficacy = per_dose_efficacy;
  fixture_case.primaryAgeMonths = primary_age;
  fixture_case.secondaryAgeMonths = secondary_age;
  fixture_case.tertiaryAgeMonths = tertiary_age;
  fixture_case.browserStateMapping = browser_state_mapping;
endfunction

function result = calibration_state_mapping(index_state, index_schedule_dose_days, index_assessment_age_days, index_mean_log2_nab, fit_index_mean_log2_nab, contact_state, contact_mean_log2_nab, fit_tih, fit_contact_mean_log2_nab)
  result = struct(
    "indexState", index_state,
    "indexScheduleDoseDays", index_schedule_dose_days,
    "indexAssessmentAgeDays", index_assessment_age_days,
    "indexMeanLog2NAb", index_mean_log2_nab,
    "fitIndexMeanLog2NAb", fit_index_mean_log2_nab,
    "householdState", contact_state,
    "socialState", contact_state,
    "contactMeanLog2NAb", contact_mean_log2_nab,
    "fitTih", fit_tih,
    "fitContactMeanLog2NAb", fit_contact_mean_log2_nab
  );
endfunction

function result = branch_or_detached(branch)
  if (isempty(branch))
    result = "(detached HEAD)";
  else
    result = branch;
  endif
endfunction

function result = shell_quote(value)
  result = ["'" strrep(value, "'", "'\\''") "'"];
endfunction
