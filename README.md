This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Session secret (required)

Sessions are HS256 JWTs stored in the `zc_session` httpOnly cookie and verified
by `src/modules/auth/session.ts`. Every route handler and the `/dashboard`
server guard go through that one module — never read the cookie directly.

The signing key comes from the `SESSION_SECRET` secret and is never committed:

- **Local:** add `SESSION_SECRET=<random hex>` to `.dev.vars` (gitignored).
  Both `npm run dev` and `wrangler dev` read it.
- **Production:** set it once per environment before deploying.

  ```bash
  npx wrangler secret put SESSION_SECRET
  ```

If `SESSION_SECRET` is missing the app fails closed: login returns 500 and no
session is ever issued. Changing the secret — or deploying the signed-session
scheme over the old raw-id cookie — invalidates existing sessions, so every user
signs in again once.


## Calling / LiveKit

Calls use the signed-in account ID as the LiveKit participant identity. Display
names are not identities: LiveKit disconnects the older connection when two
participants join the same room with the same identity.

Configure `NEXT_PUBLIC_LIVEKIT_URL` (or `LIVEKIT_URL`), `LIVEKIT_API_KEY`, and
`LIVEKIT_API_SECRET` from the **same LiveKit project**. The token endpoint returns
the server URL with the token so both come from the runtime configuration.
Local Next.js development can read these values from `.env.local`.

For Cloudflare, keep the URL in Wrangler configuration and store credentials as
Worker secrets, using the working values from the project's LiveKit settings:

```sh
npx wrangler secret put LIVEKIT_API_KEY
npx wrangler secret put LIVEKIT_API_SECRET
```

Do not add these two credentials to `wrangler.json` or commit them. Deploy the
updated Cloudflare build after configuring the secrets. Local `.env.local`
values alone do not configure a deployed Worker.

Run the call regression tests with:

```sh
node --test tests/calls.test.cjs
```

For end-to-end verification, sign in as two different accounts in separate
browser profiles or on separate devices. Call from People, accept the invitation,
and verify that both participants appear, audio/video and screen sharing work,
and leaving/rejoining behaves correctly. Test with camera/microphone permission
denied as well: the call should remain available with a device warning.

## Zibuke AI Bot

The bottom-right dashboard assistant answers company and platform help questions
using a checked-in reference snapshot. This is retrieval-based help, not model
fine-tuning: selected source excerpts are sent with each question to the existing
Groq model. It reads no private messages, employee files or identity documents.
Chat history lives in the current browser component only and is not persisted.

The scanner follows public links and sitemap entries on zibukeafrica.com and
zibukeoncall.co.za, respects robots.txt, skips account/checkout/booking endpoints,
and records skipped pages. Each site is bounded to 60 indexed pages and 150
visited URLs. Platform coverage scans every dashboard page and its imported UI
components for visible labels, combined with maintained instructions in
`src/modules/assistant/platform-guide.json`. It does not send backend source,
environment files, database records or arbitrary internal URLs to the model.

Refresh when website content or platform screens change:

```sh
npm run ai:refresh
```

Review `src/modules/assistant/knowledge.json` (scan dates, skipped pages, coverage)
and the platform guide, then build and deploy normally. The snapshot is bundled
with the app; it does not refresh automatically on a schedule. Failed website
scans leave the previous snapshot unchanged. Source dates appear in the widget;
prices and other time-sensitive details should be confirmed on the linked site.

`GROQ_API_KEY` must be configured as a Cloudflare Worker secret in production.
The assistant endpoint requires a signed-in session, limits question/history
sizes, excludes admin help for non-admins and returns only allowlisted reference
links. The assistant is read-only and cannot perform account or booking actions.

Checks:

```sh
node --test tests/assistant.test.cjs
```

## Global search

Use Search beside OnCall Portal, or Ctrl/Cmd + K. The dialog searches live
platform records and the existing AI website index, with source filters and
paginated top matches. Private messages, channel memberships, announcement
audiences, file departments and event access are checked on the server.
Deleted messages are excluded. A failed category is reported in the dialog;
other categories remain available.

File search covers names and folders, not document bodies. Website results
cover indexed public pages, not authenticated portals. Refresh website results
with `npm run ai:refresh`, then rebuild and deploy. Search itself does not send
private platform records to an AI provider.

Run SQL permission and search checks with:

```sh
node --test tests/search.test.cjs
```

## Training and platform audit

Training, quiz prerequisites and assessment workflows are implemented locally. Review [the audit](docs/platform-audit-final.md) for verified behavior and remaining release checks, and [the release guide](docs/training-release.md) before applying migrations 007/008 or deploying the cron worker. Workbook changes remain proposals until approved.
