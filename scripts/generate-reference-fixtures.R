#!/usr/bin/env Rscript

# This generator currently writes explicitly partial R-kernel fixtures.
# It permits explicit source-checkout paths for controlled testing, but every
# checkout must still exactly match the provenance lock before any source file
# may be used. The fixture manifest records the incomplete coverage so the
# generated artifact cannot be mistaken for a completed parity suite.

script_path <- function() {
  arguments <- commandArgs(trailingOnly = FALSE)
  file_arg <- sub("^--file=", "", arguments[grepl("^--file=", arguments)])
  if (length(file_arg) != 1L) stop("Cannot determine the fixture-generator script path")
  normalizePath(file_arg, mustWork = TRUE)
}

project_root <- dirname(dirname(script_path()))
provenance_path <- file.path(project_root, "src", "data", "provenance.json")
fixture_schema_version <- "ReferenceFixtureV1"

read_provenance <- function(path) {
  if (!file.exists(path)) stop("Missing provenance manifest: ", path)
  lines <- readLines(path, warn = FALSE)
  manifest <- paste(lines, collapse = "\n")

  commit_for <- function(key) {
    pattern <- paste0('"', key, '"[[:space:]]*:[[:space:]]*"([0-9a-f]{40})"')
    matched <- regmatches(manifest, regexec(pattern, manifest, perl = TRUE))[[1]]
    if (length(matched) != 2L) stop("Missing or invalid locked commit for ", key, " in ", path)
    matched[[2L]]
  }

  source_start <- grep('"sourceFiles"', lines, fixed = TRUE)
  if (length(source_start) != 1L) stop("Missing sourceFiles list in ", path)
  source_end <- which(trimws(lines) %in% c("]", "],"))
  source_end <- source_end[source_end > source_start[[1L]]]
  if (length(source_end) < 1L) stop("Unterminated sourceFiles list in ", path)

  source_lines <- trimws(lines[seq.int(source_start[[1L]] + 1L, source_end[[1L]] - 1L)])
  source_lines <- sub(",$", "", source_lines)
  if (length(source_lines) == 0L || any(!startsWith(source_lines, '"') | !endsWith(source_lines, '"'))) {
    stop("Invalid sourceFiles list in ", path)
  }

  list(
    commits = list(
      cessationStability = commit_for("cessationStability"),
      indiaPolio = commit_for("indiaPolio")
    ),
    source_files = substring(source_lines, 2L, nchar(source_lines) - 1L)
  )
}

run_git <- function(repo, args) {
  output <- suppressWarnings(system2("git", shQuote(c("-C", repo, args)), stdout = TRUE, stderr = TRUE))
  exit_code <- attr(output, "status")
  if (is.null(exit_code)) exit_code <- 0L
  list(exit_code = as.integer(exit_code), output = output)
}

require_git <- function(repo, args, description) {
  result <- run_git(repo, args)
  if (result$exit_code != 0L) {
    detail <- paste(result$output, collapse = "\n")
    stop("Cannot ", description, " in locked source repository: ", repo,
         if (nzchar(detail)) paste0("\n", detail) else "")
  }
  result$output
}

repo_status <- function(path) {
  porcelain <- require_git(path, c("status", "--porcelain", "--untracked-files=all"), "read git status")
  untracked <- porcelain[startsWith(porcelain, "??")]
  list(
    tracked_dirty = any(!startsWith(porcelain, "??")),
    untracked = trimws(substring(untracked, 3L))
  )
}

repo_from_environment <- function(name, default_path) {
  selected <- Sys.getenv(name, unset = default_path)
  normalizePath(selected, mustWork = FALSE)
}

validate_declared_files <- function(declared_files, canonical_root, selected_root, label) {
  prefix <- paste0(canonical_root, "/")
  matching <- declared_files[startsWith(declared_files, prefix)]
  if (length(matching) == 0L) stop("No declared source files for ", label, " in provenance manifest")

  relative_paths <- substring(matching, nchar(prefix) + 1L)
  selected_paths <- file.path(selected_root, relative_paths)
  missing <- selected_paths[!file.exists(selected_paths)]
  if (length(missing) > 0L) {
    stop("Missing declared source files in locked source repository: ",
         paste(missing, collapse = ", "))
  }
  selected_paths
}

json_string <- function(value) {
  value <- as.character(value)
  if (length(value) != 1L || is.na(value)) stop("JSON string values must be a single non-missing value")
  escaped <- gsub("\\\\", "\\\\\\\\", value)
  escaped <- gsub('"', '\\"', escaped, fixed = TRUE)
  paste0('"', escaped, '"')
}

json_number <- function(value) {
  value <- as.numeric(value)
  if (length(value) != 1L || !is.finite(value)) stop("Fixture numeric values must be finite scalars")
  sprintf("%.17g", value)
}

json_string_array <- function(values) {
  paste0("[", paste(vapply(values, json_string, character(1)), collapse = ", "), "]")
}

json_number_array <- function(values) {
  paste0("[", paste(vapply(values, json_number, character(1)), collapse = ", "), "]")
}

json_number_matrix <- function(values) {
  values <- as.matrix(values)
  paste0("[", paste(vapply(seq_len(nrow(values)), function(index) {
    json_number_array(values[index, ])
  }, character(1)), collapse = ", "), "]")
}

sha256_file <- function(path) {
  output <- suppressWarnings(system2("shasum", shQuote(c("-a", "256", path)), stdout = TRUE, stderr = TRUE))
  exit_code <- attr(output, "status")
  if (!is.null(exit_code) && exit_code != 0L) stop("Cannot calculate SHA-256 for fixture: ", path)
  fields <- strsplit(trimws(output[[1L]]), "[[:space:]]+")[[1L]]
  if (length(fields) < 1L || !grepl("^[0-9a-f]{64}$", fields[[1L]])) {
    stop("Unexpected SHA-256 output for fixture: ", path)
  }
  fields[[1L]]
}

write_atomic <- function(path, lines) {
  dir.create(dirname(path), recursive = TRUE, showWarnings = FALSE)
  temporary <- paste0(path, ".tmp")
  on.exit(unlink(temporary), add = TRUE)
  writeLines(lines, temporary, useBytes = TRUE)
  if (!file.rename(temporary, path)) stop("Cannot write fixture: ", path)
}

