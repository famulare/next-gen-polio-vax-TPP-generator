# Next-gen polio vaccine TPP generator

We are making an interactive TPP generator to help people reason about the
question: **how much shedding reduction is required of a successful new
vaccine?** The generator is based on the model in [this paper](https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.2002468).

Explore the related [data explorer](https://famulare.github.io/cessationStability/onlineVisualization/).

## Design contract

The full implementation plan is a locked, standalone
[design contract](./DESIGN_CONTRACT.md). It specifies the biological model,
distribution-native transmission calculation, linked Pareto views, uncertainty
semantics, calibration gates, software architecture, and release tests. The
interactive application has not yet been implemented.
