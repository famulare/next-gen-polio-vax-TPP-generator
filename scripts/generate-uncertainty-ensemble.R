#!/usr/bin/env Rscript

# Do not manufacture a posterior from independent confidence-interval endpoints.
# This placeholder is a deliberate fail-closed guard until reviewed joint draws
# are supplied with source provenance, filters, weights, and a quantile rule.
stop("No reviewed joint uncertainty ensemble is supplied for v1; sensitivity values must not be relabeled as posterior draws.")
