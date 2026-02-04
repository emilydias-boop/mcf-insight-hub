

# Plano: Vincular user_id no Registro SDR

## Problema Identificado

O Cleiton Lima está vendo a mensagem "Você não está cadastrado no sistema de fechamento" porque:

1. O hook `useOwnFechamento` busca SDRs pelo `user_id` do usuário autenticado
2. O registro SDR do Cleiton tem `user_id = NULL`
3. Sem esse vínculo, o sistema não consegue identificar o fechamento do usuário

### Dados Atuais

| Campo | Valor |
|-------|-------|
| Profile ID (auth) | `16828627-136e-42ef-9623-62dedfbc9d89` |
| SDR ID | `11111111-0001-0001-0001-000000000006` |
| SDR user_id | `NULL` ❌ |
| Payout existe? | Sim (status: LOCKED, R$ 5.107,50) |

## Solução

### Opção 1: Atualizar o registro SDR existente (recomendado)

Vincular o `user_id` do profile ao registro SDR:

```sql
UPDATE sdr 
SET user_id = '16828627-136e-42ef-9623-62dedfbc9d89'
WHERE id = '11111111-0001-0001-0001-000000000006';
```

### Opção 2: Melhorar o hook para fallback por email

Modificar o hook `useOwnFechamento` para buscar também por email quando não encontrar por `user_id`:

```typescript
// Em useOwnFechamento.ts, linha 51-58
const { data, error } = await supabase
  .from('sdr')
  .select('*')
  .or(`user_id.eq.${authUser.id},email.eq.${authUser.email}`)
  .limit(1)
  .single();
```

## Recomendação

Aplicar **ambas** as soluções:
1. Corrigir o registro do Cleiton imediatamente via migração SQL
2. Adicionar fallback por email no hook para casos futuros

## Resultado Esperado

Após vincular o `user_id`, o Cleiton poderá ver seu fechamento de Janeiro 2026 com:
- Status: LOCKED
- Total Conta: R$ 5.107,50

