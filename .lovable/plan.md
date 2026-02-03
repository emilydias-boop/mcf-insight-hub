
# Plano: Botão de Edição/Transferência de Participante Individual na Agenda R2

## Contexto

Atualmente, o sistema possui:
- **R2RescheduleModal**: Reagenda a **reunião inteira** (meeting_slot) com todos os participantes
- **R2MeetingDetailDrawer**: Mostra lista de participantes com botão de remover (lixeira)

O usuário precisa de uma funcionalidade para **transferir um participante individual** para outro dia, horário e/ou closer, sem afetar os demais participantes da reunião.

---

## Solução Proposta

Adicionar um **botão de edição (lápis)** ao lado do botão de lixeira em cada participante no drawer, que abre um modal de transferência individual.

```text
+------------------------------------------+
|  [Avatar] Francisco Antonio da Silva     |
|          Contrato Pago  Selecionado      |
|          +5511984768433                  |
|                              [✏️] [🗑️]   |  <-- Novo botão de edição
+------------------------------------------+
```

---

## Arquitetura da Solução

```text
                   R2MeetingDetailDrawer
                           |
    +----------------------+----------------------+
    |                      |                      |
Botão Lixeira      Botão Edição (NOVO)    Botão Realizada
    |                      |                      |
    v                      v                      v
handleRemoveAttendee   Abre Modal          handleStatusChange
                           |
                           v
              R2AttendeeTransferModal (NOVO)
                           |
    +----------------------+----------------------+
    |                      |                      |
Selecionar          Selecionar           Selecionar
Closer              Data                 Horário
    |                      |                      |
    +----------------------+----------------------+
                           |
                           v
              useTransferR2Attendee (NOVO hook)
                           |
    +----------------------+----------------------+
    |                                             |
Remove attendee                           Cria/adiciona a
do slot atual                             novo slot
```

---

## Arquivos a Criar/Modificar

### 1. Novo Componente: `R2AttendeeTransferModal.tsx`
Modal para transferir um participante individual com:
- Seletor de Closer R2
- Seletor de Data (Calendar)
- Seletor de Horário (baseado em slots disponíveis do closer)
- Campo de observação/motivo

### 2. Novo Hook: `useTransferR2Attendee.ts`
Lógica para:
1. Verificar se já existe um slot no horário de destino
2. Se existir, adicionar o attendee ao slot existente
3. Se não existir, criar novo slot e adicionar o attendee
4. Remover o attendee do slot original
5. Atualizar `deal_activities` para auditoria

### 3. Modificar: `R2MeetingDetailDrawer.tsx`
- Adicionar botão de edição (ícone `Pencil` ou `ArrowRightLeft`)
- Estado para controlar o modal de transferência
- Passar referência do attendee selecionado ao modal
- **Condição**: Botão visível apenas para roles `admin`, `manager`, `coordenador`

---

## Detalhes Técnicos

### Fluxo de Transferência

```text
1. Admin clica no botão de edição do participante "Francisco"
2. Modal abre com dados atuais (closer, data, horário)
3. Admin seleciona novo closer: "Maria"
4. Admin seleciona nova data: "10/02/2026"
5. Admin seleciona horário disponível: "14:00"
6. Sistema executa:
   a) SELECT para verificar se existe slot em 10/02 14:00 com Maria
   b) Se não existe: INSERT meeting_slots (criar novo)
   c) UPDATE meeting_slot_attendees SET meeting_slot_id = novo_slot
   d) Se slot original ficou vazio: DELETE/atualizar status
   e) INSERT deal_activities (log de auditoria)
```

### Permissões

O botão de transferência será visível apenas para:
- `admin`
- `manager`  
- `coordenador`

Closers comuns não poderão transferir participantes (apenas visualizar).

---

## Interface do Modal

```text
+----------------------------------------+
|  Transferir Participante               |
+----------------------------------------+
|                                        |
|  Francisco Antonio da Silva            |
|  +5511984768433                         |
|  Atual: 05/02 às 10:00 com João        |
|                                        |
|  ┌─────────────────────────────────┐   |
|  │ Novo Closer R2                  │   |
|  │ [Maria Santos            ▼]    │   |
|  └─────────────────────────────────┘   |
|                                        |
|  ┌──────────────┐ ┌────────────────┐   |
|  │ Nova Data    │ │ Horário        │   |
|  │ [10/02/2026] │ │ [14:00    ▼]  │   |
|  └──────────────┘ └────────────────┘   |
|                                        |
|  ┌─────────────────────────────────┐   |
|  │ Motivo (opcional)               │   |
|  │ [Cliente mudou disponibilidade] │   |
|  └─────────────────────────────────┘   |
|                                        |
|         [Cancelar]  [Transferir]       |
+----------------------------------------+
```

---

## Estimativa de Alterações

| Arquivo | Ação | Linhas |
|---------|------|--------|
| `src/components/crm/R2AttendeeTransferModal.tsx` | Criar | ~200 |
| `src/hooks/useTransferR2Attendee.ts` | Criar | ~120 |
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Modificar | ~30 |

---

## Observações

1. **Slot vazio**: Se após a transferência o slot original ficar sem participantes, ele pode ser mantido como "vazio" ou deletado automaticamente
2. **Capacidade**: A transferência respeitará o `max_leads_per_slot` do closer de destino
3. **Auditoria**: Toda transferência será registrada em `deal_activities` com tipo `attendee_transferred`
4. **Cross-BU**: O sistema já possui lógica de conflito cross-BU que será respeitada na validação de horários
