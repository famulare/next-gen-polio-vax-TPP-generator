#!/usr/bin/env Rscript

# Fixture generation is intentionally explicit: source repositories are inputs,
# not an implicit local checkout. This script records the locked commits and
# refuses tracked changes before a future source-parity fixture generator runs.

repo_status <- function(path) {
  status <- system2("git", c("-C", path, "status", "--porcelain", "--untracked-files=all"), stdout = TRUE)
  tracked <- status[!grepl("^\?\?", status)]
  list(tracked_dirty = length(tracked) > 0L, untracked = sub("^\\?\\? ", "", status[grepl("^\\?\\?", status)]))
}

cessation <- "/Users/famulare/git/famulare/cessationStability"
india <- "/Users/famulare/git/famulare/india-polio"
for (repo in c(cessation, india)) {
  if (!dir.exists(repo)) stop("Missing locked source repository: ", repo)
  status <- repo_status(repo)
  if (status$tracked_dirty) stop("Refusing fixture generation with tracked source changes: ", repo)
}

cat("Source repositories are clean in tracked state. The v1 TypeScript port currently uses committed manifests; source parity fixtures remain a release gate before claiming numerical parity.\n")
