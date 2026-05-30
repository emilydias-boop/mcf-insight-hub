
-- Fix Vinicius email mismatch: CRM tinha '.com.br' (typo) enquanto Hubla usa '.com'.
-- O contato '.com' está vazio (0 deals/attendees), então deletamos e renomeamos.
DELETE FROM crm_contacts WHERE id = '295adcfa-0539-413b-933c-299eb2842da8';
UPDATE crm_contacts SET email = 'viniciusbarbosapaiva@gmail.com' WHERE id = '099e0b33-1a5c-46e4-94d7-a2784e74dbd0';