record_json <- function(label, record) {
  paste0(
    "    {\"repository\": ", json_string(label),
    ", \"path\": ", json_string(record$path),
    ", \"commit\": ", json_string(record$commit),
    ", \"branch\": ", json_string(record$branch),
    ", \"trackedDirty\": false",
    ", \"untrackedPaths\": ", json_string_array(record$untracked),
    ", \"declaredSourceFiles\": ", json_string_array(record$declared_files), "}"
  )
}

write_india_susceptibility_fixture <- function(india_record, output_path) {
  source_files_read <- c(
    file.path(india_record$path, "model", "R", "mixture.R"),
    file.path(india_record$path, "model", "R", "titer_bounds.R"),
    file.path(india_record$path, "model", "R", "susceptibility.R")
  )
  source(source_files_read[[1L]])
  source(source_files_read[[2L]])
  source(source_files_read[[3L]])

  inputs <- list(log2NMax = 15L, lowDoseLinearRatio = 0.01)
  cases <- list(
    list(id = "wpv-zero-naive", strain = "WPV", alpha = 0.444, beta = 2.31, gamma = 0.4624, dose = 0, ever_infected = FALSE),
    list(id = "wpv-low-linear-naive", strain = "WPV", alpha = 0.444, beta = 2.31, gamma = 0.4624, dose = 2.31 * 0.001, ever_infected = FALSE),
    list(id = "wpv-linear-cutoff-naive", strain = "WPV", alpha = 0.444, beta = 2.31, gamma = 0.4624, dose = 2.31 * inputs$lowDoseLinearRatio, ever_infected = FALSE),
    list(id = "wpv-linear-cutoff-waned", strain = "WPV", alpha = 0.444, beta = 2.31, gamma = 0.4624, dose = 2.31 * inputs$lowDoseLinearRatio, ever_infected = TRUE),
    list(id = "wpv-reference-dose-naive", strain = "WPV", alpha = 0.444, beta = 2.31, gamma = 0.4624, dose = 2.31, ever_infected = FALSE),
    list(id = "wpv-reference-dose-waned", strain = "WPV", alpha = 0.444, beta = 2.31, gamma = 0.4624, dose = 2.31, ever_infected = TRUE),
    list(id = "wpv-index-reference-naive", strain = "WPV", alpha = 0.444, beta = 2.31, gamma = 0.4624, dose = 2.31 * (2^(1 / 0.444) - 1), ever_infected = FALSE),
    list(id = "sabin2-zero-naive", strain = "Sabin", alpha = 0.444, beta = 8, gamma = 0.4624, dose = 0, ever_infected = FALSE),
    list(id = "sabin2-low-linear-naive", strain = "Sabin", alpha = 0.444, beta = 8, gamma = 0.4624, dose = 8 * 0.001, ever_infected = FALSE),
    list(id = "sabin2-linear-cutoff-waned", strain = "Sabin", alpha = 0.444, beta = 8, gamma = 0.4624, dose = 8 * inputs$lowDoseLinearRatio, ever_infected = TRUE),
    list(id = "sabin2-catalog-dose-naive", strain = "Sabin", alpha = 0.444, beta = 8, gamma = 0.4624, dose = 10^5.3, ever_infected = FALSE),
    list(id = "sabin2-catalog-dose-waned", strain = "Sabin", alpha = 0.444, beta = 8, gamma = 0.4624, dose = 10^5.3, ever_infected = TRUE),
    list(id = "hypothetical-domain-low", strain = "Sabin", alpha = 0.001, beta = 0.001, gamma = 0.4624, dose = 1, ever_infected = FALSE),
    list(id = "hypothetical-domain-high", strain = "Sabin", alpha = 5, beta = 1e6, gamma = 0.4624, dose = 1e9, ever_infected = FALSE),
    list(id = "hypothetical-reference", strain = "Sabin", alpha = 0.444, beta = 8, gamma = 0.4624, dose = 10^5.3, ever_infected = FALSE)
  )
  case_lines <- vapply(cases, function(case) {
    params <- list(
      susceptibility = list(
        alpha = case$alpha,
        gamma = case$gamma,
        beta_dose_scale = list("1" = list(WPV = case$beta, Sabin = case$beta))
      ),
      immune_response = list(log2N_max = inputs$log2NMax),
      numerics = list(policy = list(d_lin_ratio = inputs$lowDoseLinearRatio))
    )
    values <- susceptibility_prob_per_bin(case$dose, 1L, case$strain, params, ever_infected = case$ever_infected)
    paste0(
      "    {\"id\": ", json_string(case$id),
      ", \"strain\": ", json_string(case$strain),
      ", \"alpha\": ", json_number(case$alpha),
      ", \"beta\": ", json_number(case$beta),
      ", \"gamma\": ", json_number(case$gamma),
      ", \"doseTCID50\": ", json_number(case$dose),
      ", \"everInfected\": ", tolower(as.character(case$ever_infected)),
      ", \"values\": ", json_number_array(values), "}"
    )
  }, character(1))
  source_files_json <- vapply(source_files_read, json_string, character(1))
  lines <- c(
    "{",
    "  \"schemaVersion\": \"SourceKernelFixtureV1\",",
    "  \"coverage\": \"partial: India R WPV, Sabin-2, and hypothetical UI-domain per-bin susceptibility grids\",",
    "  \"releaseGateSatisfied\": false,",
    "  \"generatorCommand\": \"Rscript scripts/generate-reference-fixtures.R\",",
    "  \"source\": {",
    "    \"repository\": \"india-polio\",",
    paste0("    \"commit\": ", json_string(india_record$commit), ","),
    paste0("    \"branch\": ", json_string(india_record$branch), ","),
    "    \"trackedDirty\": false,",
    paste0("    \"untrackedPaths\": ", json_string_array(india_record$untracked), ","),
    paste0("    \"runtime\": ", json_string(R.version.string), ","),
    paste0("    \"sourceFilesRead\": ", paste0("[", paste(source_files_json, collapse = ", "), "]")),
    "  },",
    "  \"inputs\": {",
    paste0("    \"serotype\": 1, \"log2NMax\": ", json_number(inputs$log2NMax), ", \"lowDoseLinearRatio\": ", json_number(inputs$lowDoseLinearRatio)),
    "  },",
    "  \"cases\": [",
    paste0(case_lines, c(rep(",", length(case_lines) - 1L), "")),
    "  ]",
    "}"
  )
  write_atomic(output_path, lines)
}

