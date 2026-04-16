

## Simulação: Limpeza de Duplicados na Pipeline Inside Sales

### Resultado da simulação

**Caso Valdeci Oliveira** — 4 deals ativos, 3 contact_ids diferentes:

| Deal | Stage | Order | Fonte | Ação |
|------|-------|-------|-------|------|
| `5876...` | Lead Gratuito | 1 | webhook | ARQUIVAR |
| `5938...` | No-Show | 7 | csv/limbo | ARQUIVAR |
| `69ce...` | Novo Lead | 3 | manual | ARQUIVAR |
| `7506...` | **Reunião 01 Realizada** | **8** | manual | **MANTER** |

Critério: **maior stage_order** (mais avançado) vence. Em empate, o mais recente. Resultado correto: fica o "Reunião 01 Realizada".

**Problema encontrado na simulação**: o agrupamento simples (email OU phone) divide o Valdeci em 2 grupos — os 2 deals com email agrupam por email, os 2 sem email agrupam por phone. Resultado errado: ficam 2 deals. Isso afeta **129 casos** similares.

### Números globais (Inside Sales)

| Métrica | Valor |
|---------|-------|
| Deals ativos hoje | 13.539 |
| Grupos duplicados (email) | 267 (573 deals) |
| Grupos duplicados (phone) | 136 (280 deals) |
| Cross-group (email+phone = mesma pessoa) | 129 extras |
| Total de deals a arquivar | ~458 |
| Deals após cleanup | ~13.081 |

### Solução: limpeza em 2 passes

**Passo 1** — Agrupar por email (onde existe), manter o de maior stage_order
**Passo 2** — Entre os sobreviventes, agrupar por phone suffix (9 dígitos), manter o de maior stage_order

Isso resolve 100% dos casos, incluindo o Valdeci.

### Implementação (4 partes)

**Parte 1 — Frontend: filtrar duplicados (imediato)**
- `src/hooks/useCRMData.ts` (linha ~429): adicionar `.eq('is_duplicate', false).is('archived_at', null)` na query principal
- `src/hooks/useLimboLeads.ts` (linha ~37): adicionar mesmo filtro na query do Limbo

**Parte 2 — Cleanup SQL via migration (2 passes)**
- Pass 1: agrupar deals ativos do Inside Sales por `lower(email)`, manter winner (maior stage_order, tiebreak newest), marcar restantes como `is_duplicate = true, archived_at = now()`
- Pass 2: entre sobreviventes, agrupar por phone suffix 9 dígitos, repetir lógica
- Consolidar `contact_id` dos arquivados para o winner (manter dados integrados)

**Parte 3 — Prevenir novos duplicados no Limbo**
- `src/hooks/useLimboLeads.ts` (linha ~422): antes de inserir deal, checar se já existe deal ativo na Inside Sales para o mesmo `contact_id` OU para contato com mesmo email/phone
- Se existir, pular criação e avisar no toast

**Parte 4 — Prevenir novos duplicados na criação manual**
- `src/components/crm/DealFormDialog.tsx`: ao criar deal, buscar contato existente por email/phone antes de inserir novo contato
- Checar se já existe deal ativo na mesma pipeline para esse contato

### Arquivos envolvidos
- `src/hooks/useCRMData.ts` — filtro de query (2 linhas)
- `src/hooks/useLimboLeads.ts` — filtro de query + check de duplicação antes de inserir
- `src/components/crm/DealFormDialog.tsx` — reuso de contato + check de duplicação
- Migration SQL — cleanup em 2 passes

