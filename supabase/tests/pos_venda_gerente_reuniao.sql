-- Read-only regression checks against the deployed rule and requested real cases.
BEGIN READ ONLY;
DO $$
DECLARE source text;
BEGIN
  SELECT prosrc INTO source FROM pg_proc WHERE oid = 'public.pos_venda_reuniao_define_dono()'::regprocedure;
  ASSERT position('pos_venda_distribuicao' in source) = 0, 'Previous-owner distribution must not prevent transfer';
  ASSERT position('NEW.status = ''cancelada''' in source) > 0, 'Cancelled meetings must not transfer ownership';
  ASSERT EXISTS (SELECT 1 FROM public.crm_deals WHERE id = '3edbe4cb-75a2-48f1-97ff-7efae9c803d5' AND owner_profile_id = '4b3d5fb6-1e86-4b21-912d-8824dbd59033'), 'Thobson must belong to Rebeca';
  ASSERT EXISTS (SELECT 1 FROM public.crm_deals WHERE id = '0e73977b-f3c3-4403-82cf-e1f6b0ae1e66' AND owner_profile_id = 'e7b093fe-4407-4f98-b9dc-e9e85e373a48'), 'Vinicius must belong to William';
END $$;
ROLLBACK;