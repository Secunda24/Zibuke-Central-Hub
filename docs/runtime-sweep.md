# Production runtime sweep — 27 September 2026

## Incident and repair

The live dashboard returned HTTP 500. Cloudflare logs identified `SESSION_SECRET` as missing; LiveKit credentials were present and were not the cause of this failure. A fresh random session signing secret was piped directly into Cloudflare without printing or saving it. Afterward, anonymous and invalid-cookie dashboard requests returned a sign-in redirect instead of HTTP 500. The user then confirmed that signing in worked.

The code now fails closed on unavailable session configuration, returns a useful sign-in service-unavailable response, and records last_login_at only after a session can be signed. The deployment script checks runtime prerequisites before building or publishing.

## Sweep evidence

| Area | Evidence | Limit |
|---|---|---|
| Live login/session | Runtime cause captured; secret installed; dashboard response repaired; user confirmed login | No employee credentials were read or requested |
| Production database | 39 application table schemas and four training triggers match the required schema | Metadata only; no employee records changed |
| Source SQL | 256 literal SQL statements compile against a schema-only copy of production | 26 dynamic statements are checked through covered workflows rather than this static pass |
| Main API reads | Admin and employee reads tested against the full schema; anonymous access rejected; missing detail records handled | Disposable local fixtures, not browser end-to-end tests |
| Password/session lifecycle | Actual password verification, signed session, revocation after password change, missing-secret behavior | Local fixtures |
| Documents/identity | Existing ownership, private download, administrator verification and replacement-reset regressions pass | Real ID uploads were not created or read |
| Training/assessment | Course creation, publishing, assignments, quizzes, completion, eligibility, overrides, reports and deduplicated notifications covered by regression tests | Production has no courses or assignments yet |
| Student access | My Training moved below Home; Home portal card and own-progress summary added; mobile Menu button restored | Browser automation was unavailable during this sweep |
| Authorization | Admin-only controls and own-record boundaries retained; new summary ignores target-user query parameters | Workbook role/division proposals remain unapproved |
| R2 | All three configured private buckets exist | Existing sensitive files were not downloaded |
| LiveKit | Required secret names and server URL configured; token authorization regressions pass; health endpoint corrected from Jitsi to LiveKit | A real two-device media call remains unverified |
| Email OTP | Challenge expiry, attempt limits and replay protection regressions pass | FIRST_LOGIN_OTP_ENABLED remains false; verified sender/delivery acceptance still required |
| Login assets | Public login and 11 referenced CSS/JS/font assets returned success | Font variable mismatch corrected in source |
| Failure states | Dashboard and notifications now display retryable failures rather than silently presenting empty results; notification read state updates only after a successful response | Full browser interaction checks remain outstanding |
| Release safeguards | Preflight rejects missing SESSION_SECRET, schema columns, training triggers or R2 buckets | Secret values/provider credentials are not read by preflight |

## Validation and scope

47 automated tests pass. Full-source lint passes with zero errors and 73 non-blocking warnings; the training entry-point changes also pass focused lint. TypeScript passes. Deployment/build outcome is recorded below when complete.

This is not a claim that every integration has been exercised in a real browser. No production employee roles, divisions, records, course assignments or assessment targets were modified. No sample learning material was presented as approved training.

Students use `/dashboard/training`. Administrators use the same page's **Training administration** section to create, publish and assign courses. The dashboard card remains visible when no courses are assigned.
## Deployment result — 28 September 2026

Deployed successfully to `central.zibukeafrica.com`, Worker version `e6a89199-67d3-4842-b7bc-58abd666eb68`. The hourly cron remains `0 * * * *`. Next.js compilation, TypeScript validation and all 46 static build entries completed successfully.

Turbopack stalled in the Windows workspace. Webpack completed the application build; OpenNext then hit a filesystem write error under OneDrive. Packaging the verified standalone output in a temporary folder outside OneDrive completed successfully, and the release script now uses that approach. `npm.cmd run deploy:cloudflare` runs the configuration preflight, standalone Webpack build, isolated packaging and deployment. `npm.cmd run check:cloudflare` performs a dry-run instead. Release artifacts are retained at the temporary path printed by the command, not in the workspace's potentially stale `.open-next` folder.

Post-deployment checks: public login returned 200; protected dashboard/training pages redirected anonymous requests to sign-in; user and training-summary APIs returned 401 without a session; an invalid cookie no longer caused a server error. Published dashboard and navigation bundles returned 200 and contained Open Training Portal and My Training. The production secret listing confirms SESSION_SECRET and integration secrets were retained. The user confirmed successful login following the configuration repair.
## Password reset and OTP rollout — 28 September 2026

Worker version: 8fb1cf77-8bd2-46a5-80f3-24872f693108. Production build and TypeScript passed; eight targeted authentication/document/runtime tests passed. Focused lint had no errors and one existing image warning.

All 135 accounts were reset to the user-specified welcome password using 135 independently salted PBKDF2 hashes. Production verification confirmed 135 accounts awaiting email verification, reset timestamps of 2026-09-28T20:33:50.453Z and zero previous OTP challenges. Existing sessions predate the reset and are invalidated. The reset helper's first run misparsed Wrangler's successful file-import progress output; direct database verification confirmed the reset, and the parser was corrected without repeating the reset.

Eight-digit OTP is deployed and enabled. However, a live password sign-in for the account owner returned HTTP 503: "We could not send your code." No challenge cookie or session was issued. This contradicts the previously reported successful test delivery and requires the latest Resend provider error to resolve. Browser automation timed out. Do not describe production sign-in as ready or disable OTP while accounts share the welcome password.

Four literal null surname values/suffixes were cleaned in production. Directory ID badges and per-person editing/removal controls were removed in the deployed UI. Sebelo was changed to employee after explicit user approval; the other five administrator roles were retained. Anja's registered login remains anjageldenhuys@zibukeafrica.co.za.

## Maintenance outage recovery — 29 September 2026

The temporary maintenance Worker (`df19ef66-7115-4414-9a6a-d5deb9f219c7`, deployed 28 September at 20:56 UTC) remained active after credential recovery. Its response exactly matched the reported HTTP 503 maintenance page. This was not a missing session-secret recurrence.

The private recovery verification records restoration of all 135 accounts' previous passwords at 20:57 UTC on 28 September. A read-only production aggregate check on 29 September confirmed 135 recovered accounts and zero accounts retaining the failed reset timestamp. Users should use their previous passwords. The workspace configuration has `FIRST_LOGIN_OTP_ENABLED=false`; email delivery acceptance is still outstanding. Do not repeat the password reset or recovery scripts as part of redeployment.

Before restoring the application, all 47 regression tests, TypeScript, and lint passed (zero lint errors; 72 warnings). Production preflight verified required secrets, 39 table schemas, four triggers, and all configured private R2 buckets.

Restoration deployed successfully on 29 September 2026: Worker version `10d760ed-10cd-4297-9159-94a44e5cf59f`, with the hourly cron retained. Live verification passed: login page HTTP 200; dashboard/training and invalid-cookie dashboard requests redirect to `/` (307); anonymous user/training-summary APIs return 401; empty login input returns 400; all eight referenced login assets return 200. No maintenance text remains in these responses. Authenticated production login still requires user confirmation; no user password was requested or used in this repair.
