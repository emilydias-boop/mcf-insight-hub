
# Corrigir Agenda R1 Consorcio: Area de Clique e Classificacao Outside/Parceiro

## Problema 1: Area de Clique Expandida nos Espacos Vazios

Na visao semanal do calendario (week view), quando uma reuniao se estende por varios slots de 15 minutos, os slots subsequentes ficam marcados como "isOccupied". O handler `onClick` esta no **div pai da celula inteira**, fazendo com que clicar em qualquer ponto da celula (mesmo em colunas vazias de outros closers) abra a reuniao.

### Causa Raiz

Linhas 1198-1221 do `AgendaCalendar.tsx`: o `onClick` no div da celula inteira dispara para qualquer clique quando `isOccupied = true`, mesmo que o clique seja em um espaco vazio ao lado do bloco da reuniao. A logica tenta identificar qual closer foi clicado via coordenada X, mas quando ha apenas um closer com reuniao, toda a largura e tratada como clicavel.

### Solucao

Modificar a logica do `onClick` na celula para verificar se o clique realmente aconteceu dentro da coluna do closer que tem reuniao. Se o clique cai em uma coluna vazia, nao abrir nenhuma reuniao. Especificamente:

1. Calcular a coluna clicada com base no grid de closers do dia
2. Verificar se essa coluna corresponde a um closer com reuniao ativa naquele slot
3. Somente abrir a reuniao se houver match - caso contrario, nao fazer nada

---

## Problema 2: Leads Parceiros Marcados como "Outside"

Na agenda R1 do Consorcio, os leads que entram em reuniao ja sao parceiros existentes (compraram A001, A009, Anticrise, etc). O hook `useOutsideDetection` marca como "Outside" qualquer lead que tenha uma transacao com "Contrato" anterior a reuniao. Porem, no contexto do Consorcio, esses leads nao sao "outside" - sao parceiros sendo atendidos em uma nova BU.

### Comportamento Desejado

| Situacao | Classificacao | Exibicao |
|----------|--------------|----------|
| Parceiro existente (A001, A009, Anticrise, etc) | Parceiro | Badge com nome do produto comprado |
| Novo lead do curso "Construir para Alugar" | Lead Novo | Tratado como inside (sem badge especial) |
| Lead que comprou contrato antes da R1 (incorporador) | Outside | Badge amarelo "Outside" (comportamento atual) |

### Solucao

1. **Criar novo hook `usePartnerProductDetection`**: busca transacoes do lead na tabela `hubla_transactions` para identificar qual produto ele comprou (A001, A009, A003/Anticrise, etc)

2. **Ajustar logica no `AgendaCalendar.tsx` e `AgendaMeetingDrawer.tsx`**: 
   - Se o lead tem produto principal (A001, A009, Anticrise, etc): exibir badge "Parceiro - A001" em vez de "Outside"
   - Se o lead tem apenas "Construir para Alugar": tratar como lead novo (sem badge Outside, sem badge Parceiro)
   - Manter "Outside" somente para leads do Incorporador que compraram contrato antes da R1

3. **Desativar Outside detection para BU Consorcio**: o conceito de "Outside" faz sentido apenas para o Incorporador (lead paga contrato antes da consultoria). No Consorcio, todos os leads ja sao parceiros pagantes.

---

## Secao Tecnica

### Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/crm/AgendaCalendar.tsx` | Corrigir onClick na celula ocupada para verificar coluna do closer (linhas 1198-1221) |
| `src/hooks/useOutsideDetection.ts` | Nao alterar - manter funcionando para Incorporador |
| `src/hooks/usePartnerProductDetection.ts` | **NOVO** - Hook para detectar produto comprado pelo lead |
| `src/components/crm/AgendaCalendar.tsx` | Substituir badge "Outside" por "Parceiro - [produto]" quando BU = consorcio |
| `src/components/crm/AgendaMeetingDrawer.tsx` | Mesma logica: exibir produto do parceiro em vez de Outside |
| `src/components/crm/CloserColumnCalendar.tsx` | Mesma logica na visao por closer |

### Novo Hook: usePartnerProductDetection

```typescript
// Busca na hubla_transactions qual produto principal o lead comprou
// Produtos principais: A001, A009, A003 (Anticrise), A004, A002, etc
// Exclui: "Construir para Alugar" (lead novo), "Contrato" (pós-venda), P2/suplemento
```

### Mapeamento de Produtos para Badge

| product_name contém | Badge |
|---------------------|-------|
| A001 | Parceiro A001 |
| A009 | Parceiro A009 |
| A003 ou Anticrise Completo | Parceiro Anticrise |
| A004 ou Anticrise Basico | Parceiro Anticrise Basico |
| A002 | Parceiro A002 |
| A010 | Parceiro A010 |
| Construir para Alugar | (sem badge - tratado como lead novo) |

### Correcao do Click (pseudocodigo)

```text
onClick na celula:
  1. Calcular totalClosers do dia
  2. Calcular indice da coluna clicada (clickX / larguraPorCloser)
  3. Identificar closerId da coluna clicada
  4. Buscar reuniao que cobre esse slot PARA ESSE CLOSER especifico
  5. Se encontrou -> abrir reuniao
  6. Se nao encontrou -> nao fazer nada (espaco vazio)
```