write_india_vaccine_take_fixture <- function(india_record, output_path) {
  source_files_read <- c(
    file.path(india_record$path, "model", "R", "mixture.R"),
    file.path(india_record$path, "model", "R", "titer_bounds.R"),
    file.path(india_record$path, "model", "R", "susceptibility.R")
  )
  source(source_files_read[[1L]])
  source(source_files_read[[2L]])
  source(source_files_read[[3L]])

  inputs <- list(
    alpha = 0.444,
    beta = 8,
    gamma = 0.4624,
    doseTCID50 = 199526.2314968879,
    takeContext = 0.8,
    formulationMultiplier = 1,
    mu0 = 4,
    sigma0 = 2.4,
    log2NMax = 15L,
    lowDoseLinearRatio = 0.01,
    mucosalBins = c(0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05, rep(0, 8)),
    serumBins = c(0.2, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05, 0.05, rep(0, 8))
  )
  params <- list(
    susceptibility = list(
      alpha = inputs$alpha,
      gamma = inputs$gamma,
      beta_dose_scale = list("1" = list(Sabin = inputs$beta))
    ),
    immune_response = list(
      log2N_max = inputs$log2NMax,
      by_strain = list(Sabin = list(mu0 = inputs$mu0, sigma0 = inputs$sigma0))
    ),
    numerics = list(policy = list(d_lin_ratio = inputs$lowDoseLinearRatio))
  )
  take_hazard <- pmin(
    1,
    susceptibility_prob_per_bin(inputs$doseTCID50, 1L, "Sabin", params, ever_infected = FALSE) *
      inputs$takeContext * inputs$formulationMultiplier
  )
  take_probability <- sum(normalize_bin_probs(inputs$mucosalBins) * take_hazard)
  no_take_probability <- 1 - take_probability
  take_mucosal <- tilt_bins_for_infection(inputs$mucosalBins, take_hazard)
  no_take_mucosal <- tilt_bins_for_remainder(inputs$mucosalBins, take_hazard)
  take_serum <- tilt_bins_for_infection(inputs$serumBins, take_hazard)
  no_take_serum <- tilt_bins_for_remainder(inputs$serumBins, take_hazard)
  boosted_take_mucosal <- apply_boost_transition(take_mucosal, "Sabin", params, ever_infected = FALSE)
  boosted_take_serum <- apply_boost_transition(take_serum, "Sabin", params, ever_infected = FALSE)
  source_files_json <- vapply(source_files_read, json_string, character(1))
  lines <- c(
    "{",
    "  \"schemaVersion\": \"SourceKernelFixtureV1\",",
    "  \"coverage\": \"partial: India R one-dose vaccine take/no-take conditioning and boost only\",",
    "  \"releaseGateSatisfied\": false,",
    "  \"generatorCommand\": \"Rscript scripts/generate-reference-fixtures.R\",",
    "  \"source\": {",
    "    \"repository\": \"india-polio\",",
    paste0("    \"commit\": ", json_string(india_record$commit), ","),
    paste0("    \"branch\": ", json_string(india_record$branch), ","),
    "    \"trackedDirty\": false,",
    paste0("    \"untrackedPaths\": ", json_string_array(india_record$untracked), ","),
    paste0("    \"runtime\": ", json_string(R.version.string), ","),
    paste0("    \"sourceFilesRead\": ", paste0("[", paste(source_files_json, collapse = ", "), "]")),
    "  },",
    "  \"inputs\": {",
    paste0(
      "    \"serotype\": 1, \"strain\": \"Sabin\", \"alpha\": ", json_number(inputs$alpha),
      ", \"beta\": ", json_number(inputs$beta), ", \"gamma\": ", json_number(inputs$gamma),
      ", \"doseTCID50\": ", json_number(inputs$doseTCID50), ", \"takeContext\": ", json_number(inputs$takeContext), ","
    ),
    paste0(
      "    \"formulationMultiplier\": ", json_number(inputs$formulationMultiplier), ", \"mu0\": ", json_number(inputs$mu0),
      ", \"sigma0\": ", json_number(inputs$sigma0), ", \"log2NMax\": ", json_number(inputs$log2NMax),
      ", \"lowDoseLinearRatio\": ", json_number(inputs$lowDoseLinearRatio), ","
    ),
    paste0(
      "    \"mucosalBins\": ", json_number_array(inputs$mucosalBins),
      ", \"serumBins\": ", json_number_array(inputs$serumBins)
    ),
    "  },",
    "  \"output\": {",
    paste0("    \"takeProbability\": ", json_number(take_probability), ", \"noTakeProbability\": ", json_number(no_take_probability), ","),
    paste0("    \"takeMucosal\": ", json_number_array(take_mucosal), ","),
    paste0("    \"noTakeMucosal\": ", json_number_array(no_take_mucosal), ","),
    paste0("    \"takeSerum\": ", json_number_array(take_serum), ","),
    paste0("    \"noTakeSerum\": ", json_number_array(no_take_serum), ","),
    paste0("    \"boostedTakeMucosal\": ", json_number_array(boosted_take_mucosal), ","),
    paste0("    \"boostedTakeSerum\": ", json_number_array(boosted_take_serum)),
    "  }",
    "}"
  )
  write_atomic(output_path, lines)
}

