import fs from "node:fs";
import path from "node:path";

function getArg(name) {
  const withEquals = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (withEquals) {
    return withEquals.slice(name.length + 3).trim();
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) {
    return (process.argv[index + 1] ?? "").trim();
  }

  return "";
}

const releaseShaInput = getArg("release-sha") || process.env.RELEASE_SHA || "unknown";
const buildId = getArg("build-id") || process.env.BUILD_ID || "n/a";
const author = getArg("author") || process.env.USER || "team";
const cityId = getArg("city-id") || "blr";
const now = new Date();
const date = now.toISOString().slice(0, 10);
const safeSha = releaseShaInput === "unknown" ? "unknown" : releaseShaInput.slice(0, 8);

const evidenceDir = path.resolve("docs", "uat-evidence");
const fileName = `${date}-${safeSha}.md`;
const filePath = path.join(evidenceDir, fileName);

fs.mkdirSync(evidenceDir, { recursive: true });

if (!fs.existsSync(filePath)) {
  const content = `# UAT Evidence - ${date}

## Candidate

- Release SHA: \`${releaseShaInput}\`
- Build ID: \`${buildId}\`
- City: \`${cityId}\`
- Tester: \`${author}\`
- Started at: \`${now.toISOString()}\`

## Checklist Reference

- QA checklist: \`/Users/atulkrishnan/Documents/Passport Quest/docs/qa-checklist-bangalore.md\`

## Results

### Core flow

- [ ] Pass
- Notes:

### Offline reliability

- [ ] Pass
- Notes:

### Social loop

- [ ] Pass
- Notes:

### Profile and settings

- [ ] Pass
- Notes:

### QA mode (non-production builds)

- [ ] Pass
- Notes:

### Notifications and experiments

- [ ] Pass
- Notes:

### Security/RLS sanity

- [ ] Pass
- Notes:

## KPI snapshot

- Completion p95 (ms):
- Nearby warm p95 (ms):
- Offline sync success (%):
- Duplicate accepted rewards:
- Crash-free sessions (%):

## Evidence assets

- Onboarding screenshot:
- Quest completion screenshot:
- Offline replay screenshot:
- Social flow screenshot:

## Final decision

- [ ] Go
- [ ] No-go
- Reason:
`;

  fs.writeFileSync(filePath, content, "utf8");
  console.log(`[ops:uat:evidence] Created ${filePath}`);
} else {
  console.log(`[ops:uat:evidence] Existing file found: ${filePath}`);
}
