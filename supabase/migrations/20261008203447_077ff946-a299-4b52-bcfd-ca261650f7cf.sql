INSERT INTO public.user_roles (user_id, role)
VALUES ('62c08305-137a-4373-8881-9a10ffc7d4f6', 'gerente_relacionamento')
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles
SET squad = ARRAY['pos_venda'], updated_at = now()
WHERE id = '62c08305-137a-4373-8881-9a10ffc7d4f6';

UPDATE public.employees
SET squad = 'pos_venda'
WHERE id = '6fe0a813-bd72-48c5-b7da-bf58f90dff87';