# Catalog comparator coverage is deliberately sourced through the India R
# vaccination helpers.  Those helpers express the Phase-2 IPV distinction
# directly: an IPV dose leaves a naive recipient's mucosal state unchanged,
# while a previously live-infected recipient receives the Sabin boost in both
# mucosal and active-serum compartments.
write_india_comparator_fixture <- function(india_record, output_path) {
  source_files_read <- c(
    file.path(india_record$path, "model", "R", "mixture.R"),
    file.path(india_record$path, "model", "R", "titer_bounds.R"),
    file.path(india_record$path, "model", "R", "susceptibility.R"),
    file.path(india_record$path, "model", "R", "immunity.R"),
    file.path(india_record$path, "model", "R", "vaccination.R")
  )
  for (source_file in source_files_read) source(source_file)

  base_params <- function(mu0, sigma0) list(
    susceptibility = list(
      alpha = 0.444,
      gamma = 0.4624,
      beta_dose_scale = list("1" = list(Sabin = 8, WPV = 2.31))
    ),
    immune_response = list(
      log2N_max = 15L,
      by_strain = list(Sabin = list(mu0 = mu0, sigma0 = sigma0))
    ),
    numerics = list(policy = list(d_lin_ratio = 0.01)),
    immunity = list(waning = list(mucosal = list(lambda = 0.87)))
  )

  boost_specs <- list(
    list(id = "hypothetical-mu0-0-naive", mu0 = 0, sigma0 = 2.4, ever_infected = FALSE),
    list(id = "hypothetical-mu0-4-naive", mu0 = 4, sigma0 = 2.4, ever_infected = FALSE),
    list(id = "sabin2-mu0-6-naive", mu0 = 6, sigma0 = 2.4, ever_infected = FALSE),
    list(id = "hypothetical-mu0-8-naive", mu0 = 8, sigma0 = 2.4, ever_infected = FALSE),
    list(id = "sabin2-mu0-6-waned", mu0 = 6, sigma0 = 2.4, ever_infected = TRUE)
  )
  boost_lines <- vapply(boost_specs, function(spec) {
    matrices <- build_boost_transition_matrices("Sabin", base_params(spec$mu0, spec$sigma0))
    transition <- if (spec$ever_infected) matrices$waned else matrices$naive
    paste0(
      "    {\"id\": ", json_string(spec$id),
      ", \"mu0\": ", json_number(spec$mu0),
      ", \"sigma0\": ", json_number(spec$sigma0),
      ", \"everInfected\": ", tolower(as.character(spec$ever_infected)),
      ", \"transitionMatrix\": ", json_number_matrix(transition), "}"
    )
  }, character(1))

  naive_mucosal <- c(0.1, 0.2, 0.25, 0.2, 0.15, 0.1, rep(0, 10))
  naive_serum <- c(0.25, 0.2, 0.15, 0.15, 0.1, 0.1, 0.05, rep(0, 9))
  primed_mucosal <- c(rep(0, 7), 0.4, 0.35, 0.25, rep(0, 6))
  primed_serum <- c(rep(0, 6), 0.25, 0.35, 0.25, 0.15, rep(0, 6))
  ipv_specs <- list(
    list(id = "ipv-naive-serum-only", ever_infected = FALSE, mucosal = naive_mucosal, serum = naive_serum),
    list(id = "ipv-primed-mucosal-and-serum", ever_infected = TRUE, mucosal = primed_mucosal, serum = primed_serum)
  )
  ipv_lines <- vapply(ipv_specs, function(spec) {
    params <- base_params(6, 2.4)
    if (spec$ever_infected) {
      output <- compute_mucosal_serum_boost_for_vax(
        spec$mucosal, spec$serum, "Sabin", params, "RB", ever_infected = TRUE
      )
      mucosal <- output$muc_bins
      serum <- output$ser_bins
    } else {
      output <- compute_serum_only_boost_for_vax(
        spec$serum, "Sabin", params, "RB", ever_infected = FALSE
      )
      mucosal <- spec$mucosal
      serum <- output$ser_bins
    }
    paste0(
      "    {\"id\": ", json_string(spec$id),
      ", \"everInfected\": ", tolower(as.character(spec$ever_infected)),
      ", \"mucosalInput\": ", json_number_array(spec$mucosal),
      ", \"serumInput\": ", json_number_array(spec$serum),
      ", \"mucosalOutput\": ", json_number_array(mucosal),
      ", \"serumOutput\": ", json_number_array(serum), "}"
    )
  }, character(1))

  schedule_specs <- c(
    list(
      list(id = "one-dose-28-day-assessment", dose_days = c(42), assessment_lag_days = 28),
      list(id = "one-dose-90-day-assessment", dose_days = c(42), assessment_lag_days = 90),
      list(id = "three-dose-ri-28-day-assessment", dose_days = c(42, 70, 98), assessment_lag_days = 28),
      list(id = "three-dose-ri-90-day-assessment", dose_days = c(42, 70, 98), assessment_lag_days = 90)
    ),
    unlist(lapply(1:4, function(booster_years) {
      lapply(c(28, 90), function(assessment_lag_days) {
        list(
          id = paste0("four-dose-ri-booster-", booster_years, "y-", assessment_lag_days, "-day-assessment"),
          dose_days = c(42, 70, 98, 365.25 * booster_years),
          assessment_lag_days = assessment_lag_days
        )
      })
    }), recursive = FALSE)
  )
  comparator_products <- list(
    list(id = "sabin2", mu0 = 6, sigma0 = 2.4, live = TRUE, take_context = 1),
    list(id = "ipv", mu0 = 6, sigma0 = 2.4, live = FALSE, take_context = NA_real_)
  )
  schedule_lines <- character()
  for (product in comparator_products) {
    params <- india_schedule_params(mu0 = product$mu0, sigma0 = product$sigma0)
    for (spec in schedule_specs) {
      groups <- list(list(
        mass = 1,
        ever_infected = FALSE,
        mucosal = c(1, rep(0, 15)),
        serum = c(1, rep(0, 15))
      ))
      current_day <- 0
      for (dose_day in spec$dose_days) {
        groups <- india_move_schedule_groups(groups, dose_day - current_day, params)
        groups <- if (product$live) {
          india_apply_live_schedule_dose(groups, params, take_context = product$take_context)
        } else {
          india_apply_ipv_schedule_dose(groups, params)
        }
        current_day <- dose_day
      }
      groups <- india_move_schedule_groups(groups, spec$assessment_lag_days, params)
      schedule_lines[[length(schedule_lines) + 1L]] <- paste0(
        "    {\"id\": ", json_string(paste0(product$id, "-", spec$id)),
        ", \"productId\": ", json_string(product$id),
        ", \"doseDays\": ", json_number_array(spec$dose_days),
        ", \"assessmentLagDays\": ", json_number(spec$assessment_lag_days),
        ", \"assessmentAgeDays\": ", json_number(current_day + spec$assessment_lag_days),
        ", \"groups\": ", india_schedule_groups_json(groups), "}"
      )
    }
  }

  source_files_json <- vapply(source_files_read, json_string, character(1))
  lines <- c(
    "{",
    "  \"schemaVersion\": \"SourceKernelFixtureV1\",",
    "  \"coverage\": \"partial: India R boost-transition grids, fixed Sabin-2/IPV one-, three-, and four-dose schedule composition, and IPV history-dependent mucosal-serum semantics\",",
    "  \"releaseGateSatisfied\": false,",
    "  \"generatorCommand\": \"Rscript scripts/generate-reference-fixtures.R\",",
    "  \"source\": {",
    "    \"repository\": \"india-polio\",",
    paste0("    \"commit\": ", json_string(india_record$commit), ","),
    paste0("    \"branch\": ", json_string(india_record$branch), ","),
    "    \"trackedDirty\": false,",
    paste0("    \"untrackedPaths\": ", json_string_array(india_record$untracked), ","),
    paste0("    \"runtime\": ", json_string(R.version.string), ","),
    paste0("    \"sourceFilesRead\": ", paste0("[", paste(source_files_json, collapse = ", "), "]")),
    "  },",
    "  \"boostTransitionCases\": [",
    paste0(boost_lines, c(rep(",", length(boost_lines) - 1L), "")),
    "  ],",
    "  \"ipvCases\": [",
    paste0(ipv_lines, c(rep(",", length(ipv_lines) - 1L), "")),
    "  ],",
    "  \"scheduleCases\": [",
    paste0(schedule_lines, c(rep(",", length(schedule_lines) - 1L), "")),
    "  ]",
    "}"
  )
  write_atomic(output_path, lines)
}

