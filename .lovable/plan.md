
# Plano: Transferir Leads para Cleiton (SDR Consórcio)

## Contexto

Os 206 IDs de leads fornecidos são de uma fonte externa e não correspondem aos UUIDs do banco de dados. Os deals existem na pipeline **Efeito Alavanca + Clube** (`7d7b1cb5-2a44-4552-9eff-c3b798646b78`) com UUIDs diferentes, identificáveis pelo **nome do lead**.

## Dados do Cleiton

| Campo | Valor |
|-------|-------|
| Nome | Cleiton Anacleto Lima |
| Email | cleiton.lima@minhacasafinanciada.com |
| Profile ID | 16828627-136e-42ef-9623-62dedfbc9d89 |
| Role | SDR |

## Solução Proposta

### Opção 1: Script SQL Direto (Recomendado para 206 leads)

Executar um UPDATE direto no banco usando a lista de nomes fornecida:

```sql
-- Transferir deals para Cleiton por nome na pipeline Efeito Alavanca + Clube
UPDATE crm_deals
SET 
  owner_id = 'cleiton.lima@minhacasafinanciada.com',
  owner_profile_id = '16828627-136e-42ef-9623-62dedfbc9d89',
  updated_at = NOW()
WHERE origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
  AND owner_id IS NULL
  AND name IN (
    'matheus', 'Felipe Clemente de Sá', 'Marcio Renato Martins', 'Giovanni kazuo',
    'Cristiano Alberto dos Santos', 'ARY DRUMOND', 'Italo Cortez', 'Lucia Shiraichi',
    -- ... lista completa de 206 nomes únicos
  );
```

E depois registrar a atividade de transferência em massa.

### Opção 2: Edge Function de Transferência por Nome

Criar uma Edge Function que:
1. Recebe lista de nomes + pipeline + novo owner
2. Busca os IDs reais no banco por nome
3. Usa a lógica existente do `useBulkTransfer` para transferir

## Nomes a Transferir (206 registros - nomes únicos da lista)

A lista completa fornecida contém 206 linhas. Após remover duplicatas por nome, temos aproximadamente **150-170 nomes únicos** que correspondem a deals órfãos na pipeline.

## Implementação Recomendada

1. **Primeiro**: Executar query para identificar exatamente quantos deals correspondem aos nomes
2. **Segundo**: Gerar e executar o UPDATE SQL com a lista completa
3. **Terceiro**: Registrar atividades de transferência via INSERT em `deal_activities`

## Alternativa: Usar o Hook Existente

Se preferir usar a interface do sistema:
1. Listar os IDs reais buscando por nome
2. Usar o `useBulkTransfer` com os IDs corretos do banco

---

**Próximo passo:** Confirme qual abordagem prefere e eu executo a transferência completa.
