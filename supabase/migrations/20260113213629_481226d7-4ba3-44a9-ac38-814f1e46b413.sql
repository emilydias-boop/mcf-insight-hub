-- Corrigir dados do Luiz Sergio: mover para o slot existente das 14:00 da Cristiane
UPDATE meeting_slot_attendees 
SET meeting_slot_id = 'ffb2466f-bb92-4287-845c-04aced0e31a7'
WHERE id = '2705547d-d9ac-4274-bb3b-2cc0fc126df2';

-- Deletar o slot órfão que foi criado erroneamente
DELETE FROM meeting_slots 
WHERE id = '6e096cb4-1b5d-48dc-bdc7-94038252ac65';