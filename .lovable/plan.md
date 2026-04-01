

## Problema: "Duplicar" só permite Inside Sales

### Causa raiz

O botão **"Duplicar p/ Inside"** no `BulkActionsBar` é um atalho **hardcoded** exclusivamente para a pipeline Inside Sales. O componente `DuplicateToInsideDialog` busca estágios apenas do `INSIDE_SALES_ORIGIN_ID`.

Já o botão **"Transferir para..."** abre o `SendToPipelineModal`, que permite escolher qualquer BU/pipeline. Ou seja, a funcionalidade de enviar para outra pipeline já existe — mas com outro nome.

### Opções

**Opção A — Tornar o botão "Duplicar" dinâmico por BU**
- Quando estiver na BU Consórcio, o botão "Duplicar" abre um modal que lista as pipelines do Consórcio (não Inside Sales)
- Quando estiver na BU Incorporador, mantém o comportamento atual (Inside Sales)

**Opção B — Remover o botão "Duplicar p/ Inside" da BU Consórcio**
- Ocultar o botão na BU Consórcio, já que "Transferir para..." já cobre essa necessidade
- Manter apenas na BU Incorporador onde faz sentido

**Opção C — Renomear e unificar**
- Substituir ambos os botões por um único "Enviar para Pipeline" que funciona para qualquer BU
- Remove duplicidade de funcionalidade

### Recomendação: Opção B (mais simples)

Ocultar o botão "Duplicar p/ Inside" quando `activeBU === 'consorcio'`, pois o "Transferir para..." já faz o mesmo trabalho. Instruir o usuário a usar "Transferir para..." para enviar contatos a qualquer pipeline.

### Correção

**Arquivo**: `src/components/crm/BulkActionsBar.tsx`

Adicionar prop `hideDuplicate` ou verificar a BU ativa para ocultar o botão.

**Arquivo**: `src/pages/crm/Contatos.tsx`

Passar flag para ocultar duplicação quando na BU Consórcio, usando `useActiveBU()`.

### Arquivos afetados
- `src/pages/crm/Contatos.tsx` — Condicionar exibição do botão duplicar por BU
- `src/components/crm/BulkActionsBar.tsx` — Suportar ocultação do botão duplicar

