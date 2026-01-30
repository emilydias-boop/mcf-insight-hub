
## Objetivo
Corrigir o cálculo de **Novo / Recorrente** e, consequentemente, o **Bruto** (que está zerando como “dup”) quando a primeira transação do cliente está sendo “capturada” por registros auxiliares do **Make** (ex.: `product_name = 'Contrato'`), que agora **não aparecem mais na listagem** (porque já excluímos no `get_all_hubla_transactions`), mas **ainda estão sendo considerados** na função que define os “primeiros IDs” (`get_first_transaction_ids`).

Isso explica exatamente o seu exemplo do **Rodrigo Jesus**:
- A linha exibida é **A000 - Contrato** (Hubla), mas está aparecendo como **Recorrente** e **Bruto R$ 0,00 (dup)**.
- O motivo provável é que existe um registro anterior do Make com `product_name='Contrato'` (ou algum auxiliar) que está sendo considerado como “primeira compra” na deduplicação, porém foi removido da listagem — deixando a venda real como “recorrente” indevidamente.

---

## Diagnóstico (o que está acontecendo hoje)
### 1) A tela /bu-incorporador/transacoes usa:
- `get_all_hubla_transactions` para buscar a lista (já filtrada para BU incorporador e já excluindo Make auxiliar)
- `get_first_transaction_ids` para marcar Novo/Recorrente (Set globalFirstIds)

### 2) O problema
O `get_first_transaction_ids` (conforme migrations atuais) **inclui source 'make'** e **não exclui** os produtos auxiliares (`parceria`, `contrato`, `ob construir para alugar`).
Então ele pode retornar como “primeiro” um ID que:
- pertence ao Make,
- é um registro auxiliar,
- e agora não aparece mais no `get_all_hubla_transactions`.

Resultado: a venda real (Hubla) vira “Recorrente” e o bruto zera (por regra do `getDeduplicatedGross`).

---

## Solução proposta
### A) Atualizar a função `get_first_transaction_ids()` para aplicar a mesma exclusão que aplicamos no `get_all_hubla_transactions`
Adicionar no WHERE:

```sql
AND NOT (
  ht.source = 'make'
  AND LOWER(ht.product_name) IN ('parceria', 'contrato', 'ob construir para alugar')
)
```

Assim, o “primeiro ID” deixa de ser o tracking do Make, e volta a ser a primeira venda real válida do cliente naquele produto.

### B) Validar o impacto direto no Bruto
Com o Rodrigo sendo marcado como **Novo**:
- Para **A000** (Contrato), o bruto deve voltar a **R$ 497,00** (ou o preço de referência configurado no `product_configurations`, ou override se existir).
- O “(dup)” deve sumir.

---

## Passo a passo de implementação (DB)
1) Criar uma nova migration SQL atualizando `public.get_first_transaction_ids()`.
2) Garantir que a função mantenha os filtros já existentes (para incorporador):
   - join com `product_configurations` (`target_bu='incorporador'` e `is_active=true`)
   - `sale_status IN ('completed','refunded')`
   - excluir `hubla_id like 'newsale-%'`
   - excluir parent IDs (`hubla_id NOT IN parent_ids`)
3) Adicionar o novo filtro de exclusão dos auxiliares Make.
4) Publicar a migration no ambiente de Test.
5) Recarregar a tela `/bu-incorporador/transacoes` e validar o caso do Rodrigo.

---

## SQL (modelo da alteração)
Baseado no formato atual da função (mantendo a mesma estrutura e só adicionando o filtro faltante):

```sql
CREATE OR REPLACE FUNCTION public.get_first_transaction_ids()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH parent_ids AS (
    SELECT DISTINCT SPLIT_PART(hubla_id, '-offer-', 1) as parent_id
    FROM hubla_transactions
    WHERE hubla_id LIKE '%-offer-%'
  ),
  ranked_transactions AS (
    SELECT
      ht.id,
      ROW_NUMBER() OVER (
        PARTITION BY
          LOWER(COALESCE(NULLIF(TRIM(ht.customer_email), ''), 'unknown')),
          CASE
            WHEN UPPER(ht.product_name) LIKE '%A009%' THEN 'A009'
            WHEN UPPER(ht.product_name) LIKE '%A005%' THEN 'A005'
            WHEN UPPER(ht.product_name) LIKE '%A004%' THEN 'A004'
            WHEN UPPER(ht.product_name) LIKE '%A003%' THEN 'A003'
            WHEN UPPER(ht.product_name) LIKE '%A001%' THEN 'A001'
            WHEN UPPER(ht.product_name) LIKE '%A010%' THEN 'A010'
            WHEN UPPER(ht.product_name) LIKE '%A000%' OR UPPER(ht.product_name) LIKE '%CONTRATO%' THEN 'A000'
            WHEN UPPER(ht.product_name) LIKE '%PLANO CONSTRUTOR%' THEN 'PLANO_CONSTRUTOR'
            ELSE LEFT(UPPER(TRIM(ht.product_name)), 40)
          END
        ORDER BY ht.sale_date ASC
      ) AS rn
    FROM hubla_transactions ht
    INNER JOIN product_configurations pc
      ON LOWER(ht.product_name) = LOWER(pc.product_name)
      AND pc.target_bu = 'incorporador'
      AND pc.is_active = true
    WHERE
      ht.sale_status IN ('completed', 'refunded')
      AND ht.hubla_id NOT LIKE 'newsale-%'
      AND ht.source IN ('hubla', 'manual', 'make')
      AND ht.hubla_id NOT IN (SELECT parent_id FROM parent_ids)

      -- NOVO: excluir registros auxiliares do Make (tracking)
      AND NOT (
        ht.source = 'make'
        AND LOWER(ht.product_name) IN ('parceria', 'contrato', 'ob construir para alugar')
      )
  )
  SELECT ranked_transactions.id
  FROM ranked_transactions
  WHERE rn = 1;
END;
$function$;
```

---

## Como vamos validar (checklist rápido)
1) Na linha do **Rodrigo Jesus / A000 - Contrato**:
   - Tipo deve mudar de **Recorrente → Novo**
   - Bruto deve mudar de **R$ 0,00 (dup) → R$ 497,00** (ou valor configurado)
2) Validar mais 2–3 exemplos de clientes que estavam “errados” para garantir que não há regressão.
3) Confirmar que transações Make auxiliares continuam fora da lista (já resolvido via `get_all_hubla_transactions`) e também não contaminam o Novo/Recorrente (esta correção).

---

## Observação importante (para evitar voltar o problema)
Sempre que adicionarmos alguma exclusão/normalização no RPC de listagem (`get_all_hubla_transactions`), precisamos manter o `get_first_transaction_ids` “espelhado” para que:
- a listagem e a deduplicação usem o mesmo universo de transações válidas.

---

## Risco e impacto
- Impacto: somente no cálculo “Novo/Recorrente” e no Bruto deduplicado para a BU incorporador.
- Risco baixo: a regra já existe no `get_all_hubla_transactions`; estamos apenas alinhando a função de “primeiro ID” para não considerar registros que já foram declarados como inválidos para relatórios.
