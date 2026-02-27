# PR Draft: FlowState v1 Reset (Legacy Surface Removal)

## Summary

This PR removes legacy quest/social/trip-planning codepaths and hardens the app to a FlowState-only execution model.

## Included changes

1. Mobile surface cleanup
   - Removed quest/social routes and components.
   - Kept only diagnostic -> hero play -> execution -> profile loop.
2. Edge Function cleanup
   - Removed legacy handlers and routes:
     - quest endpoints
     - social/friend endpoints
     - trip-context/plans/recommendation endpoints
     - badges endpoint
   - Kept FlowState + bootstrap/profile/health contracts.
3. Shared contracts cleanup
   - Pruned dead quest/social/trip types from `@passport-quest/shared`.
   - Kept only FlowState and required bootstrap/profile contracts.
4. Database cleanup migration
   - Added `202602270006_flowstate_legacy_cleanup.sql` to drop obsolete legacy RPCs/tables.
5. SQL test suite reset
   - Removed legacy recommendation/social SQL tests.
   - Expanded FlowState SQL test assertions.
6. Runtime runbook hardening
   - Added `npm run mobile:android:stable` startup script.
   - Added deterministic Metro/ADB troubleshooting docs.
7. QA checklist reset
   - Replaced old Bangalore MVP checklist with FlowState real-device checklist.

## Validation checklist

- [ ] `npm run mobile:typecheck`
- [ ] `npm run mobile:test`
- [ ] `npm run supabase:test`
- [ ] Manual Android dev-client startup via `npm run mobile:android:stable`
- [ ] Manual FlowState end-to-end QA using `docs/qa-checklist-bangalore.md`

## Risk notes

1. Migration removes legacy objects permanently for new environments.
2. Existing legacy clients (if any) calling removed endpoints will receive 404.
3. If historical reporting depends on legacy quest/social tables, archive before production rollout.
