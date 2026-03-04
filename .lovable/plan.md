

## Diagnóstico

Analisei os dados e encontrei dois problemas:

### Problema 1: Comp Plans com nível/valores errados
| SDR | Atual no Feb | Correto |
|-----|-------------|---------|
| Leticia Nunes | N2 (OTE 4500, Fixo 3150) | N1 (OTE 4000, Fixo 2800) |
| Carol Correa | N3 (OTE 5000, Fixo 3500) | N2 (OTE 4500, Fixo 3150) |

### Problema 2: Meta/Dia mostra valor ATUAL, não histórico
A coluna "Meta/Dia" lê de `sdr.meta_diaria` (valor atual), não do comp_plan do mês. Quando a meta diária muda (ex: promoção), o valor antigo é perdido. Além disso, vários comp_plans de fevereiro têm `meta_reunioes_agendadas = 15` (placeholder errado da sincronização retroativa).

Valores corretos fornecidos pelo usuário:
- Alex: 5, Robert: 5, Juliana: 5, Antony: 7, Carol Souza: 7, Julia: 9, Leticia: 7, Carol Correa: 9

## Plano de Correção

### 1. Migration SQL — Corrigir comp_plans de fevereiro

```sql
-- Leticia: N2 → N1
UPDATE sdr_comp_plan SET 
  cargo_catalogo_id = 'd035345f-8fe3-41b4-8bba-28d0596c5bed',
  ote_total = 4000, fixo_valor = 2800, variavel_total = 1200,
  meta_reunioes_agendadas = 119, -- 7*17
  dias_uteis = 17
WHERE id = '10cb1b8c-0a98-4406-b30e-ba0a5da37579';

-- Carol Correa: N3 → N2
UPDATE sdr_comp_plan SET 
  cargo_catalogo_id = '9e3d43e9-66a0-439c-9d0e-d9de5bcdf3ad',
  ote_total = 4500, fixo_valor = 3150, variavel_total = 1350,
  meta_reunioes_agendadas = 153, -- 9*17
  dias_uteis = 17
WHERE id = '6341c886-8294-4871-84ad-7e5c3d571a85';

-- Fix meta_reunioes_agendadas for all affected Feb plans:
-- Juliana: meta 5 → 85
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 85, dias_uteis = 17 WHERE id = '10b6eafd-c107-4b4d-8f4b-f214efe8ab1e';
-- Antony: meta 7 → 119
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 119, dias_uteis = 17 WHERE id = 'a3b2e017-042c-4b25-a4d6-96d025b71f80';
-- Carol Souza: meta 7 → 119
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 119, dias_uteis = 17 WHERE id = '31cf599c-a81a-419c-af13-e7cd2249513b';
-- Julia: meta 9 → 153
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 153, dias_uteis = 17 WHERE id = 'f3c3bcde-7343-4154-a05b-a4f1b8b338e6';
-- Alex: meta 5 → 85 (fix dias_uteis too)
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 85, dias_uteis = 17 WHERE id = '36dbdec5-fa82-417d-b5af-33bdb44c43db';
-- Robert: meta 5 → 85 (fix dias_uteis too)
UPDATE sdr_comp_plan SET meta_reunioes_agendadas = 85, dias_uteis = 17 WHERE id = 'acc8a9b9-260c-467c-b303-1cfc8a4a48e4';
```

### 2. PlansOteTab — Derivar Meta/Dia do comp_plan quando existir

Alterar a lógica de exibição do Meta/Dia para priorizar o valor derivado do comp_plan (`meta_reunioes_agendadas / dias_uteis`) em vez de ler `sdr.meta_diaria` (valor atual). Isso garante que meses passados mostrem a meta histórica.

Mudança no `getDisplayValues`:
```typescript
metaDiaria: hasPlan && emp.comp_plan!.meta_reunioes_agendadas && emp.comp_plan!.dias_uteis 
  ? Math.round(emp.comp_plan!.meta_reunioes_agendadas / emp.comp_plan!.dias_uteis)
  : emp.sdr_meta_diaria || 10,
```

### 3. Recalcular fevereiro
Após as correções, clicar "Recalcular Todos" para fevereiro.

## Resultado Esperado

A aba Planos OTE de fevereiro mostrará os níveis e metas corretos conforme o usuário especificou.

