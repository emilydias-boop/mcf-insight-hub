UPDATE public.crm_stages
SET stage_name = 'ANAMNESE COMPLETA', updated_at = now()
WHERE id = 'e6fab26d-f16d-4b00-900f-ca915cbfe9d9'
  AND stage_name = 'ANAMNESE INCOMPLETA';