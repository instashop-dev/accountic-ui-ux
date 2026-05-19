## MODIFIED Requirements

### Requirement: GitHub Actions workflow builds and deploys on push to main
`.github/workflows/deploy.yml` SHALL define a workflow triggered on `push` to the `main` branch. The workflow MUST contain two jobs: a `test` job and a `deploy` job. The `test` job SHALL run `npm ci` and `npm test` on `ubuntu-latest`. The `deploy` job SHALL run `npm ci`, `npm run build`, and `npx wrangler deploy` on `ubuntu-latest`, declare `needs: [test]`, and use a `CLOUDFLARE_API_TOKEN` secret for authentication. The `deploy` job MUST NOT run if the `test` job fails.

#### Scenario: Workflow triggers on main push
- **WHEN** a commit is pushed to the `main` branch
- **THEN** both the `test` and `deploy` GitHub Actions jobs are triggered (deploy only after test passes)

#### Scenario: Test job runs before deploy job
- **WHEN** the workflow runs
- **THEN** the `test` job executes `npm test` before the `deploy` job starts

#### Scenario: Build step runs before deploy within deploy job
- **WHEN** the `deploy` job runs
- **THEN** `npm run build` executes and produces a `dist/` directory before `wrangler deploy` is invoked

#### Scenario: Deploy uses API token secret
- **WHEN** the `deploy` job invokes `wrangler deploy`
- **THEN** the `CLOUDFLARE_API_TOKEN` environment variable is set from `${{ secrets.CLOUDFLARE_API_TOKEN }}`

#### Scenario: Workflow fails fast on test failure
- **WHEN** the `test` job exits with a non-zero code
- **THEN** the workflow stops and the `deploy` job does not run

#### Scenario: Workflow fails fast on build error
- **WHEN** `npm run build` exits with a non-zero code within the `deploy` job
- **THEN** the workflow stops and does not invoke `wrangler deploy`

### Requirement: Workflow documents required secrets
The workflow file SHALL include a comment block at the top listing all required GitHub Actions secrets and how to obtain them.

#### Scenario: Secrets documented in workflow
- **WHEN** a developer reads `.github/workflows/deploy.yml`
- **THEN** they can identify every required secret (`CLOUDFLARE_API_TOKEN`) and find a comment explaining where to get the value
