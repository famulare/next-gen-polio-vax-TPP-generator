#!/usr/bin/env Rscript

# Exercise the fixture-generator entry point against throwaway source checkouts.
# These tests establish fail-closed provenance behavior; they do not assert
# numerical source parity because reviewed fixture extraction is still absent.

script_path <- function() {
  arguments <- commandArgs(trailingOnly = FALSE)
  file_arg <- sub("^--file=", "", arguments[grepl("^--file=", arguments)])
  if (length(file_arg) != 1L) stop("Cannot determine the fixture-generator test path")
  normalizePath(file_arg, mustWork = TRUE)
}

project_root <- dirname(dirname(dirname(script_path())))
generator <- file.path(project_root, "scripts", "generate-reference-fixtures.R")
rscript <- Sys.which("Rscript")
if (!nzchar(rscript)) stop("Rscript is required to test the reference-fixture generator")

require_success <- function(command, args) {
  output <- suppressWarnings(system2(command, shQuote(args), stdout = TRUE, stderr = TRUE))
  exit_code <- attr(output, "status")
  if (is.null(exit_code)) exit_code <- 0L
  if (exit_code != 0L) stop("Command failed: ", command, " ", paste(args, collapse = " "), "\n", paste(output, collapse = "\n"))
}

create_repo <- function(path) {
  dir.create(path, recursive = TRUE)
  require_success("git", c("-C", path, "init"))
  require_success("git", c("-C", path, "config", "user.name", "fixture test"))
  require_success("git", c("-C", path, "config", "user.email", "fixture-test@example.invalid"))
  writeLines("fixture", file.path(path, "fixture.txt"))
  require_success("git", c("-C", path, "add", "fixture.txt"))
  require_success("git", c("-C", path, "commit", "-m", "fixture baseline"))
}

invoke_generator <- function(cessation, india) {
  output <- suppressWarnings(system2(
    rscript,
    shQuote(generator),
    stdout = TRUE,
    stderr = TRUE,
    env = c(
      paste0("CESSATION_STABILITY_REPO=", cessation),
      paste0("INDIA_POLIO_REPO=", india)
    )
  ))
  exit_code <- attr(output, "status")
  if (is.null(exit_code)) exit_code <- 0L
  list(exit_code = as.integer(exit_code), output = paste(output, collapse = "\n"))
}

expect_failure <- function(result, expected) {
  if (result$exit_code == 0L) stop("Generator unexpectedly succeeded")
  if (!grepl(expected, result$output, fixed = TRUE)) {
    stop("Generator did not report expected failure. Expected: ", expected, "\nActual:\n", result$output)
  }
}

workspace <- tempfile("reference-fixture-generator-")
dir.create(workspace)
on.exit(unlink(workspace, recursive = TRUE, force = TRUE), add = TRUE)

cessation <- file.path(workspace, "cessationStability")
india <- file.path(workspace, "india-polio")
create_repo(cessation)
create_repo(india)

expect_failure(
  invoke_generator(file.path(workspace, "missing-cessation"), india),
  "Missing locked source repository"
)

writeLines("dirty tracked change", file.path(cessation, "fixture.txt"))
expect_failure(
  invoke_generator(cessation, india),
  "Refusing fixture generation with tracked source changes"
)

require_success("git", c("-C", cessation, "checkout", "--", "fixture.txt"))
expect_failure(
  invoke_generator(cessation, india),
  "Locked source repository is not at locked commit"
)

cat("reference-fixture-generator preflight tests passed\n")
