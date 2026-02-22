# UAT Evidence Records

Create one evidence file per staging candidate:

```bash
npm run ops:uat:evidence -- --release-sha=<commit_sha> --build-id=<build_identifier> --author="<name>"
```

Output location:

- `/Users/atulkrishnan/Documents/Passport Quest/docs/uat-evidence/<YYYY-MM-DD>-<release>.md`

Minimum required attachments in each record:

1. Checklist pass/fail notes from `/Users/atulkrishnan/Documents/Passport Quest/docs/qa-checklist-bangalore.md`.
2. Screenshots for onboarding, completion, offline replay, and social flow.
3. KPI snapshot for completion p95, nearby p95, offline sync SLA, duplicate count, and crash-free rate.
4. Final go/no-go decision and reason.
