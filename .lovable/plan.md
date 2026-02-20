
# Fix: Outside Detection Logic for Kanban Deals

## Problem

The current `useOutsideDetectionForDeals` hook uses a flawed comparison: it checks if `contractDate < dealCreatedAt`. This misses cases like "Anderson Dalla Vecchia" where:
- Deal created: Nov 24, 2025
- Contract paid: Feb 20, 2026
- No R1 meeting exists

Since the contract was paid AFTER the deal was created, the current logic says "not Outside". But this lead IS Outside because they paid the contract without going through an R1 meeting.

## Root Cause

The Agenda's `useOutsideDetectionBatch` compares `contractDate < meetingDate`, which is correct. But the deals hook was incorrectly adapted to compare against `dealCreatedAt` instead of checking for R1 meetings.

## Solution

Update `useOutsideDetectionForDeals` to check R1 meetings from `meeting_slot_attendees` + `meeting_slots`:

1. Fetch contract transactions for deal contact emails (existing logic)
2. NEW: Also fetch R1 meetings for those contacts via `meeting_slot_attendees` joined with `meeting_slots` where `meeting_type = 'r1'`
3. A deal is "Outside" if:
   - The contact has a completed contract transaction, AND
   - Either there's NO R1 meeting for that contact, OR the contract was paid BEFORE the earliest R1 meeting

## Technical Changes

### File: `src/hooks/useOutsideDetectionForDeals.ts`

Update the hook's queryFn to:

1. Keep existing contract transaction fetch (batched by email)
2. Add a second batched query: fetch `meeting_slot_attendees` joined with `meeting_slots` to get R1 meetings for the same contact IDs
3. Change comparison logic:
   - Build a map of `email -> earliest R1 scheduled_at`
   - For each deal: if has contract AND (no R1 meeting OR contractDate <= r1Date), mark as Outside

The `DealForOutsideCheck` interface needs to also include `contact_id` for querying attendees by contact.

```text
Current flow:
  contract exists + contractDate < dealCreatedAt  -->  Outside

New flow:
  contract exists + (no R1 meeting OR contractDate <= r1ScheduledAt)  -->  Outside
```

### Data flow

1. Extract unique emails from deals (existing)
2. Extract unique contact_ids from deals (new)
3. Batch query `hubla_transactions` for contracts (existing)
4. Batch query `meeting_slot_attendees` + `meeting_slots` for R1 meetings by contact_id (new)
5. Build email-to-earliest-R1 map (new)
6. Compare: Outside = has contract AND (no R1 OR contract before R1)

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useOutsideDetectionForDeals.ts` | Fix Outside detection to check R1 meetings instead of deal created_at |

No other files need changes -- the hook interface and return type remain the same (`Map<dealId, boolean>`).
