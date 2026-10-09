# Employee documents and first-login email verification

The `EMPLOYEE_DOCUMENTS_BUCKET` binding points to the private `zibuke-employee-documents` R2 bucket. Do not enable a public development URL or attach a public custom domain. Downloads go through the authenticated `/api/employee-documents/[id]` route and are restricted to the document owner or an administrator.

Apply `migrations/006_documents_and_login_otp.sql` before deploying. Uploading an ID does not verify it. Administrators can verify an uploaded ID or record an in-person check. Uploading a new ID clears verification. Supporting documents do not change ID verification. Upload and verification events are recorded in `employee_document_audit`.

## Enable email OTP

OTP enforcement is controlled by `FIRST_LOGIN_OTP_ENABLED`. Enable it only after a production email sender is configured. No email API credentials are committed to the repository.

1. Verify your sending domain in Resend and create an API key with sending permission.
2. From `apps/angel-core`, store it securely using `npx.cmd wrangler secret put RESEND_API_KEY`.
3. Set `OTP_EMAIL_FROM` in `wrangler.json` variables to the verified sender, for example `Zibuke Central <noreply@your-verified-domain>`.
4. Set `FIRST_LOGIN_OTP_ENABLED` to the string `true`, build, and deploy.
5. Test with a controlled, unverified account whose email inbox you can access. Sign in with its password, enter the emailed code, and confirm that a subsequent password login no longer requests a code.

Unverified accounts must enter a eight-digit code before receiving a session cookie. The code expires after ten minutes, allows five attempts, cannot be reused, and is bound to the password-authenticated browser challenge and account email. Resends are limited to one per minute and five per hour. Only a successful OTP sets `email_verified_at`. Existing accounts without an email verification timestamp will also be asked to verify their email on their next sign-in after activation; older login code did not reliably track first sign-ins. Enabling enforcement without a working sender returns an error rather than bypassing verification.

Run `node --test tests/document-auth.test.cjs` with Node.js 24 to check document permissions, verification resets, file type validation, OTP expiry, attempt limits and replay protection. Tests use an in-memory database and a fake email sender; they send no email.
