-- Fix Ulysses deal: stage_id belongs to wrong origin (PIPE LINE - INSIDE SALES instead of PIPELINE INSIDE SALES)
-- Moving stage_id from 2eccaa59 (origin 57013597) to 155f9eab (origin e3c04f21) which is the same stage name in the correct origin
UPDATE crm_deals 
SET stage_id = '155f9eab-0c1d-4215-b2e8-25fb546ba456', 
    updated_at = NOW() 
WHERE id = 'b65a15ba-5e20-40c4-9513-64c17e21b925';