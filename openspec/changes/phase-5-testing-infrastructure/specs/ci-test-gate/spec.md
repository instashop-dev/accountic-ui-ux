## ADDED Requirements

### Requirement: npm test script runs the full Vitest suite
`package.json` SHALL define a `test` script that runs `vitest run`, a `test:watch` script that runs `vitest`, and a `test:coverage` script that runs `vitest run --coverage`. All three MUST be runnable with `npm run <script>`.

#### Scenario: npm test exits 0 when all tests pass
- **WHEN** `npm test` is run with all tests passing
- **THEN** the process exits with code 0

#### Scenario: npm test exits non-zero on test failure
- **WHEN** `npm test` is run and at least one test assertion fails
- **THEN** the process exits with a non-zero code

#### Scenario: npm run test:coverage fails below threshold
- **WHEN** `npm run test:coverage` is run and branch coverage on `src/lib/` is below 80%
- **THEN** the process exits with a non-zero code and prints a coverage summary

### Requirement: CI test job runs before deploy
`.github/workflows/deploy.yml` SHALL define a `test` job that runs `npm ci && npm test` on `ubuntu-latest`. The existing `deploy` job SHALL declare `needs: [test]` so that deployment is blocked if any test fails.

#### Scenario: Deploy job blocked when test job fails
- **WHEN** the `test` job exits with a non-zero code
- **THEN** GitHub Actions marks the `deploy` job as skipped and the deployment does not proceed

#### Scenario: Deploy job runs after test job succeeds
- **WHEN** the `test` job exits with code 0
- **THEN** the `deploy` job is triggered and proceeds normally

#### Scenario: Test job requires no additional secrets
- **WHEN** the `test` job runs in GitHub Actions
- **THEN** it completes successfully without any `secrets.*` environment variables (all tests use in-process mocks)
