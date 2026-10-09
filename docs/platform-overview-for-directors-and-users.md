# Zibuke Central — platform overview and manual foundation

Prepared 28 September 2026 from the application source and the latest deployment review. This document describes implemented workflows and identifies configuration or rollout items separately. It is a foundation for a user manual, not confirmation that every workflow has been exercised in a live browser.

## 1. Purpose of the platform

Zibuke Central is the company's internal workspace for employee communication, company information, employee profiles, private employment documents, learning and accountability assessments.

It brings these activities together:

- Finding colleagues and their contact details.
- Sending private messages and discussing work in team channels.
- Sharing company files and publishing notices.
- Scheduling meetings and joining online calls.
- Maintaining personal information and submitting identity documents and certificates.
- Completing assigned training and required quizzes.
- Controlling when candidates can start accountability assessments.
- Recording assessment progress and scheduled evidence submissions.
- Reviewing workforce and training information.

The separate **OnCall Portal** link opens the OnCall employee website. It is a different destination from the **My Training** portal within Zibuke Central.

## 2. Who uses it and how access works

### Employees and students

An employee uses their own account to access company information, communicate with colleagues, maintain their profile, submit private documents, and complete their assigned learning and assessment activities. In the training workflow, the same person may be described as a student or candidate.

Employees cannot make themselves administrators, verify their own identity documents, or access another person's private training or identity records merely by changing a URL.

### Administrators

Administrators have additional controls for employee records, access management, identity verification, course administration, assignments, assessment administration and consolidated training reporting. The Admin navigation item is shown to administrators.

Training administration is inside **My Training**, rather than a separate external learning website.

### Directors and managers

A director or manager job title does not automatically provide administrator rights. A director with an employee account uses the employee features; a director with administrator access can use the corresponding administration and reporting controls.

The manual should not promise a separate director dashboard or automatic reporting access to everyone with a manager title. Team-scoped management permissions are not established simply from job titles. Proposed workbook changes to divisions and access remain subject to approval.

## 3. Signing in and getting around

Users sign in with their registered corporate email address and password. Accounts are managed through the organisation's onboarding process. Users needing account access or password assistance should contact an administrator; do not describe a self-registration or forgotten-password workflow unless it is subsequently added.

The main navigation provides:

- Home
- My Training
- Messages
- Channels
- Files
- Announcements
- Calendar
- People
- Birthdays
- Reports
- Admin, for administrators

The top bar contains search, the OnCall Portal shortcut, call access, notifications and the profile menu. The profile menu provides account settings and sign-out. On smaller screens, **Menu** opens the navigation.

First-login email verification is enabled. After a correct password, users must enter the eight-digit code sent to their registered account email before accessing the dashboard. Codes expire after ten minutes.

## 4. Home dashboard

Home is the starting point for company updates and common activities. Users can read the company feed, post an update using the available controls, and follow shortcuts to other areas.

Training is accessed through **My Training** in the left sidebar. The Home page does not display a separate Student Portal card. An empty training list means that no courses have been assigned yet.

## 5. People directory

People provides employee cards and search/filtering by division. Cards display professional information such as name, division and job title, with the contact information made available in the directory.

Users can find a colleague and follow message or call actions. Administrators manage the underlying employee records. Private identity documents belong in the protected document workflow, not in public directory cards.

## 6. Messages and team channels

### Private messages

Messages supports direct conversations between colleagues. The conversation interface includes message sending, replies, reactions, attachments, search and controls for editing or deleting the user's own messages where available.

Long messages can offer **TL;DR**, which generates an AI summary for the reader. It does not replace the original message. Summaries cover message text, not the contents of attachments or linked pages, and depend on the AI service being available.

### Channels

Channels organise shared discussions around teams, topics or projects. Users can create a channel with a name and description and participate in channels they are authorised to access.

Channel discussions support messages, replies, reactions, shared media and meeting-related information. Private channel access depends on membership and permissions. Channel ownership and administration determine which management actions are available.

### Attachments

The collaboration attachment picker supports documents, images, video, audio and external links. Uploaded collaboration attachments are limited to 25 MB each. GIF uploads are not supported. Available file types are shown by the picker.

## 7. Company Files / Document Vault

Files provides a shared document area organised by department folder. Users can upload permitted files and see filename, department, size and uploader information. They can open files and use metadata-editing or deletion controls where authorised.

Folder access depends on department and the applicable permissions. Users should not assume that every colleague can open every file.

This vault serves shared company documents. It is separate from personal identity documents and certificates in Account Settings. Search covers file names and metadata; it does not search inside uploaded documents.

## 8. Announcements

Announcements provides structured company notices. Users can browse, search and filter notices, open the full content, and access attachments. Notices requiring acknowledgement appear as items needing attention; the reader must explicitly acknowledge them.

Authorised administrators can create announcements with title, content, category, audience and attachments. Available options include draft, immediate publication, scheduled publication, pinning, reactions and acknowledgement requirements. Published items can be managed using the available status controls.

Scheduled publication is processed by the hourly background task, so the manual should not promise publication at an exact minute. A complete post-publication content editor should not be described as an available feature.

