UPDATE meeting_slot_attendees 
SET status = 'completed', 
    contract_paid_at = NULL, 
    updated_at = NOW() 
WHERE id = '075c97ae-49b8-42b7-991a-fff96bdbf4e1';