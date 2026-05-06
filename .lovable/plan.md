## Reclassificar Ricardo Gomes Vendeth como Outside (não conta para o Closer)

### Regra do sistema
A lógica de Outside é simples: **`contract_paid_at < scheduled_at`** (ver `useCloserContractsList.ts` linha 87). Quando o contrato foi pago antes da R1, o sistema:
- ✅ Exclui da conversão/contratos do Closer
- ✅ Mantém o `contract_paid` no attendee (lead aparece como ganho na agenda)
- ✅ Atribui ao SDR como Outside (via `useOutsideDetectionBatch`/`useSdrOutsideMetrics` quando há transação Hubla)

### Estado atual (problema)
- `scheduled_at` = 2026-04-28 18:30:00
- `contract_paid_at` = 2026-04-28 18:30:00 (igual → conta como Closer)

### Ação
Antecipar `contract_paid_at` para 1 dia antes da R1, garantindo que `contract_paid_at < scheduled_at`:

- Attendee `ebc92763-908e-44c6-b590-73284be3d11b`
- Novo `contract_paid_at` = **2026-04-27 18:30:00+00** (1 dia antes da R1)
- Mantém `status = 'contract_paid'`
- Mantém deal no estágio "Contrato Pago"

### Resultado
- ❌ NÃO entra na conversão do Closer (Thaynara)
- ✅ Aparece como Contrato Pago no funil/lead
- ⚠️ Para entrar nas métricas de Outside do SDR ainda precisaria de uma `hubla_transactions` vinculada (não foi solicitado agora)

### Execução
1 migration de UPDATE em `meeting_slot_attendees`. Sem alteração de código.
