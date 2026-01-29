
# Plano: Adicionar Botão de Reembolso na Lista de Pendentes R2

## Contexto

Na aba "Pendentes" da Agenda R2, existem leads com "Contrato Pago" vindos de R1 que ainda não têm R2 agendada. Alguns desses leads são, na verdade, reembolsos antigos que precisam ser tratados. O usuário quer um botão "Reembolso" ao lado do "Agendar R2" para processar esses casos.

**Fluxo desejado:**
1. Clicar no botão "Reembolso"
2. Abrir modal solicitando motivo e justificativa
3. Processar o reembolso (marcar deal como perdido, setar flags)
4. Remover o lead da lista de pendentes

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/components/crm/R2PendingLeadsPanel.tsx` | **Modificar** - Adicionar botão de Reembolso e integrar com RefundModal |

---

## Alterações

### R2PendingLeadsPanel.tsx

#### 1. Adicionar imports necessários

```typescript
import { RotateCcw } from 'lucide-react';
import { RefundModal } from './RefundModal';
```

#### 2. Adicionar estados para o modal de reembolso

```typescript
const [refundModalOpen, setRefundModalOpen] = useState(false);
const [refundLead, setRefundLead] = useState<R2PendingLead | null>(null);
```

#### 3. Criar handler para abrir o modal de reembolso

```typescript
const handleRefund = (lead: R2PendingLead) => {
  setRefundLead(lead);
  setRefundModalOpen(true);
};
```

#### 4. Adicionar botão de Reembolso ao lado do "Agendar R2"

Modificar a área de botões de ação para incluir dois botões:

```tsx
{/* Action Buttons */}
<div className="flex items-center gap-2 shrink-0">
  <Button 
    size="sm" 
    variant="outline"
    className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
    onClick={(e) => {
      e.stopPropagation();
      handleRefund(lead);
    }}
  >
    <RotateCcw className="h-4 w-4 mr-1" />
    Reembolso
  </Button>
  <Button 
    size="sm" 
    className="bg-purple-600 hover:bg-purple-700"
    onClick={(e) => {
      e.stopPropagation();
      handleScheduleR2(lead);
    }}
  >
    <Calendar className="h-4 w-4 mr-1" />
    Agendar R2
    <ArrowRight className="h-4 w-4 ml-1" />
  </Button>
</div>
```

#### 5. Adaptar o RefundModal para leads da R1

O `RefundModal` atual espera um `meetingId` de R2. Para leads pendentes (vindos de R1), precisamos passar o `meeting_slot.id` da R1 e adaptar o fluxo:

```tsx
{/* Refund Modal */}
<RefundModal
  open={refundModalOpen}
  onOpenChange={(open) => {
    setRefundModalOpen(open);
    if (!open) setRefundLead(null);
  }}
  meetingId={refundLead?.meeting_slot?.id || ''}
  dealId={refundLead?.deal?.id || null}
  dealName={refundLead?.attendee_name || refundLead?.deal?.name}
  currentCustomFields={undefined}
  onSuccess={() => {
    // RefundModal já invalida as queries necessárias
    // O lead sumirá da lista porque o status será alterado
  }}
/>
```

**Problema identificado:** O `RefundModal` usa `useUpdateR2MeetingStatus` que atualiza `meeting_slots` para R2. Para R1, precisamos apenas:
1. Atualizar o attendee status para 'refunded'
2. Marcar o deal como perdido com flags de reembolso

#### 6. Criar versão adaptada do RefundModal OU modificar o existente

Como o fluxo é similar mas atua em R1, a melhor solução é **criar um hook dedicado** ou **modificar o RefundModal** para aceitar um parâmetro `meetingType`:

**Opção A (recomendada):** Modificar o `RefundModal` para aceitar `meetingType` e usar lógica condicional:

```typescript
// RefundModal.tsx - adicionar prop
interface RefundModalProps {
  // ... props existentes
  meetingType?: 'r1' | 'r2';  // Default: 'r2'
}

// Na lógica do handleConfirm:
if (meetingType === 'r1') {
  // Para R1: atualizar status do attendee para 'refunded'
  await supabase
    .from('meeting_slot_attendees')
    .update({ status: 'refunded' })
    .eq('meeting_slot_id', meetingId);
} else {
  // Para R2: comportamento atual (atualiza meeting_slots)
  await updateMeetingStatus.mutateAsync({ meetingId, status: 'refunded' });
}
```

E adicionar invalidação da query de pendentes:

```typescript
queryClient.invalidateQueries({ queryKey: ['r2-pending-leads'] });
```

---

## Fluxo Final

```text
Usuário clica "Reembolso" em lead pendente
│
├── Abre RefundModal com meetingType='r1'
├── Usuário seleciona motivo e justificativa
│
└── handleConfirm:
    ├── Atualiza attendee.status = 'refunded'
    ├── Move deal para stage "Perdido"
    ├── Seta flags no custom_fields (reembolso_solicitado, motivo, etc)
    ├── Registra atividade no deal
    │
    └── Invalida query 'r2-pending-leads'
        └── Lead some da lista ✓
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Apenas botão "Agendar R2" | Dois botões: "Reembolso" (laranja) + "Agendar R2" (roxo) |
| Leads antigos reembolsados aparecem na lista | Podem ser marcados como reembolso e removidos |

---

## Impacto

- **Lista de Pendentes**: Leads reembolsados serão removidos (status não será mais 'contract_paid')
- **CRM Deals**: Serão movidos para "Perdido" com flag de reembolso
- **Métricas**: Reembolsos serão rastreados corretamente
- **R1 Meetings**: Status do attendee será atualizado para 'refunded'
