## Problema
DELETE em `public.no_show_validations` retorna `permission denied` — falta `GRANT DELETE` para `authenticated` e/ou policy `FOR DELETE`.

## Solução
Aplicar migração adicionando GRANT + policy de DELETE restrita a admin (decisão do usuário).

### SQL
```sql
GRANT DELETE ON public.no_show_validations TO authenticated;

CREATE POLICY "Admins can delete no_show_validations"
ON public.no_show_validations
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
```

## Verificação pós-migração
1. Confirmar no painel `/crm/revisao-no-shows` (logado como admin) que o botão de excluir evidência funciona sem erro.
2. Conferir que usuário não-admin recebe bloqueio (RLS) ao tentar excluir.
