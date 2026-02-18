

# Correção: Isolamento por BU e Redução de "Sem Closer/SDR"

## Problemas Identificados

### 1. Closers de outras BUs aparecem no relatório
A rota `/bu-incorporador/relatorios` nao possui `BUProvider`, entao `useActiveBU()` nao retorna `'incorporador'`. O `useGestorClosers` busca closers de TODAS as BUs.

Evidencia: Victoria Paz e Thobson sao closers da BU Consorcio, mas aparecem no relatorio Incorporador.

### 2. Volume alto de "Sem Closer" e "Sem SDR" (65% das transacoes)
O hook busca TODAS as transacoes Hubla (3.371 em fevereiro), incluindo:
- 1.319 transacoes A010 (funil automatico, sem reuniao R1)
- 176 transacoes de lancamento
- Transacoes de renovacao, vitalicio, etc.

Nenhuma dessas categorias automaticas passa por reuniao, entao naturalmente nao tem closer/SDR associado. O correto e ignorar essas categorias no "Sem Closer" e contabilizar apenas as que DEVERIAM ter passado por uma reuniao.

### 3. Periodo esta funcionando corretamente
O filtro de datas esta aplicado. O problema e de escopo (BU + tipo de produto), nao de periodo.

## Solucao

### Alteracao 1: Hook `useAcquisitionReport` recebe `bu` como parametro

O hook passa a aceitar o parametro `bu` e faz a filtragem diretamente, sem depender de `useActiveBU`:

```text
export function useAcquisitionReport(dateRange, bu)
```

### Alteracao 2: Buscar closers filtrando por BU direto no hook

Em vez de usar `useGestorClosers` (que depende do context), fazer query direta filtrando por `bu = 'incorporador'`:

```text
closers WHERE is_active = true 
  AND (meeting_type IS NULL OR meeting_type = 'r1')
  AND bu = {bu}
```

### Alteracao 3: Filtrar attendees por closers da BU

Na classificacao (passo 8), so aceitar um match de attendee se o `closer_id` pertencer a lista de closers da BU. Isso segue o padrao ja documentado do sistema (memoria: agenda-bu-specific-filtering-logic).

```text
// Antes:
const closerId = matchedAttendee?.meeting_slots?.closer_id || null;

// Depois: 
const closerId = matchedAttendee?.meeting_slots?.closer_id || null;
const isValidCloser = closerId && closerIdSet.has(closerId);
// Se closer nao e da BU, ignorar o match
```

### Alteracao 4: Classificar "Sem Closer" de forma inteligente

Transacoes de categorias automaticas (Lancamento, A010, Renovacao, Vitalicio) que ficam como "Sem Closer" serao reclassificadas com o nome da origem em vez de "Sem Closer". Assim a tabela de Closer mostra apenas vendas que DEVERIAM ter um closer atribuido.

O campo `origin` ja classifica corretamente essas vendas. O "Sem Closer" real passa a representar apenas vendas nao-automaticas sem match na agenda — que e o que a gestao quer acompanhar.

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/hooks/useAcquisitionReport.ts` | Receber `bu` como parametro; buscar closers diretamente filtrando por BU; criar Set de closer_ids validos; filtrar matches de attendees por BU; classificar "Sem Closer" inteligente |
| `src/components/relatorios/AcquisitionReportPanel.tsx` | Passar `bu` ao hook |

## Resultado Esperado

- Closers exibidos: apenas Julio, Thayna, Cristiane Gomes, Mateus Macedo (BU incorporador)
- Victoria Paz, Thobson (consorcio) desaparecem do relatorio
- "Sem Closer" reduz drasticamente (apenas vendas nao-automaticas sem match)
- SDRs exibidos correspondem apenas aos deals vinculados a closers da BU incorporador
- Tabela de Origem continua mostrando Lancamento, A010, etc. como dimensoes separadas