## 9. Calendar, meetings and calls

### Calendar

Calendar covers events, meetings and huddles. Users can browse and search calendar items, inspect event details, and respond to invitations.

Scheduling includes title, start/end time, agenda, attendees and applicable channel or online settings. Availability checks and suggested meeting slots help identify scheduling conflicts. Editing and cancellation depend on organiser or administrator permissions.

### Online calls

Zibuke Meet provides online meeting facilities through LiveKit. Users can enter the call area from the top bar, follow a meeting's join action, or call a colleague from the directory.

A colleague call creates an invitation that the recipient can accept or decline. Participants must join the same meeting room. A pre-join screen allows camera and microphone preparation; connected meeting controls support microphone, camera, screen sharing, chat and leaving the call.

Browser camera and microphone permissions are required to use those devices. A real two-device call still needs acceptance testing following the configuration changes. Automatic recording or transcription is not part of the confirmed feature set.

## 10. Notifications and search

### Notifications

The bell and notification page provide relevant platform updates and links to the associated items. Users can mark notifications read, including the available mark-all-read action. Incoming call invitations provide separate accept/decline controls.

Training notifications cover assignments, completion, approaching or overdue work and assessment unlocking. Scheduled reminders are processed by the hourly task. Email and SMS digests are not an active notification delivery feature.

### Global search

Search is available from the top bar or **Ctrl/Cmd + K**. Users enter at least two characters and can filter results between platform content and the indexed public Zibuke Africa and Zibuke OnCall website content.

Search covers platform help, people, authorised messages and channels, announcements, permitted file metadata, calendar events, feed posts and the user's notifications. Results link to their relevant screen or website. Access controls still apply to search results.

The website index is not a guarantee of instant updates from external sites. Search does not inspect uploaded file contents.

## 11. Account Settings and employee documents

Account Settings allows a user to maintain their personal profile using separate save controls for the relevant sections. It includes a profile photo, personal/contact information, password changes and private employee documents. Corporate account details, division, job title and access are managed through administration.

There are separate document actions for:

- **Identity documents:** submitting an ID for administrator review.
- **Other documents:** submitting certificates and supporting records.

Employee documents accept PDF, JPEG and PNG files up to 10 MB. They are stored in private Cloudflare R2 storage and accessed through authorised application requests.

Uploading an ID does not verify it automatically. Administrators can upload on an employee's behalf and record verification. Replacing the identity document resets the verification status so the new document can be reviewed.

An email test facility depends on a correctly configured and verified email sender. It is not a general email client.

## 12. Birthdays

The Birthdays page displays recorded employee birthdays with names and divisions. Users can add or update their own date of birth using the page's form. This supports team awareness; automatic birthday emails or gifting workflows are not part of the confirmed implementation.

## 13. Training portal: the student experience

Students enter through **My Training** in the left sidebar.

The portal brings together assigned courses, progress, quizzes, assessment readiness and applicable assessment/reporting requirements. Students see their own records; administrators can inspect an employee's training record through authorised controls.

A typical learning sequence is:

1. Open an assigned course and review its requirements and deadline.
2. Work through its sections and lessons.
3. Read lesson text and use the provided video, document or external learning resources.
4. Record lesson completion using the available controls.
5. Complete required quizzes and meet their pass marks.
6. Check course completion and assessment eligibility.

Progress includes lesson completion, required quizzes passed and course status. Assignments can be compulsory or optional and can carry due dates.

Quiz answers are graded on the server. A submission is not automatically a pass. Attempts are rate-limited. Lesson or video completion acknowledgement records the student's action; it is not independent proof that every minute of material was watched.

## 14. Training administration

The **Training administration** section lets administrators build and maintain the learning programme as approved material becomes available.

Administration covers:

- Creating draft courses and descriptions.
- Organising sections and ordered lessons.
- Providing text, video, document and external-link resources.
- Uploading private PDF or MP4 lesson resources.
- Configuring required lessons and multiple-choice quizzes with pass marks.
- Publishing ready courses.
- Assigning courses to employees with compulsory/optional requirements and deadlines.
- Configuring position-related training requirements.
- Reviewing individual progress and consolidated reports.

Protected assigned course content is not intended to be silently rewritten after learners have started. Revised learning material should follow the course/version workflow so existing progress remains meaningful.

Training position requirements do not automatically change the employee's corporate division or access rights.

## 15. Accountability assessments and training prerequisites

An accountability assessment is a work-performance requirement, which can be a numerical target or a project/outcome requirement. It is separate from a course quiz.

The prerequisite rule is:

- When no compulsory training is required, the training gate permits assessment access.
- When required learning is outstanding, assessment access is blocked.
- When required quizzes have not been passed, assessment access remains blocked.
- When all compulsory training and required quizzes are complete, the assessment unlocks.

Optional training alone does not block the assessment. An unlocked assessment still needs to have been configured and assigned before there is work for the candidate to start.

Candidates can start an eligible assessment. Administrators record verified progress, evidence and completion. Finishing training does not automatically mean the accountability assessment has been completed.

