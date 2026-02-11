
# Usar Datas da Planilha (created_at e lost_at) na Tabela do Limbo

## O que muda

As colunas "Criado em" e "Ult. Mov." devem exibir dados vindos da planilha importada (campos `created_at` e `lost_at`), nao do banco de dados local.

## Implementacao

### 1. Adicionar novas colunas ao mapeamento (src/pages/crm/LeadsLimbo.tsx)

Expandir `COLUMN_KEYS` para incluir `created_at` e `lost_at`:

```
COLUMN_KEYS = ['name', 'email', 'phone', 'stage', 'value', 'owner', 'created_at', 'lost_at']
```

Adicionar labels e hints de auto-map:
- `created_at`: hints `['created_at', 'criado', 'data_criacao', 'data criação']`
- `lost_at`: hints `['lost_at', 'perdido', 'ultima_mov', 'última movimentação', 'last_move']`

### 2. Passar os novos campos na comparacao (src/pages/crm/LeadsLimbo.tsx)

No `runComparison`, extrair `created_at` e `lost_at` do `rawData` e passa-los para `excelRows`.

### 3. Adicionar campos no LimboRow (src/hooks/useLimboLeads.ts)

Adicionar `excelCreatedAt` e `excelLostAt` ao tipo `LimboRow` e ao input de `compareExcelWithLocal`.

### 4. Exibir na tabela (src/pages/crm/LeadsLimbo.tsx)

As colunas "Criado em" e "Ult. Mov." passam a usar `row.excelCreatedAt` e `row.excelLostAt` em vez dos campos locais. A formatacao tentara parsear a data e exibir como `dd/MM/yy`.

### 5. Remover campos locais desnecessarios

Remover `localCreatedAt` e `localUpdatedAt` do LimboRow e da query, ja que nao serao mais usados para exibicao (podem ser mantidos se houver outro uso, mas no contexto atual nao ha).

## Arquivos modificados
- `src/pages/crm/LeadsLimbo.tsx` - Expandir ColumnKeys, auto-map, extrair dados no runComparison, atualizar colunas da tabela
- `src/hooks/useLimboLeads.ts` - Adicionar `excelCreatedAt` e `excelLostAt` ao LimboRow e ao compareExcelWithLocal
