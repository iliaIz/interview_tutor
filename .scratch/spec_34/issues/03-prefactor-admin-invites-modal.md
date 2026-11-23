# Issue 03: [Prefactor] Admin Invites Headless Hook & CSV Exporter

**Archetype:** Prefactor
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

## What to Build
Refactor `frontend/src/components/auth/AdminInvitesModal.tsx` (358 lines):
1. Extract `frontend/src/components/auth/invites/adminInvitesUtils.ts` (< 60 lines):
   - Pure RFC 4180 CSV serializer with UTF-8 BOM and browser download trigger.
2. Extract `frontend/src/components/auth/invites/useAdminInvitesManager.ts` (< 120 lines):
   - Network fetch for `/api/auth/invites`
   - Invite code creation and revocation
   - Clipboard copy with 2000ms timer
3. Reduce `AdminInvitesModal.tsx` to $\le 160$ lines of pure presentation.

## Pre-Agreed Verification Seam & Command
- **Testing Seam**: `useAdminInvitesManager.ts` & `AdminInvitesModal.tsx`.
- **Dependencies**: Browser clipboard & Blob download.
- **Verification Command**: `remote-verify`

## Acceptance Criteria
- [ ] `AdminInvitesModal.tsx` shrinks from 358 to $\le 160$ lines.
- [ ] All new files comply with Rule 8 ($\le 350$ lines).
- [ ] Remote verification builds 100% green.