# Compose the source's public bin kernels in the same event order as the
# browser schedule boundary: wane the current distribution, split take and
# no-take mass, boost only take mass, then merge by infection history.  This is
# deliberately a kernel fixture, not an invocation of India Polio's broader
# population/vaccination scheduler.
india_schedule_params <- function(mu0 = 4, sigma0 = 2.4) {
  list(
    susceptibility = list(
      alpha = 0.444,
      gamma = 0.4624,
      beta_dose_scale = list("1" = list(Sabin = 8))
    ),
    immune_response = list(
      log2N_max = 15L,
      by_strain = list(Sabin = list(mu0 = mu0, sigma0 = sigma0))
    ),
    numerics = list(policy = list(d_lin_ratio = 0.01)),
    immunity = list(waning = list(mucosal = list(lambda = 0.87)))
  )
}

india_merge_schedule_groups <- function(groups) {
  merged <- lapply(c(FALSE, TRUE), function(ever_infected) {
    matching <- Filter(function(group) identical(group$ever_infected, ever_infected) && group$mass > 0, groups)
    if (length(matching) == 0L) return(NULL)
    mass <- sum(vapply(matching, function(group) group$mass, numeric(1)))
    mucosal <- Reduce(`+`, lapply(matching, function(group) group$mass * group$mucosal)) / mass
    serum <- Reduce(`+`, lapply(matching, function(group) group$mass * group$serum)) / mass
    list(
      mass = mass,
      ever_infected = ever_infected,
      mucosal = normalize_bin_probs(mucosal),
      serum = normalize_bin_probs(serum)
    )
  })
  Filter(Negate(is.null), merged)
}

india_move_schedule_groups <- function(groups, elapsed_days, params) {
  if (!is.finite(elapsed_days) || elapsed_days < 0) stop("Schedule elapsed days must be finite and nonnegative")
  delta <- mucosal_waning_decrement(elapsed_days / (365.25 / 12), params)
  lapply(groups, function(group) {
    group$mucosal <- shift_bins_left_linear(group$mucosal, delta)
    group$serum <- shift_bins_left_linear(group$serum, delta)
    group
  })
}

india_apply_live_schedule_dose <- function(
  groups,
  params,
  dose = 199526.2314968879,
  take_context = 0.8,
  formulation_multiplier = 1
) {
  split <- list()
  for (group in groups) {
    take_hazard <- pmin(
      1,
      susceptibility_prob_per_bin(dose, 1L, "Sabin", params, ever_infected = group$ever_infected) *
        take_context * formulation_multiplier
    )
    take_probability <- sum(group$mucosal * take_hazard)
    no_take_probability <- sum(group$mucosal * (1 - take_hazard))
    if (no_take_probability > 1e-14) {
      split[[length(split) + 1L]] <- list(
        mass = group$mass * no_take_probability,
        ever_infected = group$ever_infected,
        mucosal = tilt_bins_for_remainder(group$mucosal, take_hazard),
        serum = tilt_bins_for_remainder(group$serum, take_hazard)
      )
    }
    if (take_probability > 1e-14) {
      split[[length(split) + 1L]] <- list(
        mass = group$mass * take_probability,
        ever_infected = TRUE,
        mucosal = apply_boost_transition(
          tilt_bins_for_infection(group$mucosal, take_hazard), "Sabin", params,
          ever_infected = group$ever_infected
        ),
        serum = apply_boost_transition(
          tilt_bins_for_infection(group$serum, take_hazard), "Sabin", params,
          ever_infected = group$ever_infected
        )
      )
    }
  }
  india_merge_schedule_groups(split)
}

india_apply_ipv_schedule_dose <- function(groups, params) {
  lapply(groups, function(group) {
    if (group$ever_infected) {
      output <- compute_mucosal_serum_boost_for_vax(
        group$mucosal, group$serum, "Sabin", params, "RB", ever_infected = TRUE
      )
      group$mucosal <- output$muc_bins
      group$serum <- output$ser_bins
    } else {
      output <- compute_serum_only_boost_for_vax(
        group$serum, "Sabin", params, "RB", ever_infected = FALSE
      )
      group$serum <- output$ser_bins
    }
    group
  })
}

india_schedule_groups_json <- function(groups) {
  values <- vapply(groups, function(group) {
    paste0(
      "{\"mass\": ", json_number(group$mass),
      ", \"everInfected\": ", tolower(as.character(group$ever_infected)),
      ", \"mucosal\": ", json_number_array(group$mucosal),
      ", \"serum\": ", json_number_array(group$serum), "}"
    )
  }, character(1))
  paste0("[", paste(values, collapse = ", "), "]")
}

