

# Plano: Corrigir Owners dos Leads Importados

## Situação Atual

Os 2.120 deals da pipeline "VIVER DE ALUGUEL" foram importados com `owner_id` e `owner_profile_id` vazios, mas os dados do owner original estão salvos em `custom_fields.user_email`.

## Solução

Executar um UPDATE em batch que lê o `user_email` dos `custom_fields` e preenche `owner_id` e `owner_profile_id` com base na tabela `profiles`.

### SQL de Correção

```sql
-- Atualizar owner_id e owner_profile_id baseado no user_email dos custom_fields
UPDATE crm_deals d
SET 
  owner_id = d.custom_fields->>'user_email',
  owner_profile_id = p.id
FROM profiles p
WHERE d.origin_id = '4e2b810a-6782-4ce9-9c0d-10d04c018636'
  AND d.owner_profile_id IS NULL
  AND d.custom_fields->>'user_email' = p.email;
```

### Resultado Esperado

| Owner | Deals Atualizados |
|-------|-------------------|
| Jéssica Bellini | 1.090 |
| Ithaline Clara | 424 |
| João Pedro | 367 |
| Cleiton Lima | 84 |
| Thayna Tavares | 46 |
| Thobson Motta | 32 |
| Emily Dias | 2 |
| Caroline Souza | 1 |
| Carol Corrêa | 1 |
| Antony Elias | 1 |
| **Total** | **2.048** |

### Deals Restantes (72 sem user_email)

Esses 72 deals vieram de webhooks ou formulários e não tinham owner no CSV. Podemos:
- Deixar sem owner (serão distribuídos manualmente)
- Atribuir a um SDR padrão (você escolhe qual)

## Próximo Passo

Aprovar este plano para executar a migração SQL que preencherá os owners corretamente em todos os 2.048 deals.

