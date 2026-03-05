-- Transfer pending meeting_slots from Yanca to Leticia Rodrigues
UPDATE meeting_slots 
SET booked_by = '6cb06155-26dd-4be9-87ce-53e60a59a4e7' 
WHERE booked_by = '04bb4045-701d-443c-b2c9-aee74e7f58d9' 
AND status IN ('scheduled', 'rescheduled');