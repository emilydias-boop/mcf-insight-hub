
# Correção: Agendamentos Noturnos do SDR Contando no Dia Errado

## Problema Identificado

Quando um SDR agenda um lead às **21:00 ou mais tarde** (horário de Brasília), o sistema conta esse agendamento para o **dia seguinte** em vez do dia correto.

### Evidência no Banco de Dados

| created_at (UTC) | Horário BRT | Data UTC | Data BRT (correta) |
|------------------|-------------|----------|-------------------|
| 2026-02-01 01:02:36 | 22:02:36 | **01/02** | **31/01** |
| 2026-02-01 00:22:51 | 21:22:51 | **01/02** | **31/01** |
| 2026-01-31 01:13:16 | 22:13:16 | **31/01** | **30/01** |
| 2026-01-30 02:31:03 | 23:31:03 | **30/01** | **29/01** |

### Causa Raiz

A função SQL `get_sdr_metrics_from_agenda` usa o operador `::date` que converte timestamps para UTC, não para o fuso horário de Brasília:

```sql
-- PROBLEMA: Converte para data UTC
COALESCE(msa.booked_at, msa.created_at)::date >= start_date::DATE
```

Quando o SDR agenda às 22:00 BRT (que é 01:00 UTC do dia seguinte), o `::date` retorna o dia UTC, não o dia brasileiro.

---

## Solução

Atualizar a função SQL `get_sdr_metrics_from_agenda` para converter todos os timestamps para o timezone **America/Sao_Paulo** antes de extrair a data.

### Alteração na Função SQL

Substituir todas as ocorrências de `timestamp::date` por `(timestamp AT TIME ZONE 'America/Sao_Paulo')::date`:

```sql
-- ANTES (Incorreto - usa UTC)
COALESCE(msa.booked_at, msa.created_at)::date >= start_date::DATE

-- DEPOIS (Correto - usa Brasília)
(COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE
```

---

## Campos Afetados na Função

| Campo | Uso | Correção |
|-------|-----|----------|
| `booked_at` | Contagem de agendamentos do SDR | Converter para BRT |
| `created_at` | Fallback quando booked_at é nulo | Converter para BRT |
| `scheduled_at` | Data da reunião (R1 Agendada, Realizada, No-show) | Converter para BRT |
| `contract_paid_at` | Data do pagamento do contrato | Converter para BRT |

---

## Arquivo a Criar

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/[timestamp]_fix_sdr_metrics_timezone.sql` | **Criar** - Nova migration com a função corrigida |

---

## Resultado Esperado

- Agendamentos feitos às 21:00+ BRT serão contados no dia correto (dia em que o SDR trabalhou)
- Métricas do "Painel SDR" e "Minhas Reuniões" mostrarão contagens corretas
- Não afeta dados históricos - a correção recalcula corretamente

---

## Seção Técnica

### Função Atualizada (Trecho Principal)

```sql
CREATE OR REPLACE FUNCTION public.get_sdr_metrics_from_agenda(
  start_date text, 
  end_date text, 
  sdr_email_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  result JSON;
BEGIN
  WITH sdr_stats AS (
    SELECT 
      p.email as sdr_email,
      COALESCE(p.full_name, p.email) as sdr_name,
      -- Agendamentos: usar timezone de Brasília
      COUNT(CASE 
        WHEN (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date 
             >= start_date::DATE 
         AND (COALESCE(msa.booked_at, msa.created_at) AT TIME ZONE 'America/Sao_Paulo')::date 
             <= end_date::DATE
         AND (/* regras de original vs reagendamento */)
        THEN 1 
      END) as agendamentos,
      -- R1 Agendada: usar timezone de Brasília
      COUNT(CASE 
        WHEN (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date >= start_date::DATE 
         AND (ms.scheduled_at AT TIME ZONE 'America/Sao_Paulo')::date <= end_date::DATE 
        THEN 1 
      END) as r1_agendada,
      -- ... demais campos com a mesma correção
```

### Por Que na Função SQL?

A correção precisa ser feita no banco porque:

1. O frontend já envia datas no formato `yyyy-MM-dd` (sem hora)
2. A comparação de datas acontece dentro do PostgreSQL
3. Corrigir apenas no frontend não resolveria o problema do `::date`

### Impacto em Outras Funções

Será necessário revisar outras RPCs que usam lógica similar de datas, mas esta correção foca na `get_sdr_metrics_from_agenda` que é a fonte de dados para:

- Painel SDR (TeamGoalsPanel)
- Minhas Reuniões (useMinhasReunioesFromAgenda)
- Fechamento SDR (recalculate-sdr-payout)
