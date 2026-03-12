

## Adicionar colunas detalhadas na tabela de Transações do relatório de Vendas

### Objetivo
Adicionar 6 novas colunas na tabela "Transações no Período" do `SalesReportPanel`: **Canal de Venda** (Lançamento/A010/Live/etc), **Closer R1**, **Closer R2**, **SDR**, **Data Contrato** e **Data Parceria**.

### Abordagem

**1. Usar `useAcquisitionReport` como fonte de dados classificados**

O hook `useAcquisitionReport` já faz todo o matching entre transações → attendees R1 → closers → SDRs. Em vez de duplicar essa lógica no `SalesReportPanel`, vamos consumir o `classified` array que já contém `closerName`, `sdrName`, `origin` e `channel` por transação.

**2. Adicionar query de Closers R2**

Nova query buscando `meeting_slot_attendees` com `meeting_type = 'r2'`, criando um mapa `email → closer R2 name` por matching com os contatos das transações.

**3. Adicionar datas de contrato e parceria por cliente**

Nova query buscando da `hubla_transactions` a primeira `sale_date` onde `product_category = 'contrato'` e `product_category = 'parceria'` agrupado por `customer_email`, criando mapas `email → data`.

### Mudanças

**Arquivo: `src/components/relatorios/SalesReportPanel.tsx`**

1. Importar e usar `useAcquisitionReport` no lugar das queries duplicadas de closers/attendees (já compartilham query keys, sem custo extra de fetch)
2. Adicionar query de **R2 closers**: buscar `meeting_slot_attendees` + `meeting_slots(closer_id, meeting_type='r2')` + `closers(name)` no período, construir mapa `email → r2CloserName`
3. Adicionar query de **datas contrato/parceria**: buscar min `sale_date` de `hubla_transactions` por `customer_email` onde `product_category in ('contrato', 'parceria')`, construir mapas `email → date`
4. Na tabela de transações, cruzar cada `tx.customer_email` com os `classified` data e os novos mapas para exibir:
   - **Canal**: `origin` do classified (Lançamento, A010, Live, etc) — substitui o `detectSalesChannel` simplificado
   - **Closer R1**: `closerName` do classified
   - **Closer R2**: do mapa R2
   - **SDR**: `sdrName` do classified
   - **Dt. Contrato**: do mapa de datas
   - **Dt. Parceria**: do mapa de datas
5. Atualizar o export Excel com as novas colunas
6. Remover queries duplicadas que já vêm do `useAcquisitionReport`

### Resultado visual na tabela

| Data | Produto | Canal | Closer R1 | Closer R2 | SDR | Cliente | Dt. Contrato | Dt. Parceria | Bruto | Líquido | Parcela | Status |

