

## Limpeza em Massa de Duplicados — BU Incorporador

### O que será feito
Executar uma análise completa de duplicados **apenas na BU Incorporador** (filtrando por `bu_origin_mapping`), gerar um relatório de simulação (dry run) mostrando o impacto, e após revisão, executar a limpeza real.

### Por que não usar o botão existente
A edge function `merge-duplicate-contacts` opera em **todos os contatos** globalmente, sem filtro por BU. Para limitar ao Incorporador, precisamos de uma abordagem direcionada.

### Implementação em 3 etapas

#### Etapa 1 — Simulação (Dry Run) via Script
Script Python/SQL que:
1. Busca os `origin_id` da BU Incorporador via `bu_origin_mapping`
2. Identifica contatos com deals nessas origins que compartilham email ou telefone (últimos 9 dígitos)
3. Para cada grupo, elege o **contato principal** (maior stage_order > mais deals > mais reuniões > mais antigo)
4. Gera relatório com:
   - Total de grupos duplicados (por email e por telefone)
   - Contatos que seriam mantidos vs removidos
   - Deals que seriam transferidos ou consolidados
   - Grupos com risco (duplicado tem mais deals/reuniões que o principal)
   - Estimativa de deals afetados

#### Etapa 2 — PDF de Simulação
Gerar PDF em `/mnt/documents/` com o relatório completo para revisão antes da execução.

#### Etapa 3 — Execução Real
Após aprovação, chamar a edge function `merge-duplicate-contacts` com `primary_id` + `duplicate_ids` para cada grupo identificado (merge direcionado grupo a grupo), garantindo que apenas contatos da BU Incorporador sejam afetados.

### O que a limpeza faz em cada grupo
- **Mantém** o contato com deal mais avançado no funil
- **Transfere** deals dos duplicados para o contato principal
- **Consolida** deals duplicados na mesma pipeline (mantém o mais avançado)
- **Enriquece** o principal com email/telefone/tags dos duplicados
- **Remove** os contatos duplicados após transferência

### Arquivos
- `/tmp/bu_incorporador_cleanup.py` — script de análise (temporário)
- `/mnt/documents/simulacao-duplicados-incorporador.pdf` — relatório de simulação

