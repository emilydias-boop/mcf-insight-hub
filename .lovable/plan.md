

## Corrigir SDR mostrando nome do Closer em vez do SDR real

### Problema
O campo SDR no Controle Diego usa `crm_deals.owner_id` para identificar o SDR, mas em alguns deals esse campo contém o email do **closer** (ex: Cristiane Gomes) em vez do SDR real. O drawer (`useLeadJourney`) resolve corretamente usando `booked_by` da R1, que é quem de fato agendou a reunião (o SDR verdadeiro: Caroline Aparecida Corrêa).

### Solução
Alterar `useContractReport.ts` para usar a mesma lógica do `useLeadJourney`: priorizar o `booked_by` do attendee como SDR, caindo para `owner_id` apenas como fallback.

### Alterações — `src/hooks/useContractReport.ts`

1. **Adicionar `booked_by`** na query do `meeting_slot_attendees`:
   ```
   select: ..., booked_by, ...
   ```

2. **Coletar todos os `booked_by` UUIDs** dos attendees e buscar seus nomes na tabela `profiles` (por `id`).

3. **Na transformação dos dados**, priorizar o `booked_by` como SDR:
   ```
   const sdrEmail = bookedByProfile?.email || deal?.owner_id || '';
   const sdrName = bookedByProfile?.full_name || sdrNameMap[sdrEmail] || sdrEmail;
   ```

### Lógica resumida
```text
Antes:  SDR = deal.owner_id (pode ser o closer)
Depois: SDR = booked_by do attendee → fallback deal.owner_id
```

### Arquivo modificado
- `src/hooks/useContractReport.ts`

