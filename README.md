# Aivoke — combined project archive

This ZIP combines **the available Phase 1 and Phase 2 archives** into one project tree. Duplicate files were overlaid once (Phase 2 versions take precedence where a path existed in both archives); the Phase 1 seed source, generated seed, and project configuration are retained.

> **Scope notice:** Only Phase 1 and Phase 2 ZIPs were available to combine. Phases 3–9 were not present in the supplied archives and are not implemented in this ZIP. This is not yet the complete nine-phase Aivoke platform.

## Included

- Next.js App Router + TypeScript + Tailwind foundation
- Original `index.html` retained at `scripts/source/index.html`
- Supabase migrations `0001`–`0008`, including RLS and avatar storage policies
- Seed data for exactly **123 tools and 18 categories**
- Supabase browser, server, admin and request-proxy helpers
- Google OAuth callback, email magic-link flow, sign-out, onboarding and settings pages
- Profile editor, profile validation, link safety checks and avatar upload endpoint
- Upstash rate-limit helpers, Turnstile component, security logging helpers
- Automated validation tests and seed verification

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- A Supabase project for auth, database and storage

## Local setup

```bash
npm install
cp .env.example .env.local
```

Fill the required values in `.env.local`. Do not commit this file. The `.gitignore` already excludes `.env.local` and other local environment files.

Run the local checks:

```bash
npm run test:seed
npm test
npm run typecheck
npm run lint
npm run build
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase setup

1. Create a Supabase project.
2. In the SQL Editor, run migrations in numeric order: `supabase/migrations/0001_...sql` through `0008_...sql`.
3. Run `supabase/seed.sql` after the migrations.
4. Confirm the `avatars` storage bucket and its policies exist after migration `0006_storage.sql`.
5. Configure Authentication > URL Configuration with the local and production callback URLs.
6. Configure Google OAuth in Google Cloud and enable it in Supabase Authentication > Sign In / Providers.
7. Configure email delivery in Supabase Auth if you need production magic-link delivery.

The seed can be regenerated from the retained source file:

```bash
npm run db:seed:generate
npm run test:seed
```

## Environment variables

The authoritative placeholder list is `.env.example`. Add the same required variables to Vercel Project Settings > Environment Variables for Production, Preview and Development as appropriate. Do not expose server secrets using a `NEXT_PUBLIC_` prefix. Keep the service-role key, Gemini key, Turnstile secret, Resend key and Upstash token server-side only.

The only public support email configured in this project is read from `SUPPORT_EMAIL` (`info@khareldipesh.com.np`). `RESEND_FROM_ADDRESS` is a technical sender setting and must be supplied only if configuring Resend; it is not used as the public support contact.

## Vercel deployment

1. Push this project folder to a Git repository.
2. Import the repository into Vercel.
3. Framework preset: **Next.js**. Root directory: the folder containing this `package.json` (the `aivoke` folder if you uploaded the parent folder).
4. Use `npm install` as the install command and `npm run build` as the build command. Leave the output directory at the Next.js default.
5. Set Node.js runtime to 22.x or newer.
6. Add all required environment variables from `.env.example` to Vercel. Add production and preview callback URLs to Supabase Auth.
7. Deploy only after the Supabase migrations and seed have been applied.

## Checks and deployment limitations

The archive was checked for ZIP integrity, and the seed verification reports 123 tools and 18 categories. The three Node validation tests pass. The Next.js 16 request entrypoint uses `proxy.ts` (the current convention) and Supabase's SSR cookie client.

**A full production build, ESLint run and TypeScript check have not been verified in this environment**, because the npm registry could not be resolved from the build environment, so dependencies could not be installed. There is consequently no generated npm lockfile in this archive. Run the commands above locally or in CI before deploying. Supabase migrations, OAuth, email delivery, Storage and Vercel environment variables also require your own project credentials and dashboard setup.

## Current phase status

- Phase 1: included
- Phase 2: included
- Phases 3–9: not included in the available phase ZIPs