write_india_schedule_fixture <- function(india_record, output_path) {
  source_files_read <- c(
    file.path(india_record$path, "model", "R", "mixture.R"),
    file.path(india_record$path, "model", "R", "titer_bounds.R"),
    file.path(india_record$path, "model", "R", "susceptibility.R"),
    file.path(india_record$path, "model", "R", "immunity.R")
  )
  for (source_file in source_files_read) source(source_file)

  inputs <- list(
    serotype = 1L,
    strain = "Sabin",
    alpha = 0.444,
    beta = 8,
    gamma = 0.4624,
    doseTCID50 = 199526.2314968879,
    takeContext = 0.8,
    formulationMultiplier = 1,
    mu0 = 4,
    sigma0 = 2.4,
    log2NMax = 15L,
    waningLambda = 0.87,
    daysPerMonth = 365.25 / 12,
    lowDoseLinearRatio = 0.01
  )
  case_specs <- c(
    list(
      list(id = "one-dose-28-day-assessment", dose_days = c(42), assessment_lag_days = 28),
      list(id = "one-dose-90-day-assessment", dose_days = c(42), assessment_lag_days = 90),
      list(id = "three-dose-ri-28-day-assessment", dose_days = c(42, 70, 98), assessment_lag_days = 28),
      list(id = "three-dose-ri-90-day-assessment", dose_days = c(42, 70, 98), assessment_lag_days = 90)
    ),
    unlist(lapply(1:4, function(booster_years) {
      lapply(c(28, 90), function(assessment_lag_days) {
        list(
          id = paste0("four-dose-ri-booster-", booster_years, "y-", assessment_lag_days, "-day-assessment"),
          dose_days = c(42, 70, 98, 365.25 * booster_years),
          assessment_lag_days = assessment_lag_days
        )
      })
    }), recursive = FALSE)
  )
  params <- india_schedule_params()
  case_lines <- vapply(case_specs, function(spec) {
    groups <- list(list(
      mass = 1,
      ever_infected = FALSE,
      mucosal = c(1, rep(0, 15)),
      serum = c(1, rep(0, 15))
    ))
    current_day <- 0
    for (dose_day in spec$dose_days) {
      groups <- india_move_schedule_groups(groups, dose_day - current_day, params)
      groups <- india_apply_live_schedule_dose(groups, params)
      current_day <- dose_day
    }
    groups <- india_move_schedule_groups(groups, spec$assessment_lag_days, params)
    paste0(
      "    {\"id\": ", json_string(spec$id),
      ", \"doseDays\": ", json_number_array(spec$dose_days),
      ", \"assessmentLagDays\": ", json_number(spec$assessment_lag_days),
      ", \"assessmentAgeDays\": ", json_number(current_day + spec$assessment_lag_days),
      ", \"groups\": ", india_schedule_groups_json(groups), "}"
    )
  }, character(1))
  elapsed_days <- sort(unique(unlist(lapply(case_specs, function(spec) {
    c(spec$dose_days[[1L]], diff(spec$dose_days), spec$assessment_lag_days)
  }))))
  waning_input <- c(0.05, 0.1, 0.15, 0.2, 0.2, 0.15, 0.1, 0.05, rep(0, 8))
  waning_lines <- vapply(elapsed_days, function(elapsed) {
    delta <- mucosal_waning_decrement(elapsed / inputs$daysPerMonth, params)
    output <- shift_bins_left_linear(waning_input, delta)
    paste0(
      "    {\"elapsedDays\": ", json_number(elapsed),
      ", \"waningDeltaLog2\": ", json_number(delta),
      ", \"values\": ", json_number_array(output), "}"
    )
  }, character(1))
  source_files_json <- vapply(source_files_read, json_string, character(1))
  lines <- c(
    "{",
    "  \"schemaVersion\": \"SourceKernelFixtureV1\",",
    "  \"coverage\": \"partial: India R live-vaccine one-, three-, and four-dose composition plus all selected schedule/assessment waning intervals\",",
    "  \"releaseGateSatisfied\": false,",
    "  \"generatorCommand\": \"Rscript scripts/generate-reference-fixtures.R\",",
    "  \"source\": {",
    "    \"repository\": \"india-polio\",",
    paste0("    \"commit\": ", json_string(india_record$commit), ","),
    paste0("    \"branch\": ", json_string(india_record$branch), ","),
    "    \"trackedDirty\": false,",
    paste0("    \"untrackedPaths\": ", json_string_array(india_record$untracked), ","),
    paste0("    \"runtime\": ", json_string(R.version.string), ","),
    paste0("    \"sourceFilesRead\": ", paste0("[", paste(source_files_json, collapse = ", "), "]")),
    "  },",
    "  \"inputs\": {",
    paste0("    \"serotype\": ", json_number(inputs$serotype), ", \"strain\": ", json_string(inputs$strain), ", \"alpha\": ", json_number(inputs$alpha), ", \"beta\": ", json_number(inputs$beta), ", \"gamma\": ", json_number(inputs$gamma), ","),
    paste0("    \"doseTCID50\": ", json_number(inputs$doseTCID50), ", \"takeContext\": ", json_number(inputs$takeContext), ", \"formulationMultiplier\": ", json_number(inputs$formulationMultiplier), ", \"mu0\": ", json_number(inputs$mu0), ", \"sigma0\": ", json_number(inputs$sigma0), ","),
    paste0("    \"log2NMax\": ", json_number(inputs$log2NMax), ", \"waningLambda\": ", json_number(inputs$waningLambda), ", \"daysPerMonth\": ", json_number(inputs$daysPerMonth), ", \"lowDoseLinearRatio\": ", json_number(inputs$lowDoseLinearRatio), ","),
    paste0("    \"waningInputBins\": ", json_number_array(waning_input)),
    "  },",
    "  \"cases\": [",
    paste0(case_lines, c(rep(",", length(case_lines) - 1L), "")),
    "  ],",
    "  \"waningCases\": [",
    paste0(waning_lines, c(rep(",", length(waning_lines) - 1L), "")),
    "  ]",
    "}"
  )
  write_atomic(output_path, lines)
}

write_cessation_motif_fixture <- function(cessation_record, output_path, calibration_output_path) {
  source_files_read <- c(
    file.path(cessation_record$path, "analysis", "transmission", "primarySecondaryTertiaryDoseModel.m"),
    file.path(cessation_record$path, "analysis", "helperFunctions", "keyValuePairVararginHandler.m")
  )
  missing <- source_files_read[!file.exists(source_files_read)]
  if (length(missing) > 0L) {
    stop("Missing declared Cessation Matlab fixture source files: ", paste(missing, collapse = ", "))
  }
  octave <- Sys.which("octave")
  if (!nzchar(octave)) stop("Octave is required to generate Cessation Matlab fixtures")
  wrapper_directory <- dirname(script_path())
  command <- paste0(
    "addpath(", json_string(wrapper_directory), "); ",
    "generate_cessation_fixtures(", json_string(cessation_record$path), ", ", json_string(output_path), ", ", json_string(calibration_output_path), ");"
  )
  result <- suppressWarnings(system2(
    octave,
    c("--quiet", "--no-gui", "--eval", shQuote(command)),
    stdout = TRUE,
    stderr = TRUE
  ))
  exit_code <- attr(result, "status")
  if (is.null(exit_code)) exit_code <- 0L
  if (exit_code != 0L || !file.exists(output_path) || !file.exists(calibration_output_path)) {
    stop("Cessation Matlab fixture generation failed", if (length(result)) paste0("\n", paste(result, collapse = "\n")) else "")
  }
}

