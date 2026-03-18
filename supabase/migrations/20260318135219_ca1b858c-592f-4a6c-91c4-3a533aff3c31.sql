UPDATE crm_deals SET tags = array_append(COALESCE(tags, '{}'), 'ANAMNESE')
WHERE id IN (
  'ea384e5a-fd2e-42cc-9ca3-01ebe02be56a',
  '60c5c59f-27d7-4412-bec5-860893598d59'
) AND NOT ('ANAMNESE' = ANY(COALESCE(tags, '{}')));