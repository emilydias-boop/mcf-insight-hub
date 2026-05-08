UPDATE public.employees e
SET user_id = s.user_id,
    email_pessoal = COALESCE(e.email_pessoal, s.email)
FROM public.sdr s
WHERE e.sdr_id = s.id
  AND e.id IN ('658d8372-a2dd-4acc-82e3-89a221bc3e94','7a790a55-9a42-47ba-8ef9-95aade74d4a9')
  AND s.user_id IS NOT NULL;