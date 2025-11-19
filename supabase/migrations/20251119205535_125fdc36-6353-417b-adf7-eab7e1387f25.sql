-- Limpar stages duplicadas com nomes genéricos "Stage ..."
DELETE FROM crm_stages 
WHERE stage_name LIKE 'Stage %';