
# Plano: Filtrar Leads Finalizados na Busca de Agendamento

## Problema Identificado

O lead "Tiago Raifran" aparece 3 vezes na busca de agendamento porque existem 3 deals com seu nome em diferentes estágios:

| Deal | Estágio | Status Correto | Deveria aparecer? |
|------|---------|----------------|-------------------|
| Tiago Raifran | APORTE HOLDING | WON (já fez aporte na holding) | Não |
| Tiago Raifran | VENDA REALIZADA 50K | WON (venda concluída) | Não |
| Tiago Raifran | RENOVAÇÃO HUBLA | OPEN (renovação pendente) | Sim |

O sistema atual não reconhece os estágios específicos do Consórcio como "ganhos".

---

## Solução Proposta

### Parte 1: Atualizar Keywords de Estágios Ganhos

Adicionar os termos específicos do Consórcio ao arquivo de mapeamento de status.

**Arquivo:** `src/lib/dealStatusHelper.ts`

Atualizar `WON_KEYWORDS` para incluir:
- `aporte holding`
- `carta socios fechada`
- `carta + aporte`
- `venda realizada`

### Parte 2: Filtrar Deals na Busca

Modificar o hook de busca para excluir deals que estão em estágios finalizados (ganhos ou perdidos).

**Arquivo:** `src/hooks/useAgendaData.ts`

Na função `useSearchDealsForSchedule`:
1. Importar `getDealStatusFromStage` do helper
2. Após normalizar os deals, filtrar apenas os que têm status `open`
3. Retornar somente deals ainda em andamento

---

## Resultado Esperado

Após a implementação, ao buscar "Tiago Raifran" no modal de agendamento:

| Antes | Depois |
|-------|--------|
| 3 resultados (todos os deals) | 1 resultado (apenas RENOVAÇÃO HUBLA) |

---

## Detalhes Técnicos

### Modificação 1: `src/lib/dealStatusHelper.ts`

```typescript
const WON_KEYWORDS = [
  'venda realizada', 'contrato pago', 'pagamento concluído',
  'crédito contratado', 'crédito aprovado', 'consórcio fechado',
  'fechado', 'fechada', 'ganho', 'ganha', 'convertido', 'convertida',
  // Termos específicos do Consórcio
  'aporte holding', 'carta socios fechada', 'carta + aporte'
];
```

### Modificação 2: `src/hooks/useAgendaData.ts`

```typescript
import { getDealStatusFromStage } from '@/lib/dealStatusHelper';

// Dentro de useSearchDealsForSchedule, após normalizar os deals:
const openDeals = normalizedDeals.filter(deal => {
  const status = getDealStatusFromStage(deal.stage?.stage_name);
  return status === 'open'; // Excluir 'won' e 'lost'
});
```

---

## Nota sobre Dados Faltantes

Os deals de "Tiago Raifran" estão com `contact_id = NULL`, por isso aparecem sem telefone e email. Isso é um problema de dados que requer correção manual via SQL ou através da interface de edição de negócios.

---

## Arquivos a Modificar

1. `src/lib/dealStatusHelper.ts` - Adicionar keywords do Consórcio
2. `src/hooks/useAgendaData.ts` - Filtrar deals finalizados na busca
