## ADDED Requirements

### Requirement: GitHub Actions workflow builds and deploys on push to main
`.github/workflows/deploy.yml` SHALL define a workflow triggered on `push` to the `main` branch that runs `npm ci`, `npm run build`, and `npx wrangler deploy` in sequence on `ubuntu-latest`. The workflow MUST use a `CLOUDFLARE_API_TOKEN` secret for authentication.

#### Scenario: Workflow triggers on main push
- **WHEN** a commit is pushed to the `main` branch
- **THEN** the `deploy` GitHub Actions job is triggered automatically

#### Scenario: Build step runs before deploy
- **WHEN** the workflow runs
- **THEN** `npm run build` executes and produces a `dist/` directory before `wrangler deploy` is invoked

#### Scenario: Deploy uses API token secret
- **WHEN** the workflow invokes `wrangler deploy`
- **THEN** the `CLOUDFLARE_API_TOKEN` environment variable is set from `${{ secrets.CLOUDFLARE_API_TOKEN }}`

#### Scenario: Workflow fails fast on build error
- **WHEN** `npm run build` exits with a non-zero code
- **THEN** the workflow stops and does not invoke `wrangler deploy`

### Requirement: Workflow documents required secrets
The workflow file SHALL include a comment block at the top listing all required GitHub Actions secrets and how to obtain them.

#### Scenario: Secrets documented in workflow
- **WHEN** a developer reads `.github/workflows/deploy.yml`
- **THEN** they can identify every required secret (`CLOUDFLARE_API_TOKEN`) and find a comment explaining where to get the value
