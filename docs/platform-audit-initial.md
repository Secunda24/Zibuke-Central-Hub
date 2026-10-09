# Zibuke Central full-platform audit — initial findings

Date: 26 September 2026. **Overall: FAIL (verified authorization defects).** This is the read-only investigation checkpoint, before audit fixes. Training implementation preceded this checkpoint. No workbook employee updates or access grants have been applied.

Evidence: all application/API routes inventoried; frontend fetch/action inventory captured privately in `.employee-import/frontend-action-inventory.txt`; authentication, storage, messaging, channel, calendar, announcement, training and notification paths traced. Both workbooks were extracted across every populated sheet and compared with a read-only D1 snapshot (135 existing users). Automated tests: 34/34 passed. Separate TypeScript check passed. Next production build passed, but its configuration skips type validation. Full lint includes generated OpenNext files and is not yet a usable quality gate. Real multi-device audio/video, real email delivery and all-browser interaction have not been verified.

## Requirements traceability

Locations below are relative to `apps/angel-core`. API files use `app/api/<path>/route.ts`; UI paths use `app/dashboard/<path>/page.tsx`. Status applies to the complete workflow, not merely file existence. “Traced” means static execution-path inspection; it does not mean a real browser action passed.

| Requirement | UI → API / domain | Storage | Authorization / tests | Initial result / required correction |
|---|---|---|---|---|
| Sign-in / session | `/` → auth/login, auth/session | users; signed cookie | Signed JWT; no session revocation check | PARTIAL: deleted accounts / password changes leave existing tokens valid |
| First-login OTP | `/` → auth/verify, auth/login-otp | login_challenges | Expiry, attempts, replay tests pass | BLOCKED: sender domain unverified; enforcement deliberately disabled |
| Dashboard guard | dashboard/layout → shell | session | API protection only | FAIL: no server-side dashboard redirect |
| Shell/navigation | DashboardShell | current user, notifications | Admin link role check | PARTIAL: fixed-width sidebar on small screens; browser QA outstanding |
| Home updates | dashboard → dashboard API | updates/users | Signed session; author from session | PARTIAL: traced; no training summary; error handling incomplete |
| Direct conversation | messaging/ConversationPage → messages | messages/direct_read_state | Participant SQL; traced | PARTIAL: unread includes deleted rows; notification/attachment consistency needs tests |
| Direct edit/delete/reply | ConversationPage → messages/[id] | messages, attachments, reactions | Sender-only edit/delete | PARTIAL: legacy settings/messages duplicates an older messaging path |
| Message attachments | AttachmentComposer → attachments/upload, attachments/[id] | COLLAB_BUCKET/message_attachments | Upload authenticated | FAIL: download has no participant/channel scope; active content served inline |
| Message summaries | MessageSummary → messages/summarize | Groq; no DB mutation | Auth + input bounds; 6 tests | PASS for mocked provider path; real provider not tested |
| Channel listing | channels → channels API | channels/users | Signed session only | FAIL: private/archived channels listed |
| Channel read/send | channels/[id] → channels/[id]/messages | channel_messages | Signed session only | FAIL: private channel message access not checked |
| Channel membership | membership API | channel_members | Caller identity used | FAIL: can join private channel by ID |
| Channel reactions | reactions API | message_reactions | Direct messages scoped; channels unscoped | FAIL: channel target authorization missing |
| Channel lifecycle | channels/[id] DELETE | channels/channel_messages | Owner/admin | PARTIAL: destructive two-step delete; archive preferable to losing history |
| Files listing/upload/edit | files → files API | files/COLLAB_BUCKET | Department/Executive model | PARTIAL: upload scope/size/type validation insufficient |
| File download | files → storage/[...path] | COLLAB_BUCKET | Folder-path department check | FAIL: metadata moves/deletes do not revoke old download; active content risk |
| Announcement listing/create | announcements → announcements API | announcements/audience | Role OR hardcoded email | FAIL: email-specific privilege bypass |
| Announcement details/actions | announcements APIs/helper | views/acknowledgements/reactions | Audience checks | FAIL: helper references nonexistent users.name; live schema uses first/last |
| Announcement schedule | promoteDueAnnouncements | notifications | Poll-triggered | PARTIAL: duplicate notifications under concurrent promotion; no cron |
| Announcement edit | announcement UI → [id] PATCH | announcements | No PATCH handler | FAIL: action is not wired through backend |
| Calendar listing | calendar → calendar GET | events/event_attendees | Any channel-linked event visible | FAIL: private-channel events leak |
| Calendar create/edit/respond | calendar APIs | events/attendees/cards | Organizer/admin; channel existence only | FAIL: channel permission checks absent from create/respond |
| Availability | calendar/availability | events/attendees | Exposes busy status only | PARTIAL: workday calculations use runtime timezone; bind count at 100 participants |
| People/contact cards | people → people API | users | Authenticated public-field projection | PARTIAL: card/search UI traced; no identity-information-supplied status |
| ID privacy | People / profile / documents APIs | employee_profiles/private R2 | Owner/admin documents; owner profile | PASS in document tests and projected People API; no raw ID in report |
| Employee creation | admin → admin/users | users/private R2 | Admin; hash + document validation | PARTIAL: bulk import requires separate verification |
| Legacy employee route | auth/admin/users | users | Admin only | FAIL: nonexistent name column; fabricated ID storage path |
| Employee edits/removal | admin/people → people/[id] | users | Admin | PARTIAL: insufficient validation; deletion blocked by historical relationships |
| Profile settings | settings → settings/profile | users/employee_profiles | Explicit owner allowlist | PASS for code trace; browser persistence not yet verified |
| Password settings | settings/password | users | Current password checked | PARTIAL: input limits and token revocation missing |
| Avatar | settings/avatar | AVATARS_BUCKET/users | Owner upload; signed-in views | FAIL: arbitrary file type/size; active content may be served |
| Email test | settings → email API | Resend | Any signed-in caller, arbitrary recipient/content | FAIL: mail relay abuse; sender verification also blocked |
| Settings preferences | settings toggles | No preferences persistence found | UI state only | PARTIAL: must not claim saved notifications preferences |
| Birthdays | birthdays API/UI | users.date_of_birth | Signed session | PARTIAL: errors masquerade as empty; POST accepts invalid dates |
| Existing Reports | reports → reports API | counts/users/files/channels/announcements | Signed session | PARTIAL: real counts; training aggregate/filter report missing |
| Tracking reports | reports + TrainingPage → reports/tracking | tracking_submissions/positions | Owner/admin | PASS in domain tests for schedule/late dates; browser QA pending |
| Notifications | notifications UI/API/popup | notifications | Own user | PARTIAL: failure shown as empty; latest message includes deleted/read records |
| Global search | GlobalSearch → search API | live D1 + public snapshot | Scoped SQL; 6 tests | PARTIAL: notification column probe misses live `text`; feed searches posts while Home uses updates |
| Calls/token | CallConnection → livekit | LiveKit/call_signals/events | Auth + identity; 6 tests | FAIL: arbitrary room token possible; tests do not test room membership |
| Instant/meeting details | meetings APIs | events/attendees | Scope checks | FAIL: legacy users.name references; browser media not tested |
| AI assistant | AiAssistant → assistant/retrieval | public reference snapshot/Groq | Auth, safe links/admin filtering; 7 tests | PASS for tested mocked path; real provider/browser not tested |
| Course/lesson setup | TrainingPage → training/server | learning_courses/lessons | Admin-only; tests | PARTIAL: no sections, publish/archive, duration or ordering controls |
| Training resources | lesson resource link | HTTPS reference only | Assigned lessons scoped | PARTIAL: no private course-file upload/player; explicit acknowledgement works |
| Training assignments | training/server | assignments/position_courses | Admin-only; unique(user,course) | PASS in tests; individual/position scopes, required/optional, no resets |
| Assignment deadlines | training/server | No due-date column | None | FAIL: deadlines/overdue training not implemented |
| Quiz builder/attempts | TrainingPage → training/server | quizzes/attempts | Server scoring; learner payload hides answers | PASS in tests; rate-limit concurrency needs hardening |
| Progress | lessons + quizzes → overview | progress/attempts | Server derived | PARTIAL: persists and gates correctly; explicit started/completed status timestamps absent |
| Assessment eligibility | eligible + mutation + SQL trigger | assignments/lessons/attempts | Server + write-time trigger; tests | PASS for admin-recorded AA updates; separate candidate start flow missing |
| Individual AA overrides | training/server | assessments active/is_override | Admin-only; history retained | PASS in tests; four intern mappings proposed, not applied |
| Numeric/project AA | TrainingPage → training/server | assessments | Admin verified progress | PASS in tests; training completion does not complete AA |
| Training assigned/completed alerts | training/server | Existing notifications not used | None | FAIL: notifications missing |
| Due/overdue reminders | no scheduler | No due dates/cron | None | FAIL: no executing scheduler |
| Assessment unlocked once | no notification path | No notification dedupe | None | FAIL: unlock notification missing |
| Workbook matching | reconcile-training-director script | Read-only snapshot/private report | Deterministic matching test | PASS: 141 source rows; 125 matched, 2 probable, 12 unmatched, 2 duplicates |
| Review/apply safety | ReconciliationReview → admin/reconciliation | users/profiles/audit | Admin; field allowlist/stale-value check | PARTIAL: per-field review works; some changes intentionally need private manual review |
| Position configuration | learning_positions + workbook report | Draft/proposed config | No automatic privileges | BLOCKED / MANUAL: division/access approval, source conflicts and bi-weekly meaning |
| Scoped manager reporting | only self/admin currently | No approved relationships/capabilities | Denies other employees | BLOCKED / MANUAL: approve capability and manager mappings; do not infer from job title |
| Training/AA reports | per-person TrainingPage | learning tables | Self/admin | PARTIAL: aggregate filters/CSV report absent |
| Audit trail | learning_audit | Actor/user/action/entity/time | Backend writes | PARTIAL: no detailed override reason/history view |
| Schema consistency | schema.sql vs migrations/live snapshot | D1 | In-memory SQL tests | FAIL: bootstrap schema outdated; several live columns/tables only exist remotely |
| Migration integrity | 001–007 | Additive 007; historical ALTERs | No employee writes | PARTIAL: 007 not deployed; fresh baseline install instructions needed |
| Secrets | wrangler vars/session helper | Worker config | Hardcoded session key/fallback | FAIL: move session key to secret binding; rotate exposed key with session impact documented |
| TypeScript | tsc --noEmit | N/A | Passed | PARTIAL: production build explicitly skips type checking |
| Lint | npm run lint | N/A | Generated artifacts included | FAIL/PENDING: scope generated output correctly; classify source errors |
| Production build | npm run build | Next output | Passed | PARTIAL: OpenNext/runtime and browser verification outstanding |
| Real integrations | Resend/LiveKit/R2/UI | External services | Mocked tests only for providers | NOT TESTABLE yet: no real email/media claim; safe browser checks still required |

