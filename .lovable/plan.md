

## Historico de Precos de Referencia por Produto

### Problema atual

Quando voce altera o `reference_price` de um produto na tabela `product_configurations`, o novo valor e aplicado retroativamente a TODAS as transacoes historicas. Isso porque a funcao RPC `get_all_hubla_transactions` faz JOIN com `product_configurations` e pega o `reference_price` atual.

### Solucao: Tabela de historico de precos com vigencia

Criar uma tabela `product_price_history` que registra cada alteracao de preco com data de inicio de vigencia. Na hora de calcular o bruto de uma transacao, o sistema buscara o preco que estava vigente na `sale_date` da transacao.

```text
product_configurations (atual)          product_price_history (nova)
┌──────────────────────────────┐        ┌──────────────────────────────────┐
│ id                           │        │ id                               │
│ product_name                 │        │ product_config_id (FK)           │
│ reference_price = 16500  ←───┼──┐     │ old_price                        │
│ ...                          │  │     │ new_price                        │
└──────────────────────────────┘  │     │ effective_from (data de vigencia)│
                                  │     │ changed_by (user_id)             │
                                  │     │ created_at                       │
                                  └─────│ ...                              │
                                        └──────────────────────────────────┘
```

### Fluxo

1. Ao salvar um novo `reference_price` no drawer de produto, o sistema automaticamente insere um registro em `product_price_history` com o preco antigo, preco novo, e `effective_from = NOW()`
2. A funcao RPC `get_all_hubla_transactions` sera alterada para fazer um **lateral join** com `product_price_history`, buscando o preco vigente na `sale_date` da transacao
3. Se nao houver historico, usa o `reference_price` atual (retrocompatibilidade)

### Logica do preco vigente

Para uma transacao com `sale_date = 2026-01-15`:
- Se existe registro de historico com `effective_from = 2026-02-01` (preco mudou para 16500)
- E antes disso o preco era 14500
- Entao a transacao de janeiro usa **14500** (preco anterior a mudanca)
- Transacoes a partir de 01/02 usam **16500**

### Alteracoes tecnicas

**1. Nova tabela `product_price_history`**

```sql
CREATE TABLE product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_config_id UUID NOT NULL REFERENCES product_configurations(id),
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**2. Trigger automatico na `product_configurations`**

Quando `reference_price` muda, insere automaticamente um registro no historico:

```sql
CREATE FUNCTION log_price_change() RETURNS trigger AS $$
BEGIN
  IF OLD.reference_price IS DISTINCT FROM NEW.reference_price THEN
    INSERT INTO product_price_history (product_config_id, old_price, new_price, effective_from)
    VALUES (NEW.id, OLD.reference_price, NEW.reference_price, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**3. Funcao auxiliar para buscar preco vigente**

```sql
CREATE FUNCTION get_effective_price(p_product_config_id UUID, p_sale_date TIMESTAMPTZ)
RETURNS NUMERIC AS $$
  -- Busca o preco que estava vigente na sale_date
  -- Se a sale_date e anterior a TODAS as mudancas, usa old_price do primeiro registro
  -- Se e posterior a ultima mudanca, usa reference_price atual
  -- Senao, busca o new_price da mudanca mais recente anterior a sale_date
$$
```

**4. Atualizar RPC `get_all_hubla_transactions`**

Substituir `pc.reference_price` por chamada a `get_effective_price(pc.id, ht.sale_date)`.

**5. Atualizar cache no frontend (`useProductPricesCache`)**

O cache precisara ser ajustado: em vez de um preco unico por produto, carregara tambem o historico de precos para que `getDeduplicatedGross` possa receber o preco correto baseado na `sale_date`. Na pratica, como o preco ja vem correto do RPC (backend), o cache continua funcionando para os poucos casos de fallback.

**6. UI: Exibir historico no ProductConfigDrawer**

Adicionar uma secao no drawer de edicao do produto mostrando o historico de alteracoes de preco, com data, preco anterior, novo preco. Isso da visibilidade ao gestor sobre quando cada mudanca foi feita.

**7. Seed: Registrar precos atuais como baseline**

Inserir um registro inicial para cada produto existente com `effective_from = created_at` do produto e `old_price = new_price = reference_price` atual, para garantir que transacoes antigas continuem usando o preco correto.

### Arquivos afetados

| Arquivo | Alteracao |
|---|---|
| Migration SQL | Criar tabela, trigger, funcao `get_effective_price`, atualizar RPC |
| `src/hooks/useProductConfigurations.ts` | Hook para buscar historico de precos |
| `src/components/admin/ProductConfigDrawer.tsx` | Exibir historico de precos no drawer |
| `src/hooks/useProductPricesCache.ts` | Sem mudanca significativa (preco ja vem correto do RPC) |
| `src/lib/incorporadorPricing.ts` | Sem mudanca (usa `reference_price` que vem do RPC) |

### Impacto

- Transacoes **anteriores** a uma mudanca de preco manterao o preco antigo
- Transacoes **posteriores** usarao o novo preco
- O gestor pode ver quando e quanto mudou no historico do drawer
- Retrocompativel: produtos sem historico continuam usando `reference_price` atual

