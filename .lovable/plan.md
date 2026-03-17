

## Corrigir deals órfãos do Ulysses e prevenir futuros problemas

### Problema identificado

Existem 3 deals "Ulysses Inácio da Luz" no banco:

| Deal ID | Origin | Stage | contact_id | origin_id |
|---|---|---|---|---|
| `378d55f3` | INSIDE SALES - VIVER DE ALUGUEL | R1 AGENDADA | NULL | `4e2b810a` |
| `b65a15ba` | (NULL) | Reunião 02 Realizada | NULL | NULL |
| Contact `643aee5c` existe com email `ulyssesdaluz@outlook.com` |

**Por que não aparece na busca**: O Kanban filtra deals por `origin_id IN (origens da pipeline selecionada)`. Deals com `origin_id = NULL` não aparecem em nenhuma pipeline. Além disso, a busca por nome/email/telefone usa o JOIN com `crm_contacts`, mas como `contact_id = NULL`, o JOIN retorna vazio.

### Solução em 3 partes

#### 1. Corrigir dados do Ulysses (via SQL direto)
- Vincular contact `643aee5c` aos deals `378d55f3` e `b65a15ba`
- Vincular deal `b65a15ba` à pipeline PIPELINE INSIDE SALES (`e3c04f21`) para que apareça no Kanban

#### 2. Melhorar busca no Kanban para encontrar deals cross-pipeline
No `useCRMDeals` (arquivo `src/hooks/useCRMData.ts`), quando há `searchTerm`:
- Fazer uma busca adicional SEM filtro de `origin_id` quando o texto buscado não retorna resultados na pipeline atual
- Ou sempre buscar em todas as pipelines quando o usuário digita um termo de busca, mostrando um badge indicando de qual pipeline o deal vem

#### 3. Prevenir deals órfãos sem contact_id
Adicionar lógica no sync de deals (`sync-deals` edge function) para tentar vincular automaticamente o `contact_id` quando estiver NULL, buscando pelo nome do deal na tabela `crm_contacts`.

### Arquivos a editar

| Arquivo | Ação |
|---|---|
| (SQL data fix) | UPDATE dos 2 deals do Ulysses: setar contact_id e origin_id |
| `src/hooks/useCRMData.ts` | No `useCRMDeals`, quando `searchTerm` presente, buscar em TODAS as origens (ignorar filtro de origin_id) para encontrar deals cross-pipeline |
| `src/pages/crm/Negocios.tsx` | Exibir badge/indicador quando um deal encontrado na busca pertence a outra pipeline |
| `supabase/functions/sync-deals/index.ts` | Adicionar lógica de auto-link: quando deal.contact_id é NULL, buscar contato por nome/email e vincular |

