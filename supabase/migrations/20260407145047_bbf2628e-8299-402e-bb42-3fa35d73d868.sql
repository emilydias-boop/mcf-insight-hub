-- Fix 5 contacts imported with CPF instead of name
UPDATE crm_contacts SET name = 'Hernani Costa' WHERE id = '2fae6260-4aba-450d-bb55-c0d41ed5e675';
UPDATE crm_deals SET name = 'Hernani Costa' WHERE id = '812d8878-f588-4cff-9a2d-f45956f7d79f';

UPDATE crm_contacts SET name = 'Marcia' WHERE id = '69dc79a9-c2c6-4331-9937-5e3de9cd5b6a';
UPDATE crm_deals SET name = 'Marcia' WHERE id = '6d338865-3232-4421-b5b9-6c2cd5336834';

UPDATE crm_contacts SET name = 'Flavia Rodrigues' WHERE id = '876a4dba-2cc9-4d92-bbe5-e4a6c3410758';
UPDATE crm_deals SET name = 'Flavia Rodrigues' WHERE id = 'f9dc50b3-2d68-4b26-864d-7bf60f1590c4';

UPDATE crm_contacts SET name = 'Lidyana Wanessa' WHERE id = '7ffbf974-ab1a-4fd0-8667-a479eb75a777';
UPDATE crm_deals SET name = 'Lidyana Wanessa' WHERE id = 'ba422f4b-70aa-489a-946d-5ec22d3e03c7';

UPDATE crm_contacts SET name = 'Ronaldo Forasteiro' WHERE id = 'ed6722fc-7b21-4628-aa45-dba22f2ca2e4';
UPDATE crm_deals SET name = 'Ronaldo Forasteiro' WHERE id = '91ccfc3b-a286-4239-983d-9cd16436e270';