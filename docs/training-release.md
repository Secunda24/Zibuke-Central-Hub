# Training release and verification

Run from apps/angel-core in PowerShell:

```powershell
Set-Location "C:\Users\angel\OneDrive\Documentos\Playground\zibuke main\apps\angel-core"
```

 The session outage has been repaired in production; see runtime-sweep.md for the current rollout status. Keep the current employee roles until workbook proposals are explicitly approved.

## Verified build status

27 September 2026: full source lint passes (0 errors, 73 warnings), all 39 regression tests pass, and the full Next.js/OpenNext build completes successfully with TypeScript validation enabled. Cloudflare publishing and browser/provider acceptance are separate steps.

## Before release

Review only intended source changes; the workspace includes unrelated edits and generated files. Never stage .env.local, backups, raw employee exports, or the ignored .employee-import folder. The existing repository also tracks generated OpenNext output; do not include it in a source-only review by accident.

**SESSION_SECRET was installed during the production outage repair. Do not rotate it again as part of a normal deployment.** For a fresh environment only, install a new session signing secret in the correct Cloudflare account. The previous hardcoded value has been removed from configuration and must not be reused. Rotation signs out all active sessions. Generate the value in memory and pipe it into Wrangler without printing it:

```powershell
$sessionKey = node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))"
$sessionKey | npx.cmd wrangler secret put SESSION_SECRET
Remove-Variable sessionKey
```

Do this during the release window. Confirm the command succeeds before deploying. Do not paste the generated secret into Git or chat.

## Additive database migration

The 27 September follow-up confirmed learning_courses, learning_assignments, learning_quiz_attempts and request_limits already exist in the production database. Do not replay migrations as a routine deployment step. For a different database that has not received these migrations, apply only the missing migrations; never replay the fresh baseline or historical ALTER migrations:

```powershell
npx.cmd wrangler d1 execute zibuke-central-prod --remote --file=./migrations/007_training_and_assessment.sql
npx.cmd wrangler d1 execute zibuke-central-prod --remote --file=./migrations/008_platform_safety.sql
```

Both create supporting tables/triggers; they do not assign training or modify employee identity, role or department. Fresh installations use schema.sql, which contains no employee data.

