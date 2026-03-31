

## Problema: "Contrato Pago" aparecendo na BU Consórcio

### Causa raiz

O botão "Vincular Contrato" no drawer da agenda (`AgendaMeetingDrawer.tsx`, linha 1029) é exibido para **qualquer BU** quando o status do participante é `completed`. Não há verificação de `activeBU !== 'consorcio'`.

No Consórcio, o fluxo pós-reunião é diferente: não existe venda de contrato via Hubla. O resultado da reunião é gerenciado na aba "Pós-Reunião" (proposta enviada, aceita, etc.). Porém, como o botão estava disponível, alguém vinculou um contrato ao lead "Luiz Guilherme" e ele foi marcado como `contract_paid`.

Além disso, o filtro de status na página Agenda (`Agenda.tsx`, linha 383) já oculta corretamente a opção "Contrato Pago" para Consórcio, mas o drawer da reunião não aplica a mesma restrição.

### Correções

**1. Ocultar botão "Vincular Contrato" no Consórcio**
**Arquivo**: `src/components/crm/AgendaMeetingDrawer.tsx` (linha 1029)

Adicionar `activeBU !== 'consorcio'` à condição:
```
{!isSdr && activeBU !== 'consorcio' && selectedParticipant.status === 'completed' && (
```

**2. Bloquear `useLinkContractToAttendee` para deals de Consórcio (defesa em profundidade)**
**Arquivo**: `src/hooks/useLinkContractToAttendee.ts`

Antes de linkar, verificar se o `origin_id` do deal pertence a uma pipeline de Consórcio. Se sim, bloquear com erro "Consórcio não utiliza vinculação de contrato".

**3. Corrigir o lead afetado (dado já corrompido)**

O lead "Luiz Guilherme Simões de Souza" já está com status `contract_paid` na agenda do Consórcio. Isso precisará ser corrigido manualmente no banco (reverter para `completed`) ou via uma ação na UI.

### Arquivos afetados
- `src/components/crm/AgendaMeetingDrawer.tsx` — Ocultar botão para Consórcio
- `src/hooks/useLinkContractToAttendee.ts` — Validação de BU no backend

