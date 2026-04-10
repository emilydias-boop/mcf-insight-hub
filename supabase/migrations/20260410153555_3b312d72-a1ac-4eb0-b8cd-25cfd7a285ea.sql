UPDATE meeting_slot_attendees
SET r2_status_id = '24d9a326-378b-4191-a4b3-d0ec8b9d23eb'
WHERE carrinho_week_start IS NOT NULL
  AND r2_status_id = '1b805ad7-5cab-4797-bc2d-2afd60a95870';