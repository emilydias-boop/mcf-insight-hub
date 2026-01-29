
# Plano: Sincronizar Contagem de Contratos SDR com Closers + Incluir Reembolsos

## Resumo do Problema

A contagem de contratos está inconsistente entre as abas SDRs e Closers no Painel Comercial:

| Fonte | Lógica Atual | Resultado 28/01 |
|-------|--------------|-----------------|
| Closers | `contract_paid_at` (data do pagamento) | 15 contratos |
| SDRs | `scheduled_at` (data da reunião) | 8 contratos |
| Diferença | Follow-ups não contados para SDRs | 7 contratos |

Além disso, reembolsos (status `refunded`) não estão sendo contabilizados no total de contratos.

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Nova Migration SQL | **Criar** - Atualizar função `get_sdr_metrics_from_agenda` |

---

## Solução Técnica

### Alteração na Função SQL

A função `get_sdr_metrics_from_agenda` será atualizada para:

1. **Contar contratos pela data do pagamento** (`contract_paid_at`), igual aos closers
2. **Fallback para `scheduled_at`** quando `contract_paid_at` é nulo (registros antigos)
3. **Incluir status `refunded`** no total de contratos

A lógica de contagem de contratos muda de:

```sql
-- ANTES: Conta apenas por scheduled_at
COUNT(CASE WHEN ms.scheduled_at::date >= start_date::DATE 
            AND ms.scheduled_at::date <= end_date::DATE 
            AND msa.status = 'contract_paid' THEN 1 END) as contratos
```

Para:

```sql
-- DEPOIS: Conta por contract_paid_at com fallback + inclui refunded
COUNT(CASE 
  WHEN msa.status IN ('contract_paid', 'refunded')
   AND (
     -- Contratos COM timestamp: usar data do pagamento
     (msa.contract_paid_at IS NOT NULL 
      AND msa.contract_paid_at::date >= start_date::DATE 
      AND msa.contract_paid_at::date <= end_date::DATE)
     -- Fallback para contratos antigos: usar scheduled_at
     OR (msa.contract_paid_at IS NULL 
         AND ms.scheduled_at::date >= start_date::DATE 
         AND ms.scheduled_at::date <= end_date::DATE)
   ) 
  THEN 1 
END) as contratos
```

---

## Resultado Esperado

Após a implementação:

| Métrica | Antes | Depois |
|---------|-------|--------|
| KPI Card "Contratos" SDR | 8 | 15+ (inclui follow-ups e reembolsos) |
| Aba SDRs - Total | 8 | 15+ |
| Aba Closers - Total | 15 | 15 (sem alteração) |

**Importante:** Reembolsos como o caso do Danilo Soares agora serão contabilizados no total de contratos dos SDRs.

---

## Fluxo de Atribuição

```text
Pagamento Contrato (Webhook)
├── Marca attendee como contract_paid
├── Preenche contract_paid_at = NOW()
│
└── Contagem de Métricas
    ├── Closers: Usa contract_paid_at ✓
    └── SDRs: Usa contract_paid_at ✓ (após correção)
        └── Fallback: scheduled_at (se nulo)
```

---

## Detalhes Técnicos

A migration completa irá recriar a função `get_sdr_metrics_from_agenda` mantendo toda a lógica existente de:
- Contagem de agendamentos (por `booked_at`)
- Contagem de R1 Agendada (por `scheduled_at`)
- Contagem de R1 Realizada (por `scheduled_at`)
- Contagem de No-Shows (por `scheduled_at`)
- Regras de deduplicação (originais + 1º reagendamento apenas)

E alterando apenas a contagem de contratos para:
- Usar `contract_paid_at` quando disponível
- Fallback para `scheduled_at` quando nulo
- Incluir status `refunded` além de `contract_paid`

---

## Impacto em Outros Componentes

Esta alteração afeta apenas a função SQL. Os seguintes componentes continuarão funcionando normalmente:

- `useTeamMeetingsData.ts` - Consome a RPC sem alterações
- `useSdrMetricsFromAgenda.ts` - Consome a RPC sem alterações
- Painel SDR (aba SDRs) - Mostrará números corretos automaticamente
- KPI Cards - Mostrarão totais corretos automaticamente
- `recalculate-sdr-payout` Edge Function - Usará dados corretos

---

## Próximos Passos Sugeridos (pós-implementação)

1. **Verificar no painel** se os 15 contratos agora aparecem para SDRs
2. **Verificar caso Danilo Soares** (reembolso) se aparece na contagem
3. **Relatório de inconsistências** - Listar contratos Make dos últimos 30 dias sem match