## Severity and origin

- **Critical, pre-existing:** private channel access and joins; attachment IDOR; metadata-independent file download; arbitrary room-token access; hardcoded signing key.
- **High, pre-existing:** active upload serving, legacy nonexistent columns/routes, calendar channel scope, hardcoded announcement administrator email, arbitrary-recipient email endpoint.
- **High, new module / now explicitly required by audit:** notifications/deadlines/scheduler, course sections/lifecycle, private lesson resources, candidate assessment start flow and reporting overview.
- **Medium:** responsive shell, stale/error/empty states, schema bootstrap, live-search column mismatch, build type-check bypass.
- **Manual review:** all ambiguous source matches, unnamed/resigned candidates, division/access mappings, manager conflicts, incompatible AA units, interpretation of bi-weekly schedules; Resend domain verification.

## Full frontend result before fixes

Home PARTIAL; Messages FAIL (attachment scope); Channels FAIL; Files FAIL; Announcements FAIL; Calendar FAIL; People PARTIAL; Birthdays PARTIAL; Reports PARTIAL; Admin PARTIAL; Settings FAIL (avatar/email); Notifications PARTIAL; Search PARTIAL; Meetings/Calls FAIL (room access); Zibuke AI PARTIAL (real service/browser unverified); Training PARTIAL.

No destructive live actions were used to establish these findings. No existing account role, division or employee identity was changed. Follow-up audit fixes and final validation are recorded separately.
