
-- Move deal to "Venda realizada" stage to trigger replication
UPDATE crm_deals 
SET stage_id = '3a2776e2-a536-4a2a-bb7b-a2f53c8941df',
    updated_at = now()
WHERE id = '39a6d3c2-cb62-4ba3-ba50-7063765493bc';
