# Bangalore MVP v1 QA Checklist

## Environment

- Supabase local or staging project is reachable.
- Edge Function `v1` is deployed/served.
- Mobile app has correct `apiBaseUrl`, `supabaseUrl`, and `supabaseAnonKey`.
- Device location permissions granted.

## Core flow (must pass)

1. Launch app and confirm guest session bootstraps.
2. If first session, onboarding username screen appears and accepts valid username.
3. Land on Map tab and load nearby quests for BLR test location.
4. Open quest detail and claim reward online.
5. Complete 3 quests and confirm first badge unlock.

## Offline reliability

1. Turn off network and claim quest from detail screen.
2. Confirm offline save message appears.
3. Re-enable network and wait for auto sync.
4. Confirm pending count returns to 0.
5. Confirm duplicate reward does not occur after retries.

## Social loop

1. Send friend request by username.
2. Receiver sees request in incoming list.
3. Receiver accepts request.
4. Feed shows friend-connected activity.
5. Profile compare renders me/friend deltas.

## Profile and settings

1. Edit username and avatar URL.
2. Confirm profile summary updates after save.
3. Verify badge case locked/unlocked visuals.
4. Verify app has no NYC city selection surface.
5. Verify profile runtime info shows Bangalore as active pilot city.

## QA mode (non-production builds)

1. Open Profile and confirm QA Mode card is visible.
2. Confirm runtime metadata shows env, release SHA, user id, and city.
3. Trigger `Force Sync` and confirm queue status updates.
4. Trigger `Clear Queue` and confirm pending count becomes 0.
5. Toggle test location on/off and confirm status changes.
6. Trigger `Reset Session` and confirm app re-bootstrap succeeds.

## Notifications and experiments

1. Confirm push token registration endpoint is called (where permissions allow).
2. Confirm bootstrap payload includes `experiments` and `notificationPolicy`.
3. Confirm quiet-hour status appears in profile runtime hints.
4. Restart app and verify experiment variant stays stable.

## Security/RLS sanity

1. Validate unauthorized API call fails with 401.
2. Validate cross-user profile/badge direct reads are blocked by RLS.
