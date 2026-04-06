

# Substituir "Vendas Parceria" por "Contratos Pagos" para Closers

## Problema

Na página de fechamento de um Closer, a seção "Vendas Parceria" aparece vazia e não é útil. O que o Closer precisa ver é a **lista de contratos pagos** com:
- Nome do lead
- SDR que trouxe (quem agendou a R1 — `booked_by`)
- Data da reunião (`scheduled_at`)
- Data do pagamento (`contract_paid_at`)

## Solução

### Arquivo 1: `src/hooks/useCloserContractsList.ts` (novo)

Hook que busca os contratos pagos do closer no mês:
1. Resolve `sdr_id` → email → `closer_id`
2. Busca `meeting_slot_attendees` com `status in (contract_paid, refunded)` e `contract_paid_at` no período, joined com `meeting_slots` do closer
3. Para cada contrato, busca o `booked_by` (UUID) da R1 correspondente ao deal e resolve o nome via `profiles`
4. Retorna array com: `leadName`, `sdrName`, `meetingDate`, `contractPaidAt`

### Arquivo 2: `src/components/sdr-fechamento/CloserContractsList.tsx` (novo)

Componente de tabela simples que renderiza os contratos:
- Colunas: Lead | SDR | Data Reunião | Data Contrato
- Total no rodapé
- Sem botão de adicionar (dados automáticos da Agenda)

### Arquivo 3: `src/pages/fechamento-sdr/Detail.tsx`

Substituir o bloco de `IntermediacoesList` para closers:
```tsx
{fromBu !== 'consorcio' && (
  isCloser 
    ? <CloserContractsList sdrId={payout.sdr_id} anoMes={payout.ano_mes} />
    : <IntermediacoesList sdrId={payout.sdr_id} anoMes={payout.ano_mes} disabled={!canEdit} isCloser={false} />
)}
```

## Resultado esperado
- Closers veem a lista completa de contratos com SDR, data da reunião e data do pagamento
- SDRs continuam vendo "Intermediações de Contrato" normalmente
- Consórcio continua sem exibir nenhuma das duas seções

