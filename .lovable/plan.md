

## Problema

A view `user_performance_summary` (que alimenta a listagem de usuários) determina o status usando `COALESCE(ued.is_active, true)` da tabela `user_employment_data` -- que é um dado de RH legado. Ela **ignora completamente** o campo `profiles.access_status`, que é onde o sistema realmente grava "desativado" quando um admin desativa o usuário.

Resultado: Yanca tem `profiles.access_status = 'desativado'`, mas a view retorna `is_active = true` porque o `user_employment_data` dela não foi atualizado (ou nem existe, e o `COALESCE` força `true`).

## Solução

Recriar a view `user_performance_summary` incluindo `profiles.access_status` e derivando `is_active` a partir dele:

```sql
DROP VIEW IF EXISTS user_performance_summary;

CREATE VIEW user_performance_summary AS
SELECT 
  p.id AS user_id,
  p.email,
  p.full_name,
  ur.role,
  ued."position",
  ued.department,
  ued.hire_date,
  CASE 
    WHEN p.access_status = 'desativado' THEN false
    WHEN p.access_status = 'bloqueado' THEN false
    ELSE COALESCE(ued.is_active, true)
  END AS is_active,
  COALESCE(ued.status, 'ativo'::user_status) AS status,
  ued.fixed_salary,
  ued.ote,
  ued.commission_rate
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN user_employment_data ued ON ued.user_id = p.id;
```

Mudança: `is_active` agora respeita `profiles.access_status`. Se o perfil está desativado ou bloqueado, `is_active = false` independente do dado de employment.

Uma única migration SQL. Nenhuma alteração no frontend necessária.

