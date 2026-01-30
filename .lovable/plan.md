
# Plano: Excluir Transações Make Duplicadas da Listagem

## Problema Identificado

As transações com `source = 'make'` estão aparecendo na listagem mesmo quando já existe uma transação oficial (`hubla` ou `manual`) para o mesmo cliente e produto. Isso está causando:

1. **Inflação do Bruto Total** - R$ 19.500 extras para Judá, José Augusto, Thiago, etc.
2. **Poluição visual** - Linhas duplicadas marcadas como "(dup)" na tabela

### Exemplo: Judá Ferreira

| Transação | Source | Bruto | Problema |
|-----------|--------|-------|----------|
| A009 - MCF INCORPORADOR COMPLETO + THE CLUB | hubla | R$ 19.500 | Correta |
| A009 - MCF INCORPORADOR + THE CLUB | make | R$ 19.500 | **Duplicada - não deveria aparecer** |

---

## Solução Proposta

### Modificar a Função `get_all_hubla_transactions()` 

Adicionar filtro para excluir transações `make` quando já existe uma transação `hubla` ou `manual` para o mesmo cliente (email) e produto normalizado na mesma data.

### Lógica do Filtro

```text
Para cada transação make:
  SE existe transação hubla/manual COM:
    - Mesmo email (LOWER)
    - Mesmo produto normalizado (A009, A001, etc.)
    - Mesma data (DATE)
  ENTÃO:
    Excluir a transação make da listagem
```

---

## Detalhes Técnicos

### Nova Cláusula WHERE na RPC

```sql
-- Excluir transações make duplicadas
AND NOT (
  ht.source = 'make' 
  AND EXISTS (
    SELECT 1 FROM hubla_transactions ht_official
    WHERE ht_official.source IN ('hubla', 'manual')
      AND LOWER(ht_official.customer_email) = LOWER(ht.customer_email)
      AND DATE(ht_official.sale_date) = DATE(ht.sale_date)
      AND ht_official.sale_status IN ('completed', 'refunded')
      -- Mesmo produto normalizado
      AND (
        (UPPER(ht.product_name) LIKE '%A009%' AND UPPER(ht_official.product_name) LIKE '%A009%')
        OR (UPPER(ht.product_name) LIKE '%A001%' AND UPPER(ht_official.product_name) LIKE '%A001%')
        OR (UPPER(ht.product_name) LIKE '%A000%' AND UPPER(ht_official.product_name) LIKE '%A000%')
        -- ... outros produtos
      )
  )
)
```

---

## Impacto Esperado

| Cliente | Bruto Atual | Bruto Após Correção |
|---------|-------------|---------------------|
| Judá Ferreira | R$ 39.601 | R$ 20.101 |
| José Augusto | Inflado | Correto |
| Thiago Henrique | Inflado | Correto |

### Total Mensal Esperado

De **~R$ 1.85M** para **~R$ 1.78M** (remoção de ~R$ 70k em duplicatas)

---

## Arquivos a Modificar

1. **Nova migração SQL** - Atualizar `get_all_hubla_transactions()` com filtro de exclusão de duplicatas make

---

## Benefícios

- Listagem limpa sem linhas duplicadas
- Bruto Total correto automaticamente
- Não requer ajustes manuais de `gross_override`
- Make continua sendo ingerido para tracking, mas não aparece quando há oficial
