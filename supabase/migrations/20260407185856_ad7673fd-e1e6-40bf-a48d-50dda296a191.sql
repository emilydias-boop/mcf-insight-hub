
-- Limpar dependências dos 3 deals CSV duplicados
DELETE FROM deal_activities WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132');
DELETE FROM deal_tasks WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132');
DELETE FROM automation_queue WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132');
DELETE FROM automation_logs WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132');
DELETE FROM calls WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132');

-- Meeting slots e filhos
DELETE FROM attendee_notes WHERE attendee_id IN (SELECT msa.id FROM meeting_slot_attendees msa JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id WHERE ms.deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132'));
DELETE FROM attendee_movement_logs WHERE attendee_id IN (SELECT msa.id FROM meeting_slot_attendees msa JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id WHERE ms.deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132'));
DELETE FROM meeting_slot_attendees WHERE meeting_slot_id IN (SELECT id FROM meeting_slots WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132'));
DELETE FROM meeting_slots WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132');

-- Consórcio pending registrations
DELETE FROM consortium_documents WHERE pending_registration_id IN (SELECT id FROM consorcio_pending_registrations WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132'));
DELETE FROM consorcio_pending_registrations WHERE deal_id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132');

-- Deletar os 3 deals duplicados
DELETE FROM crm_deals WHERE id IN ('263113b4-1316-413f-a2bf-ff0a8bf97b70','79663c2b-3810-4b32-98e0-2e42590f77ad','5dcce67b-e1d1-4e91-a58c-a0548e434132');
