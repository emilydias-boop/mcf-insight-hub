
-- Fix Ulysses deals: link contact_id and set origin_id
UPDATE public.crm_deals 
SET contact_id = '643aee5c-a284-4907-85b6-d38b1be9cae7', updated_at = NOW() 
WHERE id = '378d55f3-4834-4b6b-b5d7-26ff9428b77a';

UPDATE public.crm_deals 
SET contact_id = '643aee5c-a284-4907-85b6-d38b1be9cae7', 
    origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', 
    updated_at = NOW() 
WHERE id = 'b65a15ba-5e20-40c4-9513-64c17e21b925';