The system supports multiple assessment requirements and individual overrides while retaining historical progress.

## 16. Scheduled accountability reporting

Reporting requirements can specify weekdays and expected evidence format, such as PDF or video. The reporting schedule uses Johannesburg time.

Candidates submit an HTTPS evidence link and notes against the relevant scheduled date. This reporting workflow uses links; it is not a direct evidence-file upload form. Evidence must be hosted where the intended reviewer can access it.

Tracking highlights missing or late submissions over the displayed recent 90-day period while retaining submission history. Administrators can inspect the candidate's requirements and recorded submissions.

## 17. Reports and director oversight

The general Reports area provides platform metrics, including total employees, vault files, active channels, announcements and headcount by division.

Authorised training reporting provides employee, division, position and course filtering, with views for assessment-blocked candidates and overdue training. It shows course progress, assignment/due/completion information, assessment eligibility and assessment progress.

The training report offers a filtered CSV export for review outside the platform. This should not be confused with a general-purpose export or report builder for every module.

For directors with the appropriate access, useful review questions include:

- Who has not completed compulsory training?
- Which candidates remain blocked from assessments, and why?
- Which assignments are overdue?
- Which assessments have started or been completed?
- Which scheduled evidence submissions are missing or late?
- Which employee records, identity verifications or proposed organisational changes need attention?

The platform is not presented as a payroll, accounting or unrestricted business-intelligence system.

## 18. Employee administration and workbook reconciliation

Admin provides employee creation/editing, directory management and CSV roster import. Records include corporate email, division/organogram, job title and access role. Single-entry onboarding includes identity-document requirements; legacy import has a separate exemption path described by the form.

Workbook reconciliation supports comparison of proposed information with existing employee records. Ambiguous matches and conflicting division/access requirements need review rather than automatic acceptance. A proposed title does not itself authorise an administrator role.

Current instructions retain existing access until changes are approved. The previously flagged resigned employee and unnamed Business Developer entries remain pending rather than being treated as confirmed active employee imports.

## 19. Zibuke AI assistant

The floating assistant helps users understand platform features and find referenced public company information. It depends on the configured AI service and available reference material.

It is not an administrator acting on the user's behalf: it cannot grant access, reset passwords, amend employee records, verify identity documents or operate calls. It does not read the contents of private uploaded documents. Users should confirm significant operational information with the appropriate company owner.

## 20. Suggested first-day journeys

### New employee or student

1. Obtain an authorised account and sign in.
2. Review Account Settings and save accurate personal/contact information.
3. Upload the requested identity and supporting documents.
4. Read and acknowledge relevant company announcements.
5. Use People, Messages and Channels to connect with the team.
6. Open My Training and complete assigned learning and quizzes.
7. Check assessment readiness and follow assigned accountability requirements.
8. Submit scheduled reporting evidence and monitor notifications and deadlines.

### Administrator

1. Confirm employee identities, contact details, divisions, titles and approved access.
2. Review identity submissions and record verification.
3. Create and publish approved learning content.
4. Configure position requirements, individual assignments and deadlines.
5. Configure assessment targets/outcomes and reporting schedules.
6. Monitor blocked and overdue candidates, inspect evidence and record verified outcomes.
7. Review proposed workbook changes before applying approved updates.

### Director

1. Review relevant company notices and workforce metrics.
2. Use authorised training reports to identify overdue or blocked candidates.
3. Review assessment outcomes and reporting exceptions with the responsible administrator.
4. Approve organisational/access proposals through the agreed business process.
5. Ensure the approved learning content, targets and deadlines reflect company expectations.

## 21. Rollout status and manual boundaries

The latest deployment includes the visible My Training navigation item, training administration and the supporting training/assessment workflows. Login was repaired and successful sign-in was confirmed by the user.

At the last production review, there were no courses or assignments in the production database. Administrators must add approved content, publish courses and assign learners; demonstration material has not been substituted for company-approved training.

Eight-digit first-login email OTP was enabled on 28 September 2026 after the administrator confirmed sender verification and successful test delivery. A real two-device LiveKit call and full browser learning journeys still require user acceptance testing. Automated coverage and successful deployment do not replace those checks.

Current workbook division/access proposals remain unapproved. The manual should describe current permissions, not proposed future access. Future courses, assessment criteria and company policies can be added through the administration workflow as they are received.

## 22. Suggested final manual chapters

1. Welcome, purpose and access responsibilities
2. Signing in and navigation
3. Updating your profile and submitting documents
4. Finding people and communicating
5. Files, announcements and acknowledgements
6. Calendar and online meetings
7. Student training and quizzes
8. Accountability assessments and scheduled reporting
9. Director reporting and oversight
10. Administrator onboarding, course management and verification
11. Search, notifications and AI assistance
12. Troubleshooting and internal support contacts

Before distributing the final manual, add screenshots from the accepted live workflows, the organisation's support contacts, approved onboarding/password procedures and the actual published course names. Keep technical deployment instructions in a separate administrator/IT runbook.
