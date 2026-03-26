

## Sincronização bidirecional: Colaborador ↔ Usuário (squad/BU)

### Problema atual

Existem **duas tabelas independentes** que guardam BU/squad:

| Tabela | Campo | Tipo | Usado para |
|--------|-------|------|------------|
| `profiles` | `squad` | `TEXT[]` (array) | Sidebar, permissões, menu, painel comercial |
| `employees` | `squad` | `TEXT` (texto simples) | Ficha de RH, filtros de colaborador |

Quando você altera o squad no Colaborador (employees), o `profiles.squad` **não muda**. E vice-versa. Resultado: o SDR não vê o menu porque o `profiles.squad` continua vazio, mesmo tendo squad definido na ficha de RH.

### Solução: 2 triggers SQL de sincronização

**Trigger 1 — employees → profiles**
Quando `employees.squad` ou `employees.departamento` muda e o employee tem `profile_id`, atualizar `profiles.squad` com o valor equivalente mapeado (ex: departamento "BU - Incorporador 50K" → squad `['incorporador']`).

**Trigger 2 — profiles → employees**
Quando `profiles.squad` muda, encontrar o employee vinculado via `profile_id` e atualizar `employees.squad` com o valor correspondente.

Também sincronizar a tabela `sdr` (campo `squad`) para manter tudo consistente.

### Mapeamento departamento → squad (já existe no trigger `auto_link_employee_sdr`)

```text
departamento ILIKE '%incorporador%' → 'incorporador'
departamento ILIKE '%consórcio%'    → 'consorcio'  
departamento ILIKE '%crédito%'      → 'credito'
departamento ILIKE '%leilão%'       → 'leilao'
departamento ILIKE '%marketing%'    → 'marketing'
departamento ILIKE '%projetos%'     → 'projetos'
```

### Ações

| # | Ação | Arquivo |
|---|------|---------|
| 1 | **Criar migration** com 2 triggers de sync | `supabase/migrations/sync_squad_bidirectional.sql` |
| 2 | **Corrigir dados existentes** | UPDATE na mesma migration para sincronizar todos os employees ativos com profiles desatualizados |
| 3 | **Atualizar `create-user` edge function** | Quando cria employee, setar `squad` e `departamento` consistentes com o `profiles.squad` |

### Detalhe dos triggers

**`sync_employee_squad_to_profile()`** — AFTER UPDATE OF squad, departamento ON employees:
- Se `employees.squad` mudou e employee tem `profile_id`, faz `UPDATE profiles SET squad = ARRAY[NEW.squad]` (ou adiciona ao array existente se necessário)
- Também atualiza `sdr.squad` se o SDR existe

**`sync_profile_squad_to_employee()`** — AFTER UPDATE OF squad ON profiles:
- Encontra employee com `profile_id = NEW.id`
- Atualiza `employees.squad` com o primeiro valor do array
- Também atualiza `sdr.squad` se o SDR existe

Ambos os triggers usam um guard para evitar loop infinito (um flag de sessão `pg_catalog.set_config('app.syncing_squad', 'true', true)`).

### Correção de dados na mesma migration

```sql
-- Preencher profiles.squad para employees ativos com squad definido
UPDATE profiles p
SET squad = ARRAY[
  CASE 
    WHEN e.squad ILIKE '%incorporador%' THEN 'incorporador'
    WHEN e.squad ILIKE '%consórcio%' THEN 'consorcio'
    ...
  END
]::text[]
FROM employees e
WHERE e.profile_id = p.id
  AND e.status = 'ativo'
  AND e.squad IS NOT NULL
  AND (p.squad IS NULL OR p.squad = '{}');
```

### Impacto
- Alterar squad no Colaborador (RH) → perfil do usuário atualiza automaticamente → menu aparece
- Alterar BU na aba de Usuário → ficha do colaborador atualiza automaticamente
- Nunca mais precisará pedir aqui para corrigir manualmente
- Zero mudança nos componentes frontend — apenas triggers SQL no banco

