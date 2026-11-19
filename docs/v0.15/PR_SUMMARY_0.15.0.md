# v0.15.0 — CF flag variables plotted by meaning

Branch `eschalk/v0.15-cf-flags`, based on `main` (v0.13.0). To rebase on
`eschalk/v0.14-cf-decoding` once 0.14 is merged (both change `opening.py`).

Design: [CF_FLAGS_PROPOSAL.md](./CF_FLAGS_PROPOSAL.md) (research, plot kinds,
phases P1-P4).

## Summary

| Change                     | Effect                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Proposal                   | `docs/v0.15/CF_FLAGS_PROPOSAL.md`: what CF says, what other tools do, plot kinds, phases |
| Prototype                  | `scripts/prototypes/cf_flags.py` -> `artefacts/prototypes/cf_flags/` (plain matplotlib)  |
| `paranoia.sh` `prototypes` | quick step: every `scripts/prototypes/*.py` still runs                                   |

## Testing

```bash
.venv/bin/python scripts/prototypes/cf_flags.py
./paranoia.sh --only prototypes
```

## Commits

1. docs(flags): proposal for plotting CF flag variables, with its prototype
