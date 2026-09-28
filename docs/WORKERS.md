# Multi-agent ownership

- Lead/coordinator: scaffold, contracts, integration, final QA, deployment.
- Frontend worker: `src/app/**`, `src/components/**`, `src/features/**`, `src/styles/**` except contracts; consumes frozen interfaces.
- Engine worker: `src/core/emotion/**`, `src/core/memory/**`, `src/core/providers/**`, `src/core/personas/**`, relevant tests.
- Data & safety worker: `src/core/storage/**`, `src/core/safety/**`, `src/core/images/**`, `src/features/audio/**`, relevant tests.
- QA/deploy worker: `.github/workflows/**`, `scripts/**`, `tests/e2e/**`, README/deployment docs; does not alter product implementation unless reported to coordinator.

All workers must:

1. Read `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, and `docs/DESIGN.md`.
2. Touch only owned paths.
3. Run `pnpm typecheck`, targeted tests, and `pnpm build` where possible.
4. Report files modified, exact evidence, and unresolved blockers.
