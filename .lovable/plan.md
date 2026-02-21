
# Separar Outsides Trabalhados vs Nao Trabalhados

## Contexto

Atualmente o filtro Outside tem apenas 3 opcoes: Todos, Apenas Outside, Sem Outside. Os SDRs nao conseguem distinguir quais Outsides ja foram trabalhados e quais ainda precisam de atencao.

## Solucao

Expandir o filtro Outside de 3 para 5 opcoes, usando o campo `last_worked_at` (ja existente nos deals) e a contagem de atividades (ja carregada via `activitySummaries`) para determinar se um Outside foi trabalhado.

### Novas opcoes do filtro:

| Valor | Label | Logica |
|-------|-------|--------|
| `all` | Todos | Sem filtro (atual) |
| `outside_only` | Todos Outside | Mostra todos os Outside (atual "Apenas Outside") |
| `outside_worked` | Outside Trabalhados | Outside = true E (totalActivities > 0 OU last_worked_at nao nulo) |
| `outside_not_worked` | Outside Nao Trabalhados | Outside = true E totalActivities = 0 E last_worked_at nulo |
| `not_outside` | Sem Outside | Mostra apenas nao-Outside (atual) |

### Arquivos a alterar

**1. `src/components/crm/DealFilters.tsx`**
- Expandir o tipo `OutsideFilter` para incluir `'outside_worked'` e `'outside_not_worked'`
- Adicionar as novas opcoes no `Select` com icones visuais distintos (verde para trabalhados, vermelho para nao trabalhados)

**2. `src/pages/crm/Negocios.tsx`**
- Atualizar a logica de filtragem (linhas 486-491) para tratar os novos valores do filtro
- Cruzar o `outsideMap` com `activitySummaries` e o campo `last_worked_at` do deal para determinar se foi trabalhado

### Detalhes tecnicos

```text
Filtro atual:
  outsideFilter === 'outside_only' -> isOutside === true
  outsideFilter === 'not_outside'  -> isOutside === false

Filtro novo:
  outsideFilter === 'outside_only'       -> isOutside === true
  outsideFilter === 'outside_worked'     -> isOutside === true E (activities > 0 OU last_worked_at)
  outsideFilter === 'outside_not_worked' -> isOutside === true E activities === 0 E !last_worked_at
  outsideFilter === 'not_outside'        -> isOutside === false
```

O `activitySummaries` ja esta carregado no componente Negocios (via `useBatchDealActivitySummary`), e `last_worked_at` ja vem nos dados do deal. Nenhuma query adicional e necessaria.
