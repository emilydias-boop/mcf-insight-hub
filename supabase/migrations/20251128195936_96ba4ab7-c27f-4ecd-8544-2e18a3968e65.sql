-- Adicionar 'hubla_import' aos tipos de job permitidos na tabela sync_jobs
ALTER TABLE sync_jobs DROP CONSTRAINT IF EXISTS sync_jobs_job_type_check;

ALTER TABLE sync_jobs ADD CONSTRAINT sync_jobs_job_type_check 
CHECK (job_type = ANY (ARRAY[
  'contacts'::text, 
  'deals'::text, 
  'origins'::text, 
  'stages'::text, 
  'import_contacts_csv'::text, 
  'import_deals_csv'::text,
  'hubla_import'::text
]));