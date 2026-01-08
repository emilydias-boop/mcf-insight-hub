-- Inserir o contato principal de cada reunião como attendee (se ainda não existir)
-- Isso garante que todos os participantes estejam na mesma tabela
INSERT INTO meeting_slot_attendees (meeting_slot_id, contact_id, status, booked_by, notes, closer_notes)
SELECT 
  ms.id,
  ms.contact_id,
  ms.status,
  ms.booked_by,
  ms.notes,
  ms.closer_notes
FROM meeting_slots ms
WHERE ms.contact_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM meeting_slot_attendees msa 
  WHERE msa.meeting_slot_id = ms.id 
  AND msa.contact_id = ms.contact_id
);