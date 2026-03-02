UPDATE sync_jobs
SET 
  status = 'failed',
  error_message = 'Cancelado manualmente — job travado sem processamento desde 13/02/2026',
  updated_at = NOW()
WHERE id IN (
  '62190420-1df1-4ddd-9ac9-e0caa688fd1e',
  '4cb1c4b7-9fa3-4cf8-a28e-7da7e82a93af',
  '8aaaf71c-7074-46e8-9a23-584695712907'
);