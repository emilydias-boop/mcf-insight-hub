-- 1. Reverter deal original para "Lead Gratuito" (stage correto)
UPDATE crm_deals 
SET stage_id = 'd346320a-00b0-4e9f-89b6-149ad1c34061'
WHERE id = '39a6d3c2-cb62-4ba3-ba50-7063765493bc';

-- 2. Deletar atividades do deal replicado
DELETE FROM deal_activities 
WHERE deal_id = 'dec79ae4-4063-4803-bb70-2efa7e8aa5f7';

-- 3. Deletar logs de replicação
DELETE FROM deal_replication_logs 
WHERE target_deal_id = 'dec79ae4-4063-4803-bb70-2efa7e8aa5f7';

-- 4. Deletar deal replicado do pipeline Consórcio
DELETE FROM crm_deals 
WHERE id = 'dec79ae4-4063-4803-bb70-2efa7e8aa5f7';

-- 5. Limpar fila processada
DELETE FROM deal_replication_queue 
WHERE deal_id = '39a6d3c2-cb62-4ba3-ba50-7063765493bc';