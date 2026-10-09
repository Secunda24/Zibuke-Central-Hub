# Platform implementation audit ? 27 September 2026

**Latest runtime follow-up:** See [runtime-sweep.md](runtime-sweep.md) for the production login repair, confirmed schema/buckets, 47 passing tests and visible student portal entry points. The dated findings below preserve the earlier audit baseline; its missing-secret and local-only-migration statements are superseded by that follow-up.

**Overall: PARTIAL. Not approved as fully production-verified.** This report distinguishes automated backend evidence from static review and deployment/browser work. The original investigation is in [platform-audit-initial.md](platform-audit-initial.md).

## Build troubleshooting follow-up ? 27 September 2026

The final full Next.js/OpenNext production build completed successfully after the calendar wrapper correction, with TypeScript validation enabled. All 39 regression tests were rerun successfully.

The earlier lint failures recorded below are historical and superseded by the current full-source result: **0 errors, 73 warnings**. All **39 regression tests pass** and the standalone TypeScript check passes. Source rules remain enabled; CommonJS import syntax is permitted for CommonJS files. Added build:cloudflare, deploy:cloudflare, check:cloudflare and types:cloudflare scripts.

A read-only production check found the training and request-limit tables present. The remote secret listing contained GROQ_API_KEY and RESEND_API_KEY; SESSION_SECRET and LiveKit server secrets were not listed. These require release configuration. No secrets were changed, deployment performed, or employee permissions modified during troubleshooting. Browser/provider acceptance remains outstanding.

## Scope and totals

66 requirements traced: 18 PASS (bounded automated evidence), 43 PARTIAL, 3 BLOCKED, 2 MANUAL REVIEW REQUIRED. A PASS does not imply an unperformed browser or external-provider test passed.

The private workbook report covers 141 source rows against 135 existing accounts: 125 matched rows, 2 probable, 12 unmatched, 2 duplicate rows; 127 distinct existing IDs matched across sources. Employee/profile changes applied: **0**. Roles/access grants applied: **0**. Records intentionally unchanged: **141 source rows**. No identities recreated, historical data removed, or ambiguous rows merged.

## Traceability

Paths are relative to apps/angel-core; API/UI mappings use the same shorthand as the initial report.

