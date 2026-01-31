
# Distribuição de 139 Leads para SDRs - Pipeline Inside Sales

## Resumo da Operação

| Item | Valor |
|------|-------|
| **Total de leads sem owner** | 139 deals |
| **Pipeline** | PIPELINE INSIDE SALES |
| **SDRs ativos** | 8 usuários |
| **Tag a ser adicionada** | "Lead-Lançamento" |

---

## Distribuição Proporcional

Com base nos percentuais configurados (total = 100%):

| SDR | % | Leads a receber |
|-----|---|-----------------|
| Julia Caroline | 13% | 18 leads |
| Caroline Souza | 13% | 18 leads |
| Caroline Aparecida Corrêa | 13% | 18 leads |
| Juliana Rodrigues dos Santos | 13% | 18 leads |
| Leticia Nunes dos Santos | 12% | 17 leads |
| Antony Elias Monteiro da Silva | 12% | 17 leads |
| Jessica Martins | 12% | 17 leads |
| Alex Dias | 12% | 16 leads |
| **TOTAL** | **100%** | **139 leads** |

---

## Etapas Técnicas

### Etapa 1: Criar Script de Distribuição

Executar um SQL que:
1. Lista todos os 139 deal IDs sem owner
2. Ordena aleatoriamente para distribuição justa
3. Atribui cada deal ao próximo SDR seguindo os percentuais
4. Atualiza `owner_id` (email) e `owner_profile_id` (UUID)

### Etapa 2: Adicionar Tag "Lead-Lançamento"

Atualizar o campo `tags` (array) de cada deal para incluir a nova tag:
- Se `tags` for NULL → definir como `['Lead-Lançamento']`
- Se `tags` já tiver valores → adicionar `'Lead-Lançamento'` ao array existente

### Etapa 3: Registrar Atividades

Criar registros em `deal_activities` para cada deal:
- `activity_type`: 'owner_change'
- `description`: 'Atribuído para [nome do SDR] via distribuição de lançamento'
- `metadata`: informações de rastreamento

---

## Dados dos SDRs para Atribuição

| Email | Profile ID |
|-------|------------|
| julia.caroline@minhacasafinanciada.com | 794a2257-422c-4b38-9014-3135d9e26361 |
| caroline.souza@minhacasafinanciada.com | 4c947a4c-80c1-4439-bd31-2b38e3a3f1d0 |
| carol.correa@minhacasafinanciada.com | c7005c87-76fc-43a9-8bfa-e1b41f48a9b7 |
| juliana.rodrigues@minhacasafinanciada.com | baa6047c-6b41-42ef-bfd0-248eef9b560a |
| leticia.nunes@minhacasafinanciada.com | c1ede6ed-e3ae-465f-91dd-a708200a85fc |
| antony.elias@minhacasafinanciada.com | 70113bef-a779-414c-8ab4-ce8b13229d3a |
| jessica.martins@minhacasafinanciada.com | b0ea004d-ca72-4190-ab69-a9685b34bd06 |
| alex.dias@minhacasafinanciada.com | 16c5d025-9cda-45fa-ae2f-7170bfb8dee8 |

---

## Execução

A operação será feita em **3 batches SQL** (usando a ferramenta de inserção/atualização):

1. **Batch 1**: Atualizar `owner_id` e `owner_profile_id` dos 139 deals
2. **Batch 2**: Adicionar tag "Lead-Lançamento" a todos os deals
3. **Batch 3**: Registrar atividades de transferência em `deal_activities`

---

## Resultado Esperado

Após a execução:
- ✅ Todos os 139 leads terão um SDR responsável
- ✅ Todos os leads terão a tag "Lead-Lançamento" para identificação
- ✅ Histórico de atribuição será registrado nas atividades
- ✅ Leads aparecerão no Kanban de cada SDR respectivo
