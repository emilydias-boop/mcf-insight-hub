-- Adicionar 'import_deals_csv' aos tipos permitidos de job
-- Incluindo os tipos existentes: 'contacts' e 'deals'
ALTER TABLE sync_jobs 
DROP CONSTRAINT IF EXISTS sync_jobs_job_type_check;

ALTER TABLE sync_jobs 
ADD CONSTRAINT sync_jobs_job_type_check 
CHECK (job_type IN (
  'contacts',
  'deals',
  'origins',
  'stages',
  'import_contacts_csv',
  'import_deals_csv'
));