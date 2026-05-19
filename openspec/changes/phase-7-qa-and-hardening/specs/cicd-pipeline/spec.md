## MODIFIED Requirements

### Requirement: GitHub Actions workflow builds and deploys on push to main
`.github/workflows/deploy.yml` SHALL define a workflow triggered on `push` to the `main` branch that runs a `test` job followed by a `deploy` job. The `deploy` job SHALL run `npm ci`, `npm run build`, `npx wrangler deploy` (Astro worker), and `npx wrangler deploy --config wrangler.pipeline.jsonc` (pipeline worker) in sequence on `ubuntu-latest`. Both deploy steps MUST use the `CLOUDFLARE_API_TOKEN` secret. The `deploy` job MUST declare `needs: [test]` so it only runs after all tests pass.

#### Scenario: Workflow triggers on main push
- **WHEN** a commit is pushed to the `main` branch
- **THEN** the `test` job runs first, then the `deploy` job is triggered automatically

#### Scenario: Both workers are deployed on each push
- **WHEN** the `deploy` job runs
- **THEN** both `wrangler deploy` (Astro) and `wrangler deploy --config wrangler.pipeline.jsonc` (pipeline) are executed in sequence

#### Scenario: Pipeline worker deploy uses API token secret
- **WHEN** the workflow invokes `wrangler deploy --config wrangler.pipeline.jsonc`
- **THEN** the `CLOUDFLARE_API_TOKEN` environment variable is set from `${{ secrets.CLOUDFLARE_API_TOKEN }}`

#### Scenario: Workflow fails fast on build error
- **WHEN** `npm run build` exits with a non-zero code
- **THEN** the workflow stops and does not invoke either `wrangler deploy` step

#### Scenario: Workflow fails if pipeline worker deploy fails
- **WHEN** the pipeline worker `wrangler deploy` step exits with a non-zero code
- **THEN** the workflow job fails and the error is visible in GitHub Actions logs

### Requirement: Workflow documents required secrets
The workflow file SHALL include a comment block at the top listing all required GitHub Actions secrets and how to obtain them.

#### Scenario: Secrets documented in workflow
- **WHEN** a developer reads `.github/workflows/deploy.yml`
- **THEN** they can identify every required secret (`CLOUDFLARE_API_TOKEN`) and find a comment explaining where to get the value
