
# Corrigir Mapeamento de Colunas de Data (created_at / lost_at)

## Problema
As colunas "Criado em" e "Ult. Mov." aparecem como "--" porque o auto-mapeamento nao esta encontrando as colunas correspondentes na planilha. Os hints atuais nao cobrem os nomes exatos usados no arquivo Excel (provavelmente "created_at" e "lost_at" ou variacoes).

## Causa Raiz
A funcao `autoMapColumns` usa `h.includes(hint)` para comparar, mas os nomes das colunas na planilha podem ter formatos diferentes dos hints configurados. Alem disso, se o auto-map falha e o usuario nao mapeia manualmente, o valor fica vazio e nenhuma data e extraida.

## Solucao

### Arquivo: `src/pages/crm/LeadsLimbo.tsx`

1. **Expandir hints de auto-mapeamento** para cobrir mais variacoes:

```
created_at: ['created_at', 'createdat', 'criado', 'data_criacao', 'data criação',
             'data de criação', 'data_de_criacao', 'created', 'dt_criacao', 'criado_em',
             'criado em', 'data criacao']
lost_at: ['lost_at', 'lostat', 'perdido', 'ultima_mov', 'última movimentação',
          'last_move', 'ult mov', 'ult_mov', 'lost', 'data_perda', 'ultima movimentacao',
          'última mov', 'ultima_movimentacao', 'updated_at', 'updatedat', 'atualizado']
```

2. **Melhorar a logica de match** na funcao `autoMapColumns`: alem de `includes`, tambem verificar igualdade exata (apos normalizacao) para evitar falsos negativos quando o nome da coluna e exatamente o hint.

3. **Tratar `__none__` como vazio** no `runComparison`: se o usuario selecionar "Nao mapear", o valor `__none__` nao deve ser usado como nome de coluna.

### Detalhes Tecnicos

- Na funcao `autoMapColumns`, adicionar match por igualdade exata antes do `includes`
- No `runComparison`, verificar `columnMapping.created_at && columnMapping.created_at !== '__none__'` antes de extrair o valor
- Mesma verificacao para `lost_at`

## Arquivo modificado
- `src/pages/crm/LeadsLimbo.tsx`