| Requirement | Result | UI / API / domain | Storage | Evidence / remaining work |
|---|---|---|---|---|
| Sign-in / session | PARTIAL | `/` → auth/login, auth/session | users; signed cookie | Deleted accounts and tokens older than a password change are rejected. Runtime session rotation still required. |
| First-login OTP | BLOCKED | `/` → auth/verify, auth/login-otp | login_challenges | BLOCKED: sender domain unverified; enforcement deliberately disabled |
| Dashboard guard | PARTIAL | dashboard/layout → shell | session | Server layout redirects unauthenticated requests to login. |
| Shell/navigation | PARTIAL | DashboardShell | current user, notifications | Mobile menu and minimum content width added; visual browser verification pending. |
| Home updates | PARTIAL | dashboard → dashboard API | updates/users | PARTIAL: traced; no training summary; error handling incomplete |
| Direct conversation | PARTIAL | messaging/ConversationPage → messages | messages/direct_read_state | PARTIAL: unread includes deleted rows; notification/attachment consistency needs tests |
| Direct edit/delete/reply | PARTIAL | ConversationPage → messages/[id] | messages, attachments, reactions | PARTIAL: legacy settings/messages duplicates an older messaging path |
| Message attachments | PARTIAL | AttachmentComposer → attachments/upload, attachments/[id] | COLLAB_BUCKET/message_attachments | Participant/member authorization and safe content headers added; SQL access regressions pass. |
| Message summaries | PASS | MessageSummary → messages/summarize | Groq; no DB mutation | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Channel listing | PARTIAL | channels → channels API | channels/users | Private and archived channels excluded unless authorized. |
| Channel read/send | PARTIAL | channels/[id] → channels/[id]/messages | channel_messages | Membership checked; replaced nonexistent is_deleted column with deleted_at. |
| Channel membership | PARTIAL | membership API | channel_members | Private self-join blocked; existing owner/member access preserved. |
| Channel reactions | PARTIAL | reactions API | message_reactions | Parent message access checked. |
| Channel lifecycle | PARTIAL | channels/[id] DELETE | channels/channel_messages | Archive preserves message history. |
| Files listing/upload/edit | PARTIAL | files → files API | files/COLLAB_BUCKET | PARTIAL: upload scope/size/type validation insufficient |
| File download | PARTIAL | files → storage/[...path] | COLLAB_BUCKET | Requires authorized files metadata, so removed/moved metadata cannot be bypassed by guessing an R2 path. |
| Announcement listing/create | PARTIAL | announcements → announcements API | announcements/audience | Removed hardcoded email administrator bypass. |
| Announcement details/actions | PARTIAL | announcements APIs/helper | views/acknowledgements/reactions | Admin pin/publish/archive PATCH implemented. |
| Announcement schedule | PARTIAL | promoteDueAnnouncements | notifications | Hourly worker scheduled handler promotes due announcements; notification IDs deduplicate retries. Not deployed. |
| Announcement edit | PARTIAL | announcement UI → [id] PATCH | announcements | Pin, publish and archive now wired. Full content editing remains absent. |
| Calendar listing | PARTIAL | calendar → calendar GET | events/event_attendees | Channel audience scoped. |
| Calendar create/edit/respond | PARTIAL | calendar APIs | events/attendees/cards | Private channel access and invitation scope checked. |
| Availability | PARTIAL | calendar/availability | events/attendees | PARTIAL: workday calculations use runtime timezone; bind count at 100 participants |
| People/contact cards | PARTIAL | people → people API | users | ID details supplied and uploaded/verified document status distinguished; full identity number remains private. |
| ID privacy | PASS | People / profile / documents APIs | employee_profiles/private R2 | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Employee creation | PARTIAL | admin → admin/users | users/private R2 | PARTIAL: bulk import requires separate verification |
| Legacy employee route | PARTIAL | auth/admin/users | users | Reuses current authorized employee handler instead of obsolete SQL. |
| Employee edits/removal | PARTIAL | admin/people → people/[id] | users | PARTIAL: insufficient validation; deletion blocked by historical relationships |
| Profile settings | PARTIAL | settings → settings/profile | users/employee_profiles | PASS for code trace; browser persistence not yet verified |
| Password settings | PARTIAL | settings/password | users | Input bounds; signed sessions checked against password update timestamp. |
| Avatar | PARTIAL | settings/avatar | AVATARS_BUCKET/users | JPEG/PNG signature and size validation; safe download headers. |
| Email test | PARTIAL | settings → email API | Resend | Self-only fixed message and atomic one-per-minute throttle; real verified sender still required. |
| Settings preferences | PARTIAL | settings toggles | No preferences persistence found | Unavailable email/SMS switches disabled and labelled honestly. |
| Birthdays | PARTIAL | birthdays API/UI | users.date_of_birth | Invalid dates rejected and API errors no longer become empty successful lists. |
| Existing Reports | PARTIAL | reports → reports API | counts/users/files/channels/announcements | PARTIAL: real counts; training aggregate/filter report missing |
| Tracking reports | PARTIAL | reports + TrainingPage → reports/tracking | tracking_submissions/positions | PASS in domain tests for schedule/late dates; browser QA pending |
| Notifications | PARTIAL | notifications UI/API/popup | notifications | PARTIAL: failure shown as empty; latest message includes deleted/read records |
| Global search | PASS | GlobalSearch → search API | live D1 + public snapshot | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Calls/token | PASS | CallConnection → livekit | LiveKit/call_signals/events | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Instant/meeting details | PARTIAL | meetings APIs | events/attendees | Removed queries against nonexistent users.name. |
| AI assistant | PASS | AiAssistant → assistant/retrieval | public reference snapshot/Groq | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Course/lesson setup | PARTIAL | TrainingPage → training/server | learning_courses/lessons | Sections, ordering, required lessons, duration, draft/publish/archive; published course content immutable. Admin may create future courses. |
| Training resources | PARTIAL | lesson resource link | HTTPS reference only | Private PDF/MP4 uploads, assigned/admin reads, inline video. Explicit completion acknowledgement; no claimed proof of video watching. |
| Training assignments | PASS | training/server | assignments/position_courses | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Assignment deadlines | PARTIAL | training/server | No due-date column | Due dates, overdue/due-soon calculation and explicit deadline changes implemented. |
| Quiz builder/attempts | PASS | TrainingPage → training/server | quizzes/attempts | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Progress | PARTIAL | lessons + quizzes → overview | progress/attempts | Derived Not started/In progress/Completed and timestamps; latest first-required-quiz pass used. |
| Assessment eligibility | PASS | eligible + mutation + SQL trigger | assignments/lessons/attempts | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Individual AA overrides | PASS | training/server | assessments active/is_override | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Numeric/project AA | PASS | TrainingPage → training/server | assessments | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Training assigned/completed alerts | PASS | training/server | Existing notifications not used | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Due/overdue reminders | PARTIAL | no scheduler | No due dates/cron | Hourly worker cron configured; production execution not tested. |
| Assessment unlocked once | PASS | no notification path | No notification dedupe | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Workbook matching | PASS | reconcile-training-director script | Read-only snapshot/private report | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Review/apply safety | PASS | ReconciliationReview → admin/reconciliation | users/profiles/audit | Automated regression evidence covers stated backend behavior; browser/provider verification is separate. |
| Position configuration | MANUAL | learning_positions + workbook report | Draft/proposed config | BLOCKED / MANUAL: division/access approval, source conflicts and bi-weekly meaning |
| Scoped manager reporting | MANUAL | only self/admin currently | No approved relationships/capabilities | BLOCKED / MANUAL: approve capability and manager mappings; do not infer from job title |
| Training/AA reports | PARTIAL | per-person TrainingPage | learning tables | Admin aggregate filtering and CSV export plus own records; real browser export pending. |
| Audit trail | PARTIAL | learning_audit | Actor/user/action/entity/time | Actor/action/employee/entity/time stored. Detailed before/after override reasoning UI remains incomplete. |
| Schema consistency | PASS | schema.sql vs migrations/live snapshot | D1 | Fresh baseline generated from deployed schema without employee data; baseline runs twice successfully. |
| Migration integrity | BLOCKED | 001–007 | Additive 007; historical ALTERs | Additive migrations 007 and 008 are local only. No production database mutation. |
| Secrets | BLOCKED | wrangler vars/session helper | Worker config | Hardcoded session secret removed from wrangler; a new Cloudflare secret must be installed before deployment. Historical key must be considered compromised. |
| TypeScript | PASS | tsc --noEmit | N/A | Separate TypeScript and final OpenNext build type checking both pass; ignoreBuildErrors is false. |
| Lint | PASS | npm run lint | N/A | 27 September build follow-up: full source lint passes with 0 errors and 73 warnings. Worker/query/response types and React state flows corrected. CommonJS require imports allowed only in .cjs files; generated Worker declarations excluded. |
| Production build | PASS | npm run build | Next output | Final Next/OpenNext production build and Wrangler dry-run passed; no deployment performed. |
| Real integrations | PARTIAL | Resend/LiveKit/R2/UI | External services | Real Resend delivery, multi-device LiveKit, deployed private R2 files and authenticated browser journeys not verified. |

