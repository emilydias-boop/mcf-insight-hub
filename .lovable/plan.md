

# Calendário de Dias Úteis separado para SDR e Closer

## Problema
Março foi atípico: SDRs não trabalharam dia 31, mas Closers fizeram reuniões. Precisa de um calendário visual onde se seleciona os dias específicos de cada cargo, e o sistema calcula automaticamente a contagem.

## Solução

Adicionar uma coluna `dias_uteis_closer` à tabela `working_days_calendar`. Na UI, o dialog de edição ganha dois mini-calendários visuais (um para SDR, outro para Closer) onde se marca/desmarca dias individualmente. O total é calculado automaticamente a partir dos dias selecionados.

### 1. Migration — nova coluna
```sql
ALTER TABLE working_days_calendar 
  ADD COLUMN dias_uteis_closer INTEGER DEFAULT NULL;
```
Quando `dias_uteis_closer` é NULL, o sistema usa `dias_uteis_final` para ambos (comportamento atual preservado).

### 2. UI — WorkingDaysCalendar.tsx

**Tabela principal**: adicionar coluna "Dias Closer" entre "Dias Final" e "R$/Dia". Mostra o valor ou "-" quando NULL.

**Dialog de edição**: substituir os campos numéricos simples por dois mini-calendários lado a lado:
- **Calendário SDR**: mostra o mês, dias úteis pré-selecionados (baseado em `dias_uteis_final`). Clicar em um dia adiciona/remove. O total aparece abaixo: "20 dias úteis SDR".
- **Calendário Closer**: idem, inicializa com `dias_uteis_closer ?? dias_uteis_final`. Total: "21 dias úteis Closer".
- Os calendários usam o componente `Calendar` já existente com `mode="multiple"`, destacando dias selecionados vs não-selecionados.
- Feriados nacionais e fins de semana ficam desabilitados por padrão mas podem ser habilitados manualmente.
- Ao salvar, grava `dias_uteis_final` = count dos dias SDR selecionados e `dias_uteis_closer` = count dos dias Closer selecionados.

### 3. Edge Function — recalculate-sdr-payout
- Buscar `dias_uteis_closer` junto com `dias_uteis_final` na query do calendário
- Se o SDR tem `role_type = 'closer'` e `dias_uteis_closer` não é NULL → usar `dias_uteis_closer` como `diasUteisMes`
- Senão → usar `dias_uteis_final` (comportamento atual)
- `valor_fixo` **não muda** — continua vindo do comp_plan

### 4. Frontend — useSdrFechamento.ts
- Na preview dinâmica, aplicar a mesma lógica: se closer e `dias_uteis_closer` disponível, usar esse valor para metas

### 5. Atualizar Março 2026
Via insert tool: `UPDATE working_days_calendar SET dias_uteis_closer = 21, dias_uteis_final = 20 WHERE ano_mes = '2026-03'`

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/migrations/*.sql` | Coluna `dias_uteis_closer` |
| `src/components/sdr-fechamento/WorkingDaysCalendar.tsx` | Coluna na tabela + dialog com 2 mini-calendários (SDR/Closer) |
| `supabase/functions/recalculate-sdr-payout/index.ts` | Buscar e usar `dias_uteis_closer` para closers |
| `src/hooks/useSdrFechamento.ts` | Usar dias corretos por role |

