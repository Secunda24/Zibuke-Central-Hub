# File department management

Administrators can open **Files > Manage departments** to create folders or rename existing ones. Saved names appear in the upload dropdown, file-edit dropdown, file table and search results. Duplicate names are rejected without overwriting another folder.

This manages file folders, not employee department assignments. Folder IDs remain stable when names change, so existing files, download links and department access remain intact. General remains shared with everyone. Employees can use General and their own department; administrators and Executive users can access all file folders. Only the admin role can create or rename folders.

Production received `migrations/009_file_departments.sql` on 29 September 2026. It adds `file_departments` and seeds the previous six options plus existing file and employee department names. It does not update employee records or file metadata. The release preflight now requires this table. Fresh installations include it in `schema.sql`.

Validation: all 48 regression tests pass; TypeScript and focused lint pass (zero errors). The new regression covers anonymous and employee rejection, admin create/rename, duplicate/invalid names, missing folders, existing file downloads after rename, unrelated-department denial, unknown-folder upload rejection and repeatable migration behavior.

Deployed on 29 September 2026 as Worker `5095ac63-4591-49f1-a020-f648abf79a00`. The production Files bundle returned HTTP 200 and contains the management controls. Anonymous create and rename requests both returned HTTP 401. Authenticated interactions are covered by regression fixtures; a live admin browser journey was not performed.
