

# Plano: Sincronizar Datas de Pagamento Históricas (Janeiro-Fevereiro 2026)

## Resumo do Problema

| Métrica | Valor |
|---------|-------|
| Total de attendees com data errada | 64 |
| Dias afetados | 9 |
| Período | 21/01/2026 - 04/02/2026 |

O webhook estava usando `meeting.scheduled_at` em vez de `data.saleDate` para popular `contract_paid_at`. Isso foi corrigido no código, mas os dados históricos precisam ser atualizados.

---

## Exemplos de Discrepâncias Encontradas

| Cliente | Data Atual (Reunião) | Data Correta (Hubla) | Diferença |
|---------|---------------------|---------------------|-----------|
| Gregorio | 31/01 14:30 | 02/02 13:04 | +2 dias |
| Anna | 21/01 14:30 | 28/01 21:39 | +7 dias |
| Nadiel Todescatt | 22/01 17:00 | 03/02 15:02 | +12 dias |
| André Laface | 28/01 20:15 | 30/01 00:07 | +2 dias |
| Theidy | 03/02 16:00 | 03/02 20:18 | Mesmo dia |

---

## Solução: SQL de Correção em Massa

Execute o seguinte SQL no **Cloud View > Run SQL** (selecione ambiente **Test** ou **Live** conforme necessário):

```sql
-- ============================================
-- CORREÇÃO DE contract_paid_at HISTÓRICOS
-- Sincroniza com sale_date real da Hubla
-- ============================================

-- Atualização em massa usando JOIN com hubla_transactions
UPDATE meeting_slot_attendees msa
SET contract_paid_at = ht.sale_date
FROM hubla_transactions ht
WHERE ht.product_category = 'contrato'
  AND ht.sale_date >= '2026-01-01'
  AND msa.status IN ('contract_paid', 'refunded')
  AND msa.contract_paid_at = (
    SELECT ms.scheduled_at 
    FROM meeting_slots ms 
    WHERE ms.id = msa.meeting_slot_id
  )
  AND (
    -- Match por nome normalizado
    LOWER(TRIM(ht.customer_name)) = LOWER(TRIM(msa.attendee_name))
    OR 
    -- Match por telefone (últimos 9 dígitos)
    RIGHT(REGEXP_REPLACE(ht.customer_phone, '[^0-9]', '', 'g'), 9) = 
    RIGHT(REGEXP_REPLACE(msa.attendee_phone, '[^0-9]', '', 'g'), 9)
  );
```

---

## Registros que Serão Corrigidos

A query acima vai atualizar automaticamente todos os 64 registros identificados, incluindo:

**Fevereiro 2026:**
- Rodrigo Cruvinel Leite (04/02)
- Osvaldo Da Silveira Pedrosa Júnior (04/02)
- Fernando Magalhães Ferreira (04/02)
- Raimundo Nonato de Sousa Rosal (04/02)
- Rejane Sena Ferreira (04/02)
- Rusmar Dueti (04/02)
- Claudia Brito Martins (03/02)
- cleano melo (03/02)
- Alexandre Vinícius de Oliveira (03/02)
- Maria (03/02)
- Mazen Hassan Baja (03/02)
- ... e mais 20+ registros

**Janeiro 2026:**
- Gregorio (31/01 → 02/02)
- Anna Paula (21/01 → 28/01)
- Nadiel Todescatt (22/01 → 03/02)
- André Laface (28/01 → 30/01)
- Lucas Falvela (28/01 → 29/01)
- ... e mais 30+ registros

---

## Verificação Pós-Correção

Após executar o SQL, rode esta query para confirmar:

```sql
-- Verificar se ainda existem registros com data de reunião
SELECT COUNT(*) as registros_pendentes
FROM meeting_slot_attendees msa
JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
WHERE msa.status IN ('contract_paid', 'refunded')
  AND ms.scheduled_at >= '2026-01-01'
  AND msa.contract_paid_at = ms.scheduled_at;
-- Esperado: 0 ou poucos (registros sem match na Hubla)
```

---

## Impacto nas Métricas

Após a correção:
- **Contratos Pagos por dia**: Refletirá a data real do pagamento
- **Métricas de Closer**: Atribuição correta ao mês do fechamento financeiro
- **Follow-ups**: Vendas de follow-up serão creditadas na data certa

---

## Próximos Passos

1. **Execute o SQL principal** no Supabase
2. **Rode a verificação** para confirmar
3. **Recarregue a página** de métricas para ver os números atualizados

