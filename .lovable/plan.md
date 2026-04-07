

# Limpeza dos 54 deals recuperado-a010 duplicados

## Diagnóstico
- 59 deals com tag `recuperado-a010` na Inside Sales
- **51** são duplicatas por email (mesmo email, contato diferente, já tem deal existente)
- **~3** são duplicatas por telefone (email diferente, mesmo telefone)
- **Apenas 5** são verdadeiramente únicos e devem ser mantidos

O backfill criou novos contatos em vez de reusar os existentes, gerando duplicidade.

## Plano de execução

### Etapa 1: Deletar os 54 deals duplicados
Migration SQL que:
1. Identifica os 54 deal IDs `recuperado-a010` que possuem um deal existente na Inside Sales (por email ou telefone)
2. Deleta dependências (deal_activities, deal_tasks, automation_queue, automation_logs, calls, meeting_slots)
3. Deleta os 54 deals de `crm_deals`
4. Arquiva os contatos órfãos criados pelo backfill (contatos que não possuem mais nenhum deal ativo)

### Etapa 2: Manter os 5 deals únicos
Os 5 deals verdadeiramente únicos permanecem intactos na pipeline.

### Resultado esperado
- 54 deals duplicados removidos
- 5 deals legítimos preservados
- Contatos órfãos do backfill arquivados

| Arquivo | Acao |
|---|---|
| `supabase/migrations/*.sql` | DELETE dos 54 deals recuperados duplicados + arquivamento de contatos órfãos |