write_india_shedding_fixture <- function(india_record, output_path) {
  source_files_read <- c(
    file.path(india_record$path, "model", "R", "mixture.R"),
    file.path(india_record$path, "model", "R", "titer_bounds.R"),
    file.path(india_record$path, "model", "R", "shedding.R")
  )
  source(source_files_read[[1L]])
  source(source_files_read[[2L]])
  source(source_files_read[[3L]])

  inputs <- list(
    log2NMax = 15L,
    sheddingWithinBinSd = 0.4,
    b1 = 3.7612001156935624,
    b2 = 0.1519663281441243,
    b3 = 0.52,
    cImmunity = 0.056,
    ageAMax = 6.67,
    ageAMin = 4.29,
    ageTauMonths = 9.92,
    temporalMu = 1.64,
    temporalSigma = 0.18,
    temporalKappa = 0.32,
    titerFloor = 398.1071705534973,
    survivalEps = 1e-12
  )
  params <- list(
    immune_response = list(log2N_max = inputs$log2NMax),
    shedding_duration = list(strains = list(WPV = list(
      b1 = inputs$b1, b2 = inputs$b2, b3 = inputs$b3
    ))),
    shedding_intensity = list(
      peak_multiplier = list(
        c_immunity = inputs$cImmunity,
        age_function = list(parameters = list(
          A_max = inputs$ageAMax,
          A_min = inputs$ageAMin,
          tau_months = inputs$ageTauMonths
        ))
      ),
      temporal_profile = list(
        mu = inputs$temporalMu,
        sigma = inputs$temporalSigma,
        kappa = inputs$temporalKappa
      ),
      titer_floor = inputs$titerFloor
    ),
    numerics = list(policy = list(survival_eps = inputs$survivalEps))
  )
  days <- c(1, 7, 30, 100)
  ages <- c(12, 48)
  cases <- list()
  for (source_bin in 0:15) {
    challenge_bins <- numeric(16)
    challenge_bins[[source_bin + 1L]] <- 1
    for (day in days) {
      for (age in ages) {
        survival <- shedding_survival_bins(day, challenge_bins, "WPV", params)
        joint_peak <- joint_survival_peak_expectation_bins(day, challenge_bins, age, "WPV", params)
        conditional_concentration <- expected_shedding_intensity_when_shedding(
          day, challenge_bins, age, "WPV", params
        )
        cases[[length(cases) + 1L]] <- list(
          sourceBin = source_bin,
          daysSinceInfection = day,
          ageMonths = age,
          survival = survival,
          jointPeak = joint_peak,
          expectedInfectiousConcentration = conditional_concentration * survival
        )
      }
    }
  }
  case_lines <- vapply(cases, function(case) {
    paste0(
      "    {\"sourceBin\": ", json_number(case$sourceBin),
      ", \"daysSinceInfection\": ", json_number(case$daysSinceInfection),
      ", \"ageMonths\": ", json_number(case$ageMonths),
      ", \"survival\": ", json_number(case$survival),
      ", \"jointPeak\": ", json_number(case$jointPeak),
      ", \"expectedInfectiousConcentration\": ", json_number(case$expectedInfectiousConcentration), "}"
    )
  }, character(1))
  source_files_json <- vapply(source_files_read, json_string, character(1))
  lines <- c(
    "{",
    "  \"schemaVersion\": \"SourceKernelFixtureV1\",",
    "  \"coverage\": \"partial: India R WPV per-bin shedding survival plus a diagnostic record of the intentionally divergent India age-intensity implementation\",",
    "  \"releaseGateSatisfied\": false,",
    "  \"generatorCommand\": \"Rscript scripts/generate-reference-fixtures.R\",",
    "  \"source\": {",
    "    \"repository\": \"india-polio\",",
    paste0("    \"commit\": ", json_string(india_record$commit), ","),
    paste0("    \"branch\": ", json_string(india_record$branch), ","),
    "    \"trackedDirty\": false,",
    paste0("    \"untrackedPaths\": ", json_string_array(india_record$untracked), ","),
    paste0("    \"runtime\": ", json_string(R.version.string), ","),
    paste0("    \"sourceFilesRead\": ", paste0("[", paste(source_files_json, collapse = ", "), "]")),
    "  },",
    "  \"inputs\": {",
    paste0(
      "    \"serotype\": 1, \"strain\": \"WPV\", \"log2NMax\": ", json_number(inputs$log2NMax),
      ", \"sheddingWithinBinSd\": ", json_number(inputs$sheddingWithinBinSd),
      ", \"b1\": ", json_number(inputs$b1), ", \"b2\": ", json_number(inputs$b2), ", \"b3\": ", json_number(inputs$b3), ","
    ),
    paste0(
      "    \"cImmunity\": ", json_number(inputs$cImmunity), ", \"ageAMax\": ", json_number(inputs$ageAMax),
      ", \"ageAMin\": ", json_number(inputs$ageAMin), ", \"ageTauMonths\": ", json_number(inputs$ageTauMonths), ","
    ),
    paste0(
      "    \"temporalMu\": ", json_number(inputs$temporalMu), ", \"temporalSigma\": ", json_number(inputs$temporalSigma),
      ", \"temporalKappa\": ", json_number(inputs$temporalKappa), ", \"titerFloor\": ", json_number(inputs$titerFloor),
      ", \"survivalEps\": ", json_number(inputs$survivalEps)
    ),
    "  },",
    "  \"documentedDeviation\": {",
    "    \"component\": \"age-dependent peak shedding amplitude\",",
    "    \"indiaSourceEquation\": \"A_min + (A_max - A_min) * exp(-ageMonths / tauMonths)\",",
    "    \"browserEquation\": \"min(A_max, A_min + (A_max - A_min) * exp(-(ageMonths - 7) / tauMonths))\",",
    "    \"authority\": \"Mike Famulare, 2026-07-16: the original Cessation Matlab age-shedding formula controls this repository; the India-source deviation is an upstream bug to document.\"",
    "  },",
    "  \"cases\": [",
    paste0(case_lines, c(rep(",", length(case_lines) - 1L), "")),
    "  ]",
    "}"
  )
  write_atomic(output_path, lines)
}

provenance <- read_provenance(provenance_path)
source_specs <- list(
  list(
    label = "cessationStability",
    environment = "CESSATION_STABILITY_REPO",
    default_root = "/Users/famulare/git/famulare/cessationStability"
  ),
  list(
    label = "indiaPolio",
    environment = "INDIA_POLIO_REPO",
    default_root = "/Users/famulare/git/famulare/india-polio"
  )
)

