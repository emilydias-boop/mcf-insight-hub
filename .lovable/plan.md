
# Adicionar Data de Criacao e Ultima Movimentacao na Tabela do Limbo

## O que sera feito

Adicionar duas novas colunas na tabela de resultados do Leads em Limbo:
1. **Criado em** - data de criacao do deal no sistema (`crm_deals.created_at`)
2. **Ult. Mov.** - data da ultima atualizacao/movimentacao do deal (`crm_deals.updated_at`)

## Implementacao

### 1. Buscar os dados (src/hooks/useLimboLeads.ts)

A query de `useInsideSalesDeals` ja busca `created_at`. Sera adicionado tambem `updated_at` na query do Supabase.

O tipo `LimboRow` recebera dois novos campos opcionais:
- `localCreatedAt?: string`
- `localUpdatedAt?: string`

A funcao `compareExcelWithLocal` passara esses campos do deal local para o LimboRow quando houver match.

### 2. Exibir na tabela (src/pages/crm/LeadsLimbo.tsx)

Adicionar duas colunas novas entre "Tags" e "Status":
- **Criado em** - formatado como `dd/MM/yy`
- **Ult. Mov.** - formatado como `dd/MM/yy`

Ambas exibirao um tracinho ("--") caso nao haja dados (leads nao encontrados).

### 3. Persistencia

Os novos campos `localCreatedAt` e `localUpdatedAt` serao incluidos automaticamente no sessionStorage junto com o restante do LimboRow, sem necessidade de alterar a logica de persistencia.

## Arquivos modificados
- `src/hooks/useLimboLeads.ts` - Adicionar `updated_at` na query, campos no LimboRow e no compareExcelWithLocal
- `src/pages/crm/LeadsLimbo.tsx` - Adicionar duas colunas na tabela com formatacao de data
