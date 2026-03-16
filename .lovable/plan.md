

## Redesenhar Modais de Criar/Editar Assinatura com Produto Selecionavel e UX Inteligente

### Problema atual
Os modais de criar e editar assinatura usam inputs de texto livre para produto e categoria, sem integração com `product_configurations`. Falta lógica condicional (ex: mostrar campos de parcelas só quando relevante) e campos editáveis do lead.

### Solução

**1. CreateSubscriptionModal.tsx** -- Reescrever completamente

Seções organizadas:

**Seção 1 - Dados do Lead** (editáveis)
- Nome do Cliente * (input)
- Email (input)
- Telefone (input)

**Seção 2 - Produto e BU**
- **Produto** -- Select/Combobox pesquisavel com dados de `product_configurations` (is_active=true). Ao selecionar, preenche automaticamente:
  - `valor_total_contrato` = `reference_price` (bruto, 1x)
  - `product_category` = categoria do produto
  - `target_bu` como Categoria/BU (select com `TARGET_BU_OPTIONS`)
- **Categoria (BU)** -- Select pre-preenchido pela seleção do produto, editavel para override

**Seção 3 - Financeiro Condicional**
- Valor Total do Contrato (pre-preenchido, editavel)
- Tem entrada? (toggle/checkbox) -- se sim, mostra campo Valor Entrada
- **Forma de Pagamento** -- Select (PIX, Cartão, Boleto, Outro)
- **Logica condicional**: se forma != pagamento unico:
  - Nº de Parcelas (input number)
  - Valor de cada parcela (calculado automaticamente: `(total - entrada) / parcelas`, editavel)
  - Data do 1º Vencimento (date picker)
  - Intervalo entre parcelas: Select (mensal / quinzenal / customizado)
  - Se customizado: permitir datas individuais para cada parcela (mini-lista editavel)

**Seção 4 - Complementar**
- Responsável Financeiro
- Observações
- Data Início (default: hoje)

**2. EditSubscriptionModal.tsx** -- Atualizar

Mesma lógica do Create mas com dados pre-carregados:
- Produto como Combobox (valor atual pre-selecionado)
- Categoria/BU como Select
- Campos do lead editaveis (nome, email, telefone)
- Forma de pagamento como Select
- Responsavel, observações

**3. Hook `useProductConfigurationsForBilling`**

Query simples que busca `product_configurations` (is_active=true) retornando `id, product_name, product_code, reference_price, product_category, target_bu`. Reutiliza o hook existente `useProductConfigurations`.

### Arquivos

| Ação | Arquivo |
|------|---------|
| Reescrever | `src/components/financeiro/cobranca/CreateSubscriptionModal.tsx` |
| Reescrever | `src/components/financeiro/cobranca/EditSubscriptionModal.tsx` |
| Manter | `useProductConfigurations.ts` (já existe, será importado) |
| Manter | `useBillingSubscriptions.ts`, `useBillingInstallments.ts` (sem alteração) |

### Comportamento chave

- Ao selecionar produto no Combobox, auto-preenche valor e BU
- Forma de pagamento condiciona visibilidade dos campos de parcelamento
- Parcelas geradas com datas calculadas (mensal por padrão, editavel)
- `billing_installments` criadas com as datas definidas pelo usuario (não mais sempre addMonths fixo)

