
# Plano: Vincular Contrato Manualmente a Lead R1

## Cenário do Problema

| Situação | Descrição |
|----------|-----------|
| **Lead R1** | Igor Willian Silveira Pinto - R1 concluída em 27/01 com Julio |
| **Pagamento** | Claudia Frigeri Caggiani (esposa) pagou o contrato R$ 497 em 29/01 |
| **Resultado** | Sistema não consegue vincular automaticamente (email/telefone diferentes) |
| **Impacto** | Lead não aparece como "Contrato Pago", não pode ter R2 agendada |

---

## Solução Proposta

Criar uma funcionalidade para **vincular manualmente** transações de contrato (R$ 497) a attendees R1, similar ao que já existe para vendas de parcerias no R2 Carrinho.

### Duas opções de implementação:

**Opção A: Dialog no Painel de Contratos Pendentes**
- Adicionar botão "Vincular a Lead" nas linhas de contratos pendentes
- Abrir dialog para buscar leads R1 (similar ao `LinkAttendeeDialog`)
- Ao vincular, atualizar `hubla_transactions.linked_attendee_id` E marcar o attendee como `contract_paid`

**Opção B: Dialog no drawer do Lead R1** (Recomendado)
- Adicionar botão "Vincular Contrato" no drawer de reunião R1 para leads sem contrato pago
- Abrir dialog mostrando contratos pendentes que podem ser vinculados
- Permite ao closer vincular diretamente do contexto do lead

---

## Implementação Recomendada (Opção B)

### Componentes Necessários

| Componente | Descrição |
|------------|-----------|
| `LinkContractDialog` | Novo dialog para buscar e vincular contratos pendentes a um attendee R1 |
| Hook `useUnlinkedContracts` | Novo hook para buscar contratos (categoria 'contrato') sem vinculação |
| Hook `useLinkContractToAttendee` | Novo hook para vincular contrato + marcar attendee como contract_paid |

### Fluxo de Uso

```text
1. Closer abre o drawer de reunião R1 do Igor Willian
2. Status ainda é "Realizada" (não Contrato Pago)
3. Closer clica em "Vincular Contrato" 
4. Dialog abre com lista de contratos pendentes (últimos 14 dias)
5. Closer busca "Claudia" ou pelo telefone
6. Encontra a transação de R$ 497 da Claudia Frigeri
7. Clica em "Vincular"
8. Sistema:
   a) Atualiza hubla_transactions.linked_attendee_id → Igor
   b) Atualiza meeting_slot_attendees.status → 'contract_paid'
   c) Atualiza meeting_slot_attendees.contract_paid_at → agora
   d) Move deal para estágio "Contrato Pago"
9. Lead agora aparece no painel "R2 Pendentes"
```

---

## Arquivos a Criar

| Arquivo | Propósito |
|---------|-----------|
| `src/hooks/useUnlinkedContracts.ts` | Buscar contratos pendentes (product_category = 'contrato', linked_attendee_id IS NULL) |
| `src/hooks/useLinkContractToAttendee.ts` | Vincular contrato + marcar contract_paid |
| `src/components/crm/LinkContractDialog.tsx` | Dialog para buscar e vincular contratos |

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/AgendaMeetingDrawer.tsx` | Adicionar botão "Vincular Contrato" para leads completed sem contract_paid |

---

## Detalhes Técnicos

### useUnlinkedContracts.ts

```typescript
// Buscar contratos pendentes (sem vinculação) dos últimos 14 dias
const { data, error } = await supabase
  .from('hubla_transactions')
  .select('id, hubla_id, customer_name, customer_email, customer_phone, sale_date, net_value')
  .eq('product_category', 'contrato')
  .is('linked_attendee_id', null)
  .gte('sale_date', twoWeeksAgo.toISOString())
  .order('sale_date', { ascending: false });
```

### useLinkContractToAttendee.ts

```typescript
async function linkContract({ transactionId, attendeeId }: LinkParams) {
  // 1. Vincular transação ao attendee
  await supabase
    .from('hubla_transactions')
    .update({ linked_attendee_id: attendeeId })
    .eq('id', transactionId);

  // 2. Atualizar attendee para contract_paid
  await supabase
    .from('meeting_slot_attendees')
    .update({ 
      status: 'contract_paid',
      contract_paid_at: new Date().toISOString()
    })
    .eq('id', attendeeId);

  // 3. Atualizar slot para completed (se necessário)
  // 4. Mover deal para estágio "Contrato Pago"
}
```

### LinkContractDialog.tsx

- Input de busca por nome, email ou telefone
- Lista de contratos pendentes filtráveis
- Cada item mostra: Nome do pagador, valor, data, telefone
- Botão "Vincular" em cada item

### Modificação no AgendaMeetingDrawer

Adicionar botão quando:
- `meeting.status === 'completed'` ou `attendee.status === 'completed'`
- `attendee.status !== 'contract_paid'`

```tsx
{attendee.status === 'completed' && attendee.status !== 'contract_paid' && (
  <Button variant="outline" onClick={() => setLinkContractOpen(true)}>
    <Link2 className="h-4 w-4 mr-2" />
    Vincular Contrato
  </Button>
)}
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Igor Willian aparece como "Realizada" | Igor aparece como "Contrato Pago" |
| Não aparece no painel "R2 Pendentes" | Aparece no painel "R2 Pendentes" |
| Contrato da Claudia fica "Pendente" | Contrato vinculado ao Igor |
| Não pode agendar R2 | Pode agendar R2 normalmente |

---

## Observação

Esta solução também pode ser usada para:
- Pagamentos feitos por sócios
- Pagamentos em nome de empresas
- Pagamentos com email/telefone errado
- Qualquer situação onde o matching automático falha

