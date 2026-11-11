# Project delivery workflow

## Default: commit, push and deploy every change

Unless the user explicitly says otherwise, every modification in this repository must follow this workflow:

1. Inspect `git status` and `git diff` before staging.
2. Run the relevant checks:
   - `npm run build` in `frontend/`
   - affected tests, if available
   - targeted ESLint for changed files (the full lint has pre-existing warnings)
3. Fix any new errors before committing.
4. Stage only intended files. Never commit secrets, `.env`, `.env.local`, `.env.test.local`, `backups/`, build output, Playwright reports or `supabase/.temp/`.
5. Commit with a concise conventional message.
6. Push to `origin main`.
7. Deploy to Vercel production from the repository root:
   `npx vercel --prod --yes`
8. Verify the production alias `https://sanse-complu.vercel.app` responds successfully and report the commit and deployment result.

If a change requires Supabase migrations, verify they are applied in production before deploying the code that depends on them.

## Useful project commands

- Frontend build: `npm run build` (run in `frontend/`)
- E2E tests: `npm run test:e2e` (run in `frontend/`, requires `.env.test.local`)
- Production deploy: `npx vercel --prod --yes` (run from repository root)
