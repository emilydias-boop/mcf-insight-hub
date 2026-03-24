-- Delete duplicate backfill deals for Victor Romão
DELETE FROM deal_activities WHERE deal_id IN ('fca41234-7793-4613-bf1b-2a744946c311', '853c566b-50b3-45b1-a881-49e21f77137c');
DELETE FROM crm_deals WHERE id IN ('fca41234-7793-4613-bf1b-2a744946c311', '853c566b-50b3-45b1-a881-49e21f77137c');

-- Delete orphan contacts created by backfill for Victor Romão
DELETE FROM crm_contacts WHERE id IN ('36ba5171-eea0-4447-97f9-3c79c04cf4f1', 'f5c45d8e-533b-4b99-bed3-22d94abc1ba3');

-- Also delete Robert Douglas duplicate deal (same person, different email)
DELETE FROM deal_activities WHERE deal_id = '9d12d2a6-0031-41b2-834d-e17e73e09630';
DELETE FROM crm_deals WHERE id = '9d12d2a6-0031-41b2-834d-e17e73e09630';