## Validate and deploy

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run deploy:cloudflare
```

Run each command only after the previous command succeeds. Full source lint now passes with 0 errors and 73 non-blocking warnings. deploy:cloudflare checks production configuration, builds Next.js with Webpack and standalone output, then packages and uploads the worker from an isolated temporary folder outside OneDrive. Environment files, backups and employee exports are excluded from that folder. npm run build alone produces the Next.js build, not the complete Cloudflare deployment artifact. The production build uses next build --webpack after Turbopack stalled on this Windows workspace; TypeScript validation stays enabled. For a build and packaging check without publishing, run npm.cmd run check:cloudflare. Use these npm scripts instead of deploying a potentially stale workspace .open-next folder directly. Build artifacts are retained under the printed temporary release path for inspection.

The production preflight now verifies SESSION_SECRET, LiveKit server credentials, GROQ_API_KEY, all 39 application table schemas, four protection triggers and the three configured R2 buckets before deploy:cloudflare can build or publish. RESEND_API_KEY is required when OTP enforcement is enabled. Missing configuration stops deployment. The preflight checks secret names, never their values. It does not validate provider credentials or email delivery. A new session secret signs existing users out.

Use npm.cmd run types:cloudflare when regenerating Worker binding types; it keeps Worker runtime declarations isolated from Next.js DOM types.

wrangler.json now points to worker.mjs. The wrapper delegates web requests to the generated OpenNext worker and runs hourly cron at minute zero UTC. It sends in-app training assignment/completion/due/overdue/unlock notifications and publishes due announcements. Confirm the cron trigger appears after deployment and inspect its first execution for errors.

The existing COLLAB_BUCKET binding stores private training resources. EMPLOYEE_DOCUMENTS_BUCKET remains dedicated to employee IDs and certificates. No public bucket URL is required. Verify both bindings resolve to the intended private buckets.

## Acceptance journeys

Use separate test accounts with existing authorized admin and employee roles. Do not change real employee access for testing.

1. Create a draft course with a section, a required text lesson and quiz. Publish, assign as compulsory to the test employee, and set a deadline.
2. Employee can access own course and cannot access another employee's training record or guess another employee's private documents.
3. Assessment start returns blocked before lesson completion, remains blocked after a failed quiz, and unlocks after passing. Repeated requests must not reset progress or duplicate alerts.
4. Optional training alone must not block assessment. Assign two compulsory courses and complete only one: assessment remains blocked.
5. Record numeric/project progress as admin; reject decreasing progress. Override a default and verify previous progress stays in history.
6. Upload a test PDF/MP4 to a draft lesson, publish and open as its assigned employee. An unassigned employee must receive 404. Remove test files through a controlled cleanup after verification.
7. Verify report filters and CSV; employee cannot read the aggregate admin endpoint. Check reporting days and dates against Johannesburg time.
8. Run the hourly scheduled job twice and verify notification counts do not duplicate. Test due/overdue states with disposable test assignments.
9. Exercise private channel, message attachment, calendar invite and file access with an unrelated test user.
10. Use two browser/device sessions to verify call invitation, accept/reject, media and leave.
11. Verify responsive navigation, forms, loading/errors and keyboard access at desktop and mobile widths.

## Email / OTP

The last observed Resend error was an unverified zibukeafrica.co.za sender domain. Verify the sender domain using the exact DNS records shown by Resend, then test delivery to an authorized mailbox. Keep FIRST_LOGIN_OTP_ENABLED disabled until delivery and the complete first-login challenge succeed. OTP expiry, retry limits and replay protection are covered by automated tests; real delivery is not.

No email/SMS digest service is claimed. Settings shows those options as unavailable.

## Workbook review

Open the private reconciliation report locally or upload its JSON to the admin training reconciliation panel. Review each proposed/current field. Ambiguous/duplicate/unmatched rows require manual resolution. Roles, authentication email, passwords and private identity numbers cannot be changed by that bulk review endpoint. Approve manager/capability mappings separately; a position title does not grant privileges.

Final deployment packaging check (27 September 2026): `wrangler deploy --dry-run` passed, exit 0, including the custom scheduled worker wrapper and configured D1/R2 bindings. Compressed worker size: 1720.65 KiB. No deployment was performed.

## Student entry point and initial setup

Students open **My Training** directly below Home in the sidebar, or choose **Open Training Portal** on the Home dashboard card. On mobile, the **Menu** button opens navigation. The direct URL is https://central.zibukeafrica.com/dashboard/training. The portal is available even when there are no assigned courses.

An administrator opens the same portal and uses **Training administration** to create a course, add lessons/resources and quizzes, publish it, select an employee, and assign it. Required training and quizzes enforce the existing assessment gate. Students see only their own training. The Home summary never accepts another employee ID.

At the runtime sweep, production contained zero courses and zero assignments. No example courses or employee assignments were created. Workbook access/division proposals remain pending approval.

## Current deployment

28 September 2026: deployed Worker version `e6a89199-67d3-4842-b7bc-58abd666eb68`. Login repair confirmed by the user; new student portal entry-point assets verified on the live domain. See runtime-sweep.md for evidence and remaining browser/provider acceptance checks. For subsequent releases, run `npm.cmd run deploy:cloudflare` from this app directory. Do not regenerate SESSION_SECRET for each deployment.

## Maintenance recovery — 29 September 2026

Current production Worker: `10d760ed-10cd-4297-9159-94a44e5cf59f`. The temporary password-recovery maintenance Worker had remained live after recovery completed; the full application has now been redeployed and public access checks pass. All 135 accounts had their previous passwords restored by the earlier recovery. Use those previous passwords, not the failed reset password. OTP remains disabled pending verified email delivery. Do not repeat password reset/recovery or rotate SESSION_SECRET during routine releases.

Validation: 47 tests pass, TypeScript passes, lint has zero errors (72 warnings), production preflight and full Next.js/OpenNext deployment pass. Live login and eight login assets return 200; protected dashboard routes redirect to sign-in; anonymous APIs reject access. See runtime-sweep.md for incident evidence and the authenticated-login verification limit.

## Training page section order — 29 September 2026

Deployed Worker `83b03b02-5e57-4fbe-8957-6b1449c4a94b`. Workbook reconciliation review and the complete Training administration section now appear directly below the employee selector, before individual training details and the employee report list. Existing administrator visibility and report-only behavior are preserved. Focused lint, TypeScript, production preflight and the full Cloudflare build/deployment passed.

## File department management — 29 September 2026

Worker `5095ac63-4591-49f1-a020-f648abf79a00` adds Files > Manage departments for administrators. Create and rename saved folders from the page; existing files, links and employee department assignments are preserved. Migration 009 was applied and production preflight now checks 40 table schemas. All 48 regression tests, TypeScript and focused lint passed. Live bundle and anonymous endpoint protection checks passed. See file-departments.md for details.
