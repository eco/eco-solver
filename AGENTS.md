# Repository Guidelines

## Project Structure & Module Organization

- `src/` hosts domain-focused NestJS modules (`intent/`, `solver/`, `liquidity-manager/`) with shared decorators and helpers under `common/` and `utils/`; `main.ts` wires modules together.
- Environment settings live in `config/`. `default.ts` merges overrides like `staging.ts` or `production.ts`; update the staging/production pair in lockstep when toggling chains or feature flags.
- Tests appear beside source files where helpful and in `test/` for the Jest e2e suite. Ignore generated directories such as `dist/` and `coverage/`.

## Build, Test, and Development Commands

- Install dependencies with `pnpm install` (enforced by the `preinstall` hook).
- `pnpm build` compiles to `dist/`. `pnpm start:dev` serves the API with watch mode; use `docker-compose up redis mongodb` to launch local infrastructure.
- `pnpm cli -- --help` lists commander jobs for rebalances and backfills.
- Core test commands: `pnpm test`, `pnpm test:cov`, `pnpm test:e2e`, and `pnpm test:watch` for rapid iterations.
- `pnpm format` (or `pnpm format:check`) runs ESLint plus Prettier and mirrors CI validation.

## Coding Style & Naming Conventions

- Respect the Prettier profile: 2-space indentation, single quotes, trailing commas, no semicolons, and 100-character lines.
- Export Nest constructs with consistent suffixes (`*Module`, `*Service`, `*Controller`). Use typed injection tokens rather than literal strings.
- Route all logging through `@nestjs/pino`; avoid `console.*`. Justify any lingering `any` with comments or follow-up tasks.

## Testing Guidelines

- Jest configuration lives in `jest.config.ts`, with Mongo setup in `jest-mongodb-config.js`. Mock viem or axios calls using helpers in `src/common/testing` before hitting live RPCs.
- Name specs `*.spec.ts`. The `test/app.e2e-spec.ts` suite expects Redis, MongoDB, and BullMQ queues; guard tests that require external services behind environment checks.
- Focus coverage on intent lifecycles, queue processors, and signer flows, especially around retry and failure handling paths.

## Commit & Pull Request Guidelines

- Keep commit subjects short and imperative (`Add USDT0 provider support`), optionally appending PR numbers or issue IDs.
- PR descriptions should cover intent, rollout or config updates, and include screenshots or curl traces when HTTP contracts shift.
- Run `pnpm format:check`, `pnpm test`, and `pnpm test:e2e` before review. Mention skipped suites or flaky cases in the PR body.

## Security & Configuration Tips

- Secrets arrive via AWS KMS and Secrets Manager. Never commit `.env*`; authenticate with `aws sso login` and set `AWS_PROFILE` locally.
- Keep `config/*.ts` environments synchronized and document impactful toggles in release notes or shared runbooks so operators can trace deployments.
