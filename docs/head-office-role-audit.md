# Head-office role audit — 28 September 2026

Source: Zibuke Central Canidates Setup Guidelines 25062026.xlsx, Sheet1, B3:G15. Compared with the live users table (135 accounts). Workbook specifications are requirements to review; they do not themselves approve changes to existing access.

## Named leadership and developers

| Person | Current job title | Current access | Finding |
|---|---|---|---|
| Angel Jacobs | Software Developer | admin | Matches supplied title and workbook broad-access requirement |
| Arehone Mbadaliga | Software Developer | admin | Title/access match; user supplied surname Mbadalige, live record and email spell Mbadaliga; spelling needs confirmation |
| Nthabiseng Ramalepe | Software Developer | admin | Matches |
| Anja Geldenhuys | Head of People & Systems | admin | Matches; registered login is anjageldenhuys@zibukeafrica.co.za |
| Nyeka Mawabo | Founder | admin | Matches |

Admin access is broad within administrative modules but is not unrestricted access to other people's private conversations or every department file. The workbook phrase 'Access to everything' is therefore not literally implemented across all data.

## Remaining account groups

| Current position | Accounts | Current division | Role at audit | Workbook comparison |
|---|---:|---|---|---|
| People & Systems Intern | 4 | Zibuke OnCall | employee | Workbook proposes Office and scoped HR/update/removal/blacklisting/announcements/report rights; not fully implemented |
| Community Relations Manager | 14 | Zibuke OnCall | employee | Workbook proposes Office; basic employee access fits, reporting requirements need assignment |
| Content Creator | 2 | Zibuke OnCall | employee | Workbook proposes Office and announcement authoring; employee authoring permission missing |
| Signaling Manager | 13 | Zibuke OnCall | employee | Workbook proposes Africa Sales and reports for assigned executives; team-scoped report access missing |
| Signaling Accounts Executive | 71 | Zibuke OnCall | employee | Workbook proposes Africa Sales; basic employee access fits |
| Business Developer | 15 | Zibuke OnCall | employee | Workbook proposes Africa Sales; basic employee access fits |
| Sales Manager | 8 | Zibuke OnCall | employee | Division matches; team-scoped progress reporting missing |
| Employee | 2 | Zibuke Africa Office | employee | Ithandile and Jay Test: approved position not established by this workbook |
| Unspecified | 1 | Zibuke Africa Sales | admin | Sebelo: missing title and administrator access require review |

All 127 OnCall accounts are currently employees, consistent with the earlier no-admin instruction. The 119 proposed division changes above have not been applied. The guideline is a position matrix, not a complete named employee roster, so it cannot establish every individual's correct position.

## Important implementation gaps

- Permissions are predominantly admin/employee. Scoped HR, content-publisher and manager/team-report capabilities need a separate implementation; granting full admin is not an equivalent replacement.
- The Admin form currently derives the access role from the selected title. This can grant broader rights than the workbook specifies, for example Sales Representative in OnCall and Community Relations Manager in Office. Review this before using those title selections for account changes.
- 'Administrator' as a job title is not the same as the technical admin role; the workbook asks for limited summary-report access for that position.
- Candidate blacklisting is not a confirmed dedicated workflow. Deleting an account is not equivalent to blacklisting it.
- Tracking reports currently accept evidence links and notes; the workbook requests PDF/video or other submissions. A direct tracking-evidence upload is still a gap.
- Sales Manager row references assigned Signaling Account Executives for reports but Sales Representatives for its target; head office needs to resolve this discrepancy.

## Changes completed in this task

- Removed four literal null surname suffixes/placeholders in production; missing genuine surnames were not invented.
- Prepared directory UI removal of identity badges and per-person edit/delete tools. Identity verification and employee management remain in Admin.
- Sebelo was changed from admin to employee after explicit user approval. No other access or division changes were applied. Anja retains her zibukeafrica.co.za login address.
