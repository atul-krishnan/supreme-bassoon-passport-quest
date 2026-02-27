# UAT Evidence Records

Create one evidence file per staging candidate:

```bash
npm run ops:uat:evidence -- --release-sha=<commit_sha> --build-id=<build_identifier> --author="<name>"
```

Output location:

- `/Users/atulkrishnan/Documents/Passport Quest/docs/uat-evidence/<YYYY-MM-DD>-<release>.md`

Minimum required attachments in each record:

1. Checklist pass/fail notes from `/Users/atulkrishnan/Documents/Passport Quest/docs/qa-checklist-bangalore.md`.
2. Screenshots for diagnostic completion, hero play, active execution, and profile achievement loop.
3. KPI snapshot for hero/start/step p95, duplicate reward count, and crash-free rate.
4. Final go/no-go decision and reason.
