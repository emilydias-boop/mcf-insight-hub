
# Fix: R2 Scheduling Incorrectly Blocked by R1 Meeting

## Problem

The `useCheckActiveMeeting` hook does not filter by `meeting_type`. When used in the R2 scheduling modal, it finds the completed R1 meeting and applies the 30-day cooldown, blocking R2 scheduling entirely.

For R2, the rules should be:
- Only check for active/completed **R2** meetings (not R1)
- A completed R1 is expected and should not block R2

## Solution

Add an optional `meetingType` parameter to the `useCheckActiveMeeting` hook, and pass `'r2'` from `R2QuickScheduleModal`.

### File: `src/hooks/useCheckActiveMeeting.ts`

- Add parameter: `meetingType?: 'r1' | 'r2'`
- When `meetingType` is provided, add `.eq('meeting_slot.meeting_type', meetingType)` to both queries (active meetings and cooldown check)
- Update query key to include `meetingType`

### File: `src/components/crm/R2QuickScheduleModal.tsx`

- Change call from `useCheckActiveMeeting(selectedDeal?.id)` to `useCheckActiveMeeting(selectedDeal?.id, 'r2')`

### File: `src/components/crm/QuickScheduleModal.tsx`

- Optionally pass `'r1'` for explicit clarity (current behavior already works since R1 is the main flow, but being explicit is safer)
