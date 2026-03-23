

## Plano: Corrigir exclusão de usuários

### Problema

A Edge Function `delete-user` falha porque existem tabelas com foreign keys para `auth.users` e `profiles` configuradas como **NO ACTION** (bloqueiam a exclusão). As principais tabelas que bloqueiam são:

| Tabela | Coluna | Tipo de restrição |
|--------|--------|-------------------|
| `employees` | `profile_id`, `user_id` | NO ACTION (bloqueia) |
| `calls` | `user_id` | NO ACTION (bloqueia) |
| `playbook_docs` | `criado_por` | NO ACTION/SET NULL |

A Edge Function só limpa 7 tabelas, mas existem 50+ referências a `auth.users`.

### Correção

| Componente | O que muda |
|-----------|-----------|
| `supabase/functions/delete-user/index.ts` | Adicionar limpeza das tabelas que bloqueiam: `employees` (SET NULL no profile_id/user_id), `dashboard_preferences`, `sdr`, `playbook_reads`, `sdr_review_requests`, `calls` (SET NULL), `user_files` |
| Migration SQL | Alterar foreign keys problemáticas de NO ACTION para SET NULL ou CASCADE, para que futuras exclusões não bloqueiem |

### Detalhes da Edge Function

Antes de deletar o profile, adicionar:

```typescript
// Desvincular employee (não deletar, apenas remover vínculo)
await supabaseAdmin.from("employees").update({ profile_id: null, user_id: null }).eq("profile_id", user_id);

// Limpar tabelas adicionais com user_id
const additionalTables = [
  "dashboard_preferences",
  "sdr",
  "playbook_reads", 
  "sdr_review_requests",
  "user_files",
  "alertas",
];
for (const table of additionalTables) {
  await supabaseAdmin.from(table).delete().eq("user_id", user_id);
}

// SET NULL em tabelas que referenciam por created_by/booked_by
const nullifyTables = [
  { table: "calls", column: "user_id" },
  { table: "deal_activities", column: "user_id" },
  { table: "meeting_slots", column: "booked_by" },
];
for (const { table, column } of nullifyTables) {
  await supabaseAdmin.from(table).update({ [column]: null }).eq(column, user_id);
}
```

### Migration SQL

Alterar as foreign keys de `employees` e `calls` para SET NULL:

```sql
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_profile_id_fkey;
ALTER TABLE employees ADD CONSTRAINT employees_profile_id_fkey 
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL;

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_user_id_fkey;
ALTER TABLE employees ADD CONSTRAINT employees_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_user_id_fkey;
ALTER TABLE calls ADD CONSTRAINT calls_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
```

### Resultado
- Exclusão de usuários funcionará sem erros de foreign key
- Registros históricos (calls, deals, meetings) são preservados com referência NULL
- Ficha do colaborador (employee) é mantida mas desvinculada do perfil

