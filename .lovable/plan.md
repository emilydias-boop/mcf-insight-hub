

## Diagnóstico: Reembolsos não aparecem

O problema é que a classificação de "Reembolso" verifica apenas `r1Status === 'refunded'`, mas na prática o status do R1 attendee **nem sempre é atualizado** quando o reembolso ocorre na Hubla.

Dados encontrados:
- **Andre Ricci**: R1 status = `refunded` ✅ → aparece como Reembolso
- **Marco Aurélio Cunta**: R1 status = `contract_paid`, R2 status = `completed` → classificado como "Realizada" em vez de "Reembolso"
- **Monique Andrade**: R1 status = `contract_paid`, R2 status = `completed` → idem

O reembolso está registrado em `hubla_transactions.sale_status = 'refunded'`, mas o hook não consulta essa tabela.

## Solução

Adicionar uma consulta a `hubla_transactions` para detectar reembolsos pela data de `contract_paid_at` e email/deal, e usar essa informação na classificação.

### Alterações em `src/hooks/useContractLifecycleReport.ts`

1. **Novo Step**: Após buscar R1 attendees, coletar os `contract_paid_at` timestamps e buscar em `hubla_transactions` registros com `sale_status = 'refunded'` e `product_name LIKE '%Contrato%'` no período da safra
2. **Criar mapa de reembolsos**: por `deal_id` (via email matching com `crm_contacts`) ou diretamente por `linked_attendee_id`
3. **Atualizar `classifySituacao`**: aceitar um parâmetro `isRefunded: boolean` e verificar **antes** dos outros checks — se `isRefunded` ou `r1Status === 'refunded'`, classificar como Reembolso

Abordagem mais simples: buscar transações refunded no período, cruzar pelo `customer_email` com os contatos dos deals dos R1 attendees.

### Fluxo

```text
1. Buscar R1 attendees (já existe)
2. Buscar hubla_transactions refunded no período da safra
3. Cruzar por email: deal → crm_contacts.email vs hubla_transactions.customer_email
4. Marcar isRefunded = true para matches
5. classifySituacao prioriza isRefunded sobre qualquer outro status
```

### Alterações no Panel (nenhuma)

O badge e KPIs já tratam `situacao === 'reembolso'` corretamente. A correção é apenas no hook de dados.

