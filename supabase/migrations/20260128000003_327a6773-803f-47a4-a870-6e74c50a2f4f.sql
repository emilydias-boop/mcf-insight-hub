-- Alterar FK de webhook_endpoints.stage_id para referenciar local_pipeline_stages
ALTER TABLE webhook_endpoints 
DROP CONSTRAINT IF EXISTS webhook_endpoints_stage_id_fkey;

ALTER TABLE webhook_endpoints 
ADD CONSTRAINT webhook_endpoints_stage_id_fkey 
FOREIGN KEY (stage_id) REFERENCES local_pipeline_stages(id) ON DELETE SET NULL;