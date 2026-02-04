-- Vincular employees.user_id aos usuários autenticados via email
-- Isso corrige o problema de RLS que impede funcionários de ver seus próprios dados

UPDATE public.employees e
SET user_id = u.id
FROM auth.users u
WHERE e.user_id IS NULL
  AND e.email_pessoal IS NOT NULL
  AND LOWER(e.email_pessoal) = LOWER(u.email);