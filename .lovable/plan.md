

# Corrigir campo "SDR" na Jornada do Lead

## Problema
O campo "SDR" na Jornada do Lead mostra o dono atual do deal (`deal.owner_id`), que apos a transferencia para o Closer passa a ser o proprio Closer. No exemplo, mostra "Thaynar Dos Santos Tavares" quando deveria mostrar "Leticia Nunes dos Santos" (quem agendou a R1).

## Solucao
Alterar o hook `useLeadJourney.ts` para derivar o SDR a partir do `booked_by` da reuniao R1, em vez do `deal.owner_id`.

A logica fica:
1. Primeiro, buscar as reunioes (R1 e R2) como ja faz hoje
2. Se existir uma R1 com `booked_by`, usar esse usuario como SDR
3. Fallback: se nao houver R1 ou `booked_by`, manter o `deal.owner_id` como fonte

## Secao tecnica

### Arquivo: `src/hooks/useLeadJourney.ts`

**Mudanca principal**: Reordenar a logica para processar as reunioes primeiro, e depois derivar o SDR.

1. Mover o bloco de busca do SDR (linhas 44-83) para **depois** do processamento das reunioes (apos linha 200)
2. Substituir a logica do SDR:
   - Se `r1Meeting.bookedBy` existir, usar como SDR (nome e email)
   - Senao, fallback para `deal.owner_id` (comportamento atual)

```text
Antes:  deal.owner_id -> profiles -> SDR (incorreto apos transferencia)
Depois: R1.booked_by -> profiles -> SDR (sempre quem agendou)
        Fallback: deal.owner_id (se nao houver R1)
```

Nenhum outro arquivo precisa ser alterado - o componente `LeadJourneyCard.tsx` ja exibe `journey.sdr.name` e `journey.sdr.email` corretamente.