## Frontend matrix

These are complete-workflow assessments; static inspection and tests do not substitute for real clicks.

| Screen | Result | Verification / remaining work |
|---|---|---|
| Home | PARTIAL | API path traced; loading/error and live browser journey still need verification. |
| Messages | PARTIAL | Participant access and attachment boundary tested; full compose/edit/delete/browser flow pending. |
| Channels | PARTIAL | Privacy and deleted-message SQL tested; membership and archived UI journey pending. |
| Files | PARTIAL | Metadata-based authorization and file headers fixed; live R2 upload/download pending. |
| Announcements | PARTIAL | Publish/archive/pin handler repaired; full content editor absent; browser workflow pending. |
| Calendar | PARTIAL | Audience and invite scope fixed; actual invitation/response flow pending. |
| People | PARTIAL | Stable IDs retained and ID status clarified; live rendering pending. |
| Birthdays | PARTIAL | Invalid date validation fixed; browser failure-state handling needs review. |
| Reports | PARTIAL | Training filters/CSV implemented; browser export and approved manager scopes pending. |
| Admin | PARTIAL | Role-gated, training links and reconciliation review added; workbook changes await approval. |
| Settings | PARTIAL | Profile/document paths exist; fake notification preferences removed; real email blocked. |
| Notifications | PARTIAL | Training links and deduplication tested; deployed cron and popup interaction pending. |
| Search | PARTIAL | SQL authorization tests pass; live navigation/browser pending. |
| Meetings / Calls | PARTIAL | Token scope tests pass; legacy call links create invitations; two-device media not tested. |
| Zibuke AI | PARTIAL | Seven bounded provider-mock tests pass; real provider/browser not tested. |
| Training | PARTIAL | Backend lesson/quiz/assessment rules tested; authenticated learner/admin browser journeys pending. |

