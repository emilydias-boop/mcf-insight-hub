

## Plano: Melhorar página de Configuração de BU

### O que muda

A página atual mostra uma lista plana de todos os `crm_groups` sem organização. Vamos melhorar a UX com:

#### 1. Campo de busca/filtro de pipelines
- Input de texto acima da lista para filtrar pipelines por nome em tempo real
- Facilita encontrar pipelines específicas em listas longas

#### 2. Indicador de pipelines já vinculadas a outras BUs
- Ao lado de cada pipeline, mostrar um badge discreto indicando se já está vinculada a outra BU (ex: "Consórcio", "Crédito")
- Usa o hook `useAllBUMappings()` que já existe para buscar todos os mapeamentos
- Ajuda o admin a evitar vincular a mesma pipeline a duas BUs acidentalmente

#### 3. Tabs de BU em vez de dropdown
- Substituir o `Select` de BU por tabs horizontais, permitindo trocar rapidamente entre BUs
- Cada tab mostra um badge com a contagem de pipelines vinculadas (ex: "Incorporador (5)")

#### 4. Contador e indicadores visuais
- Header da lista mostrando "X de Y pipelines selecionadas"
- Botões "Selecionar todos" e "Limpar seleção" para ações em massa

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/ConfiguracaoBU.tsx` | Refatorar UI: tabs de BU, campo de busca, indicador de vinculação a outras BUs, ações em massa |
| `src/hooks/useBUOriginMapping.ts` | Sem mudanças (hook `useAllBUMappings` já existe) |

### O que NÃO muda
- Lógica de salvar (`useSaveBUOriginMapping`) permanece igual
- Estrutura da tabela `bu_origin_mapping` não muda
- Hooks consumidores (`useBUPipelineMap`, `useBUOriginIds`) continuam funcionando