records <- list()
for (spec in source_specs) {
  repo <- repo_from_environment(spec$environment, spec$default_root)
  if (!dir.exists(repo)) stop("Missing locked source repository: ", repo)

  source_status <- repo_status(repo)
  if (source_status$tracked_dirty) {
    stop("Refusing fixture generation with tracked source changes: ", repo)
  }

  actual_commit <- trimws(require_git(repo, c("rev-parse", "HEAD"), "read locked commit")[[1L]])
  expected_commit <- provenance$commits[[spec$label]]
  if (!identical(actual_commit, expected_commit)) {
    stop("Locked source repository is not at locked commit: ", repo,
         " (expected ", expected_commit, ", found ", actual_commit, ")")
  }

  branch_output <- require_git(repo, c("branch", "--show-current"), "read source branch")
  branch <- if (length(branch_output)) trimws(branch_output[[1L]]) else ""
  declared_files <- validate_declared_files(
    provenance$source_files,
    spec$default_root,
    repo,
    spec$label
  )
  records[[spec$label]] <- list(
    path = repo,
    commit = actual_commit,
    branch = if (nzchar(branch)) branch else "(detached HEAD)",
    tracked_dirty = source_status$tracked_dirty,
    untracked = source_status$untracked,
    declared_files = declared_files
  )
}

susceptibility_fixture_path <- file.path(project_root, "reference", "fixtures", "india-r-susceptibility-v1.json")
vaccine_take_fixture_path <- file.path(project_root, "reference", "fixtures", "india-r-vaccine-take-v1.json")
comparator_fixture_path <- file.path(project_root, "reference", "fixtures", "india-r-comparators-v1.json")
shedding_fixture_path <- file.path(project_root, "reference", "fixtures", "india-r-shedding-v1.json")
schedule_fixture_path <- file.path(project_root, "reference", "fixtures", "india-r-schedule-v1.json")
cessation_fixture_path <- file.path(project_root, "reference", "fixtures", "cessation-matlab-motif-v1.json")
cessation_calibration_fixture_path <- file.path(project_root, "reference", "fixtures", "cessation-calibration-prevalence-v1.json")
manifest_path <- file.path(project_root, "reference", "fixtures", "manifest-v1.json")
write_india_susceptibility_fixture(records$indiaPolio, susceptibility_fixture_path)
write_india_vaccine_take_fixture(records$indiaPolio, vaccine_take_fixture_path)
write_india_comparator_fixture(records$indiaPolio, comparator_fixture_path)
write_india_shedding_fixture(records$indiaPolio, shedding_fixture_path)
write_india_schedule_fixture(records$indiaPolio, schedule_fixture_path)
write_cessation_motif_fixture(records$cessationStability, cessation_fixture_path, cessation_calibration_fixture_path)
susceptibility_fixture_hash <- sha256_file(susceptibility_fixture_path)
vaccine_take_fixture_hash <- sha256_file(vaccine_take_fixture_path)
comparator_fixture_hash <- sha256_file(comparator_fixture_path)
shedding_fixture_hash <- sha256_file(shedding_fixture_path)
schedule_fixture_hash <- sha256_file(schedule_fixture_path)
cessation_fixture_hash <- sha256_file(cessation_fixture_path)
cessation_calibration_fixture_hash <- sha256_file(cessation_calibration_fixture_path)
repository_lines <- vapply(names(records), function(label) record_json(label, records[[label]]), character(1))
manifest_lines <- c(
  "{",
  paste0("  \"schemaVersion\": ", json_string(fixture_schema_version), ","),
  "  \"coverage\": \"partial: India R biological kernels, fixed-comparator transition/schedule semantics, and Cessation Matlab fixed-titer motif plus day-1-45 prevalence calibration fixtures\",",
  "  \"section15KernelParitySatisfied\": false,",
  "  \"section152CalibrationSatisfied\": false,",
  "  \"generatorCommand\": \"Rscript scripts/generate-reference-fixtures.R\",",
  "  \"sourceRepositories\": [",
  paste0(repository_lines, c(rep(",", length(repository_lines) - 1L), "")),
  "  ],",
  "  \"artifacts\": [",
  paste0("    {\"path\": \"reference/fixtures/india-r-susceptibility-v1.json\", \"schemaVersion\": \"SourceKernelFixtureV1\", \"sha256\": ", json_string(susceptibility_fixture_hash), "},"),
  paste0("    {\"path\": \"reference/fixtures/india-r-vaccine-take-v1.json\", \"schemaVersion\": \"SourceKernelFixtureV1\", \"sha256\": ", json_string(vaccine_take_fixture_hash), "},"),
  paste0("    {\"path\": \"reference/fixtures/india-r-comparators-v1.json\", \"schemaVersion\": \"SourceKernelFixtureV1\", \"sha256\": ", json_string(comparator_fixture_hash), "},"),
  paste0("    {\"path\": \"reference/fixtures/india-r-shedding-v1.json\", \"schemaVersion\": \"SourceKernelFixtureV1\", \"sha256\": ", json_string(shedding_fixture_hash), "},"),
  paste0("    {\"path\": \"reference/fixtures/india-r-schedule-v1.json\", \"schemaVersion\": \"SourceKernelFixtureV1\", \"sha256\": ", json_string(schedule_fixture_hash), "},"),
  paste0("    {\"path\": \"reference/fixtures/cessation-matlab-motif-v1.json\", \"schemaVersion\": \"SourceMotifFixtureV1\", \"sha256\": ", json_string(cessation_fixture_hash), "},"),
  paste0("    {\"path\": \"reference/fixtures/cessation-calibration-prevalence-v1.json\", \"schemaVersion\": \"SourcePrevalenceCalibrationFixtureV1\", \"sha256\": ", json_string(cessation_calibration_fixture_hash), "}"),
  "  ],",
  "  \"remainingRequiredCoverage\": [",
  "    \"Broader India R direct-port grids and fixed-comparator transmission outcomes required for the full Section 15.1 gate\",",
    "    \"Section 15.2 distribution-native trajectory calibration report and acceptance checks\"",
  "  ]",
  "}"
)
write_atomic(manifest_path, manifest_lines)

cat("Generated partial source fixtures: ", susceptibility_fixture_path, ", ", vaccine_take_fixture_path, ", ", comparator_fixture_path, ", ", shedding_fixture_path, ", ", schedule_fixture_path, ", ", cessation_fixture_path, ", ", cessation_calibration_fixture_path, "\n", sep = "")
cat("Fixture manifest schema version: ", fixture_schema_version, "\n", sep = "")
cat("Source parity remains a release gate. Regenerate the Section 15.2 calibration report after this source-fixture manifest.\n", sep = "")