## Training and assessment behavior

Admin can create draft courses, sections, ordered text/media lessons, required quizzes and pass marks; upload private PDF/MP4 resources; publish/archive courses; configure learning positions; assign optional/compulsory courses and deadlines; and add numeric or project assessments. Published learning content cannot be changed underneath an existing assignment.

Eligibility uses required lessons and required quizzes across every compulsory course. No compulsory training allows assessment. Incomplete lessons or failed quizzes block both candidate start and admin progress updates. Database triggers repeat this guard at write time. Client-supplied quiz scores are ignored. Attempts are capped at ten per hour. Training completion never marks an accountability assessment complete.

An individual assessment override preserves the old record and its progress. Reassignment is idempotent. Published/archived content history and stable employee IDs remain intact. Existing admin/employee permissions remain authoritative; titles do not grant permissions.

Reporting days are explicit weekdays in Johannesburg time. Missing/late history displays the last 90 days; submissions persist beyond that window. PDF/video evidence currently uses an HTTPS link. Course resources, separately, support private uploads.

In-app assignment/completion/due/overdue/unlock notifications use stable IDs. A failed immediate notification does not roll back a saved training action; the hourly scheduled job retries. Email/SMS digests are not implemented.

## Manual workbook review

- Netta's resigned record and 11 unnamed Business Developer entries remain pending.
- Resolve conflicting managers for Tshegofatso and the repeated Tiisetso row.
- Shared personal email for Manqoba/Nqobile must not merge identities.
- Correct malformed company emails for Kamogelo and Boitumelo.
- Approve division changes, manager relationships and explicit access capabilities; current access remains.
- Resolve source units for Sales Manager/CRM, contradictory position/division entries and the meaning of ?Bi-Weekly?.
- Four intern targets remain proposals tied to matched stable IDs: Zimasa 2500 orientations; Mutshidzi 1000 onboarding; Somila 2000 reports; Andiswa 100 sessions plus a presentation. No targets were activated.
- Qualification/institution, invalid contact/ID/date fields require source confirmation.

Private reconciliation JSON/HTML is in the ignored root .employee-import directory. Do not commit it, raw exports, backups, or environment files.

## Validation

- Full regression run: **39 passed, 0 failed**, including eight training/reconciliation workflows and two private-content authorization tests.
- Final standalone TypeScript check: **PASS**.
- Next production build: **PASS**, including type checking, 45 static/API build entries and dashboard routes generated dynamically.
- Fresh schema baseline: **PASS**, applied twice to an empty SQLite database.
- Focused training lint: **FAIL**, 16 remaining explicit-any typing errors. Hook finding and reconciliation UI typing findings were fixed. Rules were not suppressed.
- Earlier whole-source lint audit: 283 errors and 70 warnings; this is the initial source baseline, not a claimed final recount. Generated OpenNext/Wrangler output now excluded.
- Final full OpenNext production build: **PASS**, exit 0, including the final source changes. An initial sandbox packaging attempt failed on parent-directory access; the authorized build outside the sandbox succeeded.
- Wrangler custom-worker dry-run: **PASS**, exit 0; cron wrapper, D1/R2 bindings and bundled worker resolve. This validates packaging, not real cron execution or bucket access.
- Final focused hook check: **PASS** for the loading effect; the 16 remaining focused lint errors are explicit-any typing findings.
- Production deployment, production migrations, real employee updates, OTP delivery, multi-device media and authenticated browser acceptance: **NOT PERFORMED**. Requires a deployed test environment, authorized test accounts and configured external providers.

## Release steps

See [training-release.md](training-release.md). Stop if a migration or build fails. Configure a fresh session secret before deploying the new code. Production rollout is not claimed by this audit.

Final deployment packaging check (27 September 2026): `wrangler deploy --dry-run` passed, exit 0, including the custom scheduled worker wrapper and configured D1/R2 bindings. Compressed worker size: 1720.65 KiB. No deployment was performed.
