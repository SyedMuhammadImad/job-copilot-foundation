# Job Copilot: private resume notes

A Next.js application for storing and maintaining resume text behind Supabase authentication. Users can create, edit and delete their own notes. PostgreSQL permissions and row-level security enforce ownership independently of the interface.

The implemented product is a resume-note workspace. AI tailoring, job scraping and application tracking are outside this implementation.

## Run locally

Use Node.js 24 and a Supabase project with email authentication enabled. Keep email confirmation enabled for a deployed instance.

1. Review and run `supabase/schema.sql` in the project's SQL editor. The script grants authenticated users access to their own rows and permits writes only to `raw_text`; ownership and timestamps are assigned by the database. Existing invalid records cause the schema update to fail instead of being removed.
2. Create an ignored `.env.local` containing `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. A legacy anonymous key is accepted through `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Obtain these public client settings from your project; do not use a secret or service-role key.
3. Run `npm ci`, then `npm run dev`. Open http://localhost:3000.
4. Configure Supabase's allowed site/redirect URLs for your instance. Create an account, confirm its email when required, and sign in.

For a production build, set the same public client settings before `npm run build`, then run `npm start`. Missing configuration produces a setup message. Authentication routes use private, non-cacheable responses, including redirects that clear expired cookies.

## Behavior

- Notes contain 1–40,000 characters, with whitespace-only values rejected in both the interface and database. The dashboard shows the latest 100 notes.
- Failed saves retain the unsaved text. Editing and deletion require an actual visible row response; deleting a note requires confirmation.
- Text is rendered literally. Two accounts cannot read, change, delete or take ownership of each other's records.
- Sign-up that requires email confirmation stays logged out. Expired or invalid authentication redirects to sign-in.

## Verify

```sh
npm run check
npm run test:db
npm run test:browser
npm run build
```

`test:db` runs the SQL against isolated PostgreSQL through PGlite, exercising anonymous denial, owner CRUD, cross-user denial, ownership forgery, constraints and repeatable schema application. `test:browser` creates an isolated local authentication/Data API fixture, signs temporary sessions in memory, and runs a production build in a headless browser against the same PostgreSQL policies. It exercises two-account isolation, CRUD, failed saves, literal text, mobile width, session expiry, sign-out and email-confirmation behavior.

The browser test uses installed Microsoft Edge on Windows. Elsewhere, install Playwright Chromium with `npx playwright install chromium`; `PLAYWRIGHT_CHANNEL` can select an installed channel. Ports 9131 and 9132 must be available. Tests do not connect to a hosted project or send email.

These checks establish the local implementation's behavior. Hosted Supabase configuration, real email delivery, deployment and operational security require validation in the intended environment. Resume data is sensitive: use a private account and avoid retaining information you do not need.

## Source and publication

This application continues the owner's retained authentication/database scaffold. The implementation now includes complete note maintenance and isolated verification. Dependencies retain their upstream licenses. The publication contains source, schema, lockfile and verification results; credentials, user notes, databases, generated builds, dependency folders and media stay local.
