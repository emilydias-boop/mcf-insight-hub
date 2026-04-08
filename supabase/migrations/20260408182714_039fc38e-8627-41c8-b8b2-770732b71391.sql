
-- Reverter Antony Elias para N1
UPDATE sdr SET nivel = 1 WHERE id = '11111111-0001-0001-0001-000000000005';

UPDATE employees 
SET nivel = 1, 
    cargo_catalogo_id = 'd035345f-8fe3-41b4-8bba-28d0596c5bed'
WHERE id = '7ce46aa0-7df3-41be-9249-23fc99b8a2aa';
