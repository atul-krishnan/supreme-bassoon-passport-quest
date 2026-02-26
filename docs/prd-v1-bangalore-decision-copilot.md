# PRD: v1 Bangalore Decision Copilot

Last updated: February 25, 2026  
Status: Draft v1  
Owner: Product + Engineering

## 1. Product statement

Passport Quest v1 is a Bangalore-first freemium mobile app that helps users decide what to do in under 5 minutes, with light personalization and curated ready-to-go plans.

Positioning:

- Not a pure game.
- Not a generic listings app.
- A real-world exploration and planning assistant with light game mechanics for retention.

## 2. Problem

Urban users often want to go out but stall at the decision step:

- too many options
- low trust in what is worth doing
- planning fatigue for couples and small groups

The current alternatives are strong at search and listings, but weak at fast, context-aware, low-effort plan assembly for a specific outing.

## 3. Target users and JTBD

Primary persona:

- Bangalore couples and small friend groups (age 22-35) planning evening or weekend outings.

Secondary persona:

- Individual explorers looking for low-friction local discovery.

Core JTBD:

- "When I am free and undecided, help me pick and start a good plan quickly without heavy research."

## 4. Goals and non-goals

Goals for v1:

1. Reduce decision time from "open app" to "start plan."
2. Increase recurring weekly usage through relevant recommendations and progression.
3. Prove Bangalore retention and engagement before city expansion.

Non-goals for v1:

1. Full social network product.
2. UGC-heavy review marketplace.
3. Ticketing and payments.
4. Operating own offline events.
5. Delhi/Pune production rollout.

## 5. v1 scope

### 5.1 Must-have (v1 launch)

1. Light-touch onboarding profile:
- interests
- vibe preferences
- budget comfort

2. Session-level context capture:
- who with (`solo`, `couple`, `family`, `friends`)
- time budget
- pace
- optional constraints

3. Curated recommendation feed for Bangalore:
- top picks with short story snippet
- practical details (time, distance, expected spend band)
- "why this is recommended" explanation

4. Ready-made plan cards:
- single stop or short 2-3 stop flow
- one-tap "start plan"

5. Feedback loop:
- quick feedback (opened, started, completed, dismissed)

6. Retention loop:
- XP/level/badges for completed activities
- offline-safe completion flow

7. Sharing:
- native share of plan/experience to Instagram/WhatsApp deep links.

### 5.2 Should-have (if timeline permits)

1. Mid-trip context adjustment.
2. "Fallback option" if user rejects first suggestion.
3. Simple "plan for tonight/weekend" quick entry shortcuts.

### 5.3 Out of scope (v1)

1. Verified public reviews and vote systems.
2. Group invite/scheduling workflows beyond basic share.
3. Redemption wallet and points ledger UI.
4. Partner event operations run by Passport Quest.

## 6. User flows

### Flow A: First-time user

1. Guest bootstrap and username.
2. Light preferences onboarding.
3. Prompt: "Plan this outing."
4. Show curated recommendations with reasons.
5. User starts one plan.
6. Completion updates XP/badge and feed.

### Flow B: Returning weekend user

1. Open app.
2. One-tap context preset ("Couple, 3 hours, medium budget").
3. Top recommendations appear.
4. User starts and shares plan.
5. Completion recorded with progression.

## 7. Experience principles

1. Decide fast: first useful recommendation in under 10 seconds on normal network.
2. Explain trust: every recommendation must include a short reason.
3. Keep questions minimal: ask only what materially improves ranking.
4. Reward action, not browsing: progression tied to completed experiences.

## 8. Success metrics

North Star (v1):

- Weekly plan starts per weekly active user (WPS/WAU).

Primary product metrics:

1. Recommendation funnel:
- impression -> opened -> started -> completed
2. Time to first plan start (TTFPS):
- target median under 5 minutes from first app open
3. D2 retention uplift:
- target at least +10% treatment vs control
4. First-session depth:
- target increase in 3-quest completion loop
5. Social conversion:
- request sent -> accepted -> feed visibility baseline achieved

Reliability guardrail metrics:

1. completion API p95 < 2s
2. nearby API p95 < 800ms
3. offline sync success >= 99% within 10 minutes
4. duplicate accepted completions = 0
5. crash-free sessions >= 99.5%

## 9. Business model (v1 to v1.2 path)

v1 pilot:

- Freemium, no aggressive paywall.
- Focus on proving repeat behavior and recommendation quality.

Post-PMF monetization order:

1. Partner-led sponsored placements with strict relevance controls.
2. Affiliate or booking commissions for experiences.
3. Premium planning tier for power users only after retention is stable.

Business model principles:

1. User trust first, paid content clearly marked.
2. Never degrade recommendation quality for sponsorships.
3. Monetization gates follow retention proof, not precede it.

## 10. Positioning and GTM for v1

Category:

- "Personalized local outing planner."

Core message:

- "Stop scrolling. Get a weekend/date plan in minutes."

Launch channels:

1. Bangalore micro-creator collaborations.
2. Instagram-first short content with real plan examples.
3. Referral loops via shareable plan cards.
4. Closed cohort onboarding from communities (startups, colleges, running/cycling circles).

What we do not market as:

- not "a new social network"
- not "a full events marketplace"
- not "a hardcore location game"

## 11. Technical feasibility and architecture fit

Already available in current stack:

1. guest bootstrap and profile foundation
2. city-aware quest retrieval
3. trusted completion and anti-cheat
4. offline queue and replay
5. social request/accept/feed baseline
6. telemetry and gate automation

Needed additions for this PRD:

1. trip context APIs and schema (`v1.1` track)
2. recommendation endpoint with explainability fields
3. richer quest metadata tags for suitability filtering
4. share instrumentation and attribution events

Constraint:

- Keep API and schema additive only during MVP window.

## 12. Milestones

M0 (current baseline):

- Existing MVP v1 stable in Bangalore pilot.

M1:

- Trip context capture + recommended quest API + feedback capture.

M2:

- Curated plan bundles + share flow + reason strings tuning.

M3:

- Two-week Bangalore gate evaluation and go/hold decision.

## 13. Risks and mitigations

Risk 1: Product sprawl.

- Mitigation: enforce one core JTBD and strict out-of-scope list.

Risk 2: Weak recommendation quality.

- Mitigation: human-curated seed sets and explicit feedback loops before ML complexity.

Risk 3: Low social conversion.

- Mitigation: simplify friend flow and keep share-first fallback.

Risk 4: Reliability regressions during feature additions.

- Mitigation: keep hard release gates on latency, sync SLA, duplicates.

## 14. Launch decision criteria (Bangalore)

Proceed to Delhi preparation only if both are true:

1. Product gates:
- D2 uplift target met
- recommendation funnel trend positive
- first-session depth improved
2. Reliability gates:
- all guardrail metrics stay within thresholds for 2 consecutive weeks.

## 15. Open questions

1. Should v1 primary entry be "Plan my weekend" or "Find nearby now"?
2. What minimum metadata quality bar is required before a place enters recommendations?
3. Do we prioritize couple date templates or friend-group templates in first curation wave?
4. Which single metric should block all scope creep during pilot (recommended: WPS/WAU)?
