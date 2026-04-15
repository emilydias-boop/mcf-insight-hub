

## Plano: Alinhar "Total Pagos" do relatório lifecycle com o Carrinho

### Problema
- **Carrinho R2**: 62 contratos pagos — conta emails únicos de `hubla_transactions` com filtros rigorosos (product = A000, exclui newsale-, installment > 1, fontes específicas)
- **Relatório Lifecycle**: 70 contratos pagos — conta R1 attendees com `contract_paid_at` preenchido, sem validar se existe transação real na Hubla

A diferença de 8 vem de: deals marcados manualmente como "contrato pago" sem transação Hubla correspondente, deals duplicados para o mesmo cliente, ou transações de fontes/produtos excluídos.

### Correção

Mudar a fonte primária do Step 1 do lifecycle para usar `hubla_transactions` (como o Carrinho faz), e depois resolver os R1 attendees a partir dos emails encontrados.

**Arquivo: `src/hooks/useContractLifecycleReport.ts`**

**Novo Step 1 (substituir o atual Step 1a):**
1. Buscar transações em `hubla_transactions` com os mesmos filtros do Carrinho:
   - `product_name = 'A000 - Contrato'`
   - `sale_status in ('completed', 'refunded')`
   - `source in ('hubla', 'manual', 'make', 'mcfpay', 'kiwify')`
   - `sale_date` dentro dos boundaries de contratos (Qui-Qua)
2. Aplicar os mesmos filtros de exclusão:
   - Excluir `hubla_id` começando com `newsale-`
   - Excluir `source = 'make'` com `product_name = 'contrato'`
   - Excluir `installment_number > 1`
3. Deduplicar por `customer_email` (lowercase)
4. Resolver `customer_email` → `crm_contacts` → `crm_deals` → `meeting_slot_attendees` (R1)
5. Para emails sem R1 attendee, criar rows sintéticos (como já faz no Step 1c/1d)

**Novo Step 1 detalhe:**
- Buscar contacts por email
- Buscar deals por contact_id
- Filtrar deals por BU (incorporadorOriginIds)
- Buscar R1 attendees por deal_id
- Para contratos sem R1, criar row sintético com `r1Status = 'outside'`
- Flag de refund vem direto da transação (`sale_status = 'refunded'`)

**Steps 1c e 1d (R2 aprovados + encaixados)** permanecem iguais — eles adicionam leads que não pagaram na safra.

**Steps 2-5** permanecem iguais — resolvem SDR, R2, e classificam situação.

### Resultado esperado
- Total Pagos = 62 (alinhado com Carrinho)
- Deduplicação por email garante que não conte o mesmo cliente 2x
- Reembolsos identificados diretamente pela transação Hubla

### Seção técnica
- Arquivo único: `src/hooks/useContractLifecycleReport.ts`
- Reescrever Step 1a (~linhas 120-182): trocar query de `meeting_slot_attendees` por `hubla_transactions` + resolução email→contact→deal→R1
- ~80 linhas de código alteradas/adicionadas
- Imports adicionais: nenhum (já tem tudo)

