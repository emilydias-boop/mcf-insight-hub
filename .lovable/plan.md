

# Diagnóstico: Transações Faltando no Relatório do Incorporador

## O que encontrei

Após analisar a base de dados e comparar com sua planilha, identifiquei **3 problemas** que estão causando a diferença de valores:

---

## Problema 1: Função SQL filtra apenas fontes `hubla` e `manual`

A função `get_all_hubla_transactions` (que alimenta a página `/bu-incorporador/transacoes`) possui o filtro:

```sql
AND ht.source IN ('hubla', 'manual')
```

**Isso exclui automaticamente:**
- `asaas` - 2 transações (Gabriel Santos R$19.500 + Gleidson Warlen R$19.500 = **R$39.000**)
- `kiwify` - 4 transações relevantes (Rogerio Costa, Ricardo Guimarães, Maurício = ~**R$48.000**)

---

## Problema 2: Nomes de produtos não mapeados

O produto `A009 - Incorporador Completo + The Club` (formato do Asaas) **não existe** na tabela `product_configurations`.

Produtos configurados:
- ✅ `A009 - MCF INCORPORADOR COMPLETO + THE CLUB`
- ✅ `A009 - MCF INCORPORADOR + THE CLUB`
- ❌ `A009 - Incorporador Completo + The Club` ← **FALTANDO**

Isso exclui R$39.000 em vendas do Asaas.

---

## Problema 3: Transações ASAAS genéricas não existem

Na sua planilha aparecem linhas como:
- `05/01/2026 | ASAAS | - | - | R$ 7.500,00`
- `08/01/2026 | ASAAS | COBRANÇAS 6,7,8 de janeiro | R$ 7.995,31`
- etc.

Essas transações **não existem na base de dados** como registros de pagamento consolidado. Precisam ser adicionadas manualmente.

---

## Resumo do Impacto

| Problema | Valor Aprox. Perdido |
|----------|---------------------|
| Source `asaas`/`kiwify` excluído | ~R$ 87.000 |
| Nome de produto não mapeado | ~R$ 39.000 |
| Transações ASAAS não cadastradas | ~R$ 92.000+ |
| **Total estimado** | **~R$ 180.000+** |

---

## Plano de Correção

### Etapa 1: Atualizar função SQL para incluir mais fontes

Modificar `get_all_hubla_transactions` para:

```sql
AND ht.source IN ('hubla', 'manual', 'asaas', 'kiwify')
```

**Arquivos afetados:** Migration SQL

---

### Etapa 2: Adicionar variações de nomes de produtos

Inserir na tabela `product_configurations`:

| product_name | target_bu | product_code | reference_price | is_active |
|--------------|-----------|--------------|-----------------|-----------|
| A009 - Incorporador Completo + The Club | incorporador | A009 | 19500 | true |
| A001 - Incorporador Completo | incorporador | A001 | 14500 | true |

**Arquivos afetados:** Migration SQL ou UI Admin

---

### Etapa 3: Criar transações manuais para consolidados ASAAS

Você precisará adicionar manualmente (via UI ou SQL) as transações consolidadas do ASAAS que estão na planilha mas não no sistema:

| Data | Descrição | Valor Líquido |
|------|-----------|---------------|
| 05/01/2026 | ASAAS | R$ 7.500,00 |
| 08/01/2026 | COBRANÇAS 6,7,8 de janeiro | R$ 7.995,31 |
| 09/01/2026 | COBRANÇAS 9 JANEIRO | R$ 1.000,00 |
| 11/01/2026 | COBRANÇAS 11 JANEIRO | R$ 14.500,00 |
| 15/01/2026 | COBRANÇAS 15 JANEIRO | R$ 7.000,00 |
| 19/01/2026 | COBRANÇAS 19 JANEIRO | R$ 2.333,32 + R$ 3.500,00 |
| 20/01/2026 | COBRANÇAS 20 JANEIRO | R$ 5.000,00 |
| 21/01/2026 | COBRANÇAS 21 JANEIRO | R$ 7.000,00 |
| 23/01/2026 | Consolidados | R$ 19.500 + R$ 19.500 + R$ 12.000 + R$ 3.000 |

---

## Ordem de Implementação

1. **SQL Migration** - Alterar filtro de `source` na função + adicionar produtos faltantes
2. **Verificar resultado** - Conferir se os valores subiram
3. **Cadastrar ASAAS consolidados** - Via UI de transações manuais ou SQL direto

---

## Detalhes Técnicos

A migration SQL vai:

```sql
-- 1. Recriar função com filtro de source expandido
DROP FUNCTION IF EXISTS public.get_all_hubla_transactions(text, timestamptz, timestamptz, integer);

CREATE OR REPLACE FUNCTION public.get_all_hubla_transactions(...)
...
WHERE ...
  AND ht.source IN ('hubla', 'manual', 'asaas', 'kiwify')
...

-- 2. Adicionar produtos faltantes
INSERT INTO product_configurations (product_name, target_bu, product_code, reference_price, is_active)
VALUES 
  ('A009 - Incorporador Completo + The Club', 'incorporador', 'A009', 19500, true),
  ('A001 - Incorporador Completo', 'incorporador', 'A001', 14500, true)
ON CONFLICT (product_name) DO NOTHING;
```

