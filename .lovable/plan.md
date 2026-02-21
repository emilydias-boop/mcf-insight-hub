

# Fix: Outside em "Contrato Pago" sem atividades deve ser "Nao Trabalhado"

## Problema

O webhook automaticamente move leads Outside de "Novo Lead" para "Contrato Pago" quando detecta pagamento. A logica atual considera que qualquer lead que saiu de "Novo Lead" foi "Trabalhado", mas isso esta errado para leads movidos automaticamente pelo sistema.

Exemplo: Edmilson Lucena entrou em 15/02, foi movido automaticamente para "Contrato Pago" em 16/02, mas nenhum SDR trabalhou esse lead. Ele aparece como "Trabalhado" quando deveria ser "Nao Trabalhado".

## Solucao

Alterar a logica no arquivo `src/pages/crm/Negocios.tsx` (linhas 491-508) para tratar "Contrato Pago" como um estagio automatico, nao como evidencia de trabalho real.

**Regra corrigida:**
- **Trabalhado**: Lead Outside que tem atividades reais (calls/notas/whatsapp > 0) OU que esta em um estagio que implica trabalho real do SDR (LQ, R1 Agendada, R1 Realizada, etc. -- mas NAO "Novo Lead" nem "Contrato Pago")
- **Nao Trabalhado**: Lead Outside sem atividades reais E que esta em "Novo Lead" ou "Contrato Pago"

**Implementacao:**

```
// Estagios automaticos que NAO contam como trabalho real
const autoStages = ['novo lead', 'contrato pago'];
const isInAutoStage = autoStages.some(s => stageName.includes(s));

// Trabalhado = tem atividades reais OU esta em estagio que implica trabalho SDR
// (nao apenas ter saido de Novo Lead, pois Contrato Pago e automatico)
if (isInAutoStage && !hasActivity) return false; // nao trabalhado

// Nao Trabalhado = esta em estagio automatico E sem atividades
if (!isInAutoStage || hasActivity) return false; // trabalhado
```

## Alteracao

| Arquivo | Linhas | Mudanca |
|---------|--------|---------|
| `src/pages/crm/Negocios.tsx` | 491-508 | Substituir `isInNovoLead` por `isInAutoStage` que inclui "novo lead" E "contrato pago" |

## Resultado

- Edmilson Lucena (Contrato Pago, 0 atividades) -> Outside Nao Trabalhado
- Lead em LQ com 0 atividades -> Outside Trabalhado (SDR moveu manualmente)
- Lead em Novo Lead com 3 calls -> Outside Trabalhado (tem atividades)
- Lead em R1 Agendada -> Outside Trabalhado (SDR agendou)

