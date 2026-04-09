

# Corrigir bulk move: atualizar deals existentes na pipeline destino

## Problema

Ao mover leads em massa para outra pipeline, o constraint `crm_deals_contact_origin_unique` bloqueia quando o contato já tem um deal na pipeline destino (com `data_source = 'webhook'`). Ex: leads de "anamnese incompleta" que completaram o fluxo e já existem na pipeline destino.

## Solução

Processar deals individualmente. Quando o UPDATE falhar por duplicata:
1. Buscar o deal existente na pipeline destino (mesmo `contact_id` + `origin_id`)
2. Atualizar o deal existente com: `stage_id`, `tags`, `custom_fields`, `name` e `updated_at` do deal de origem -- para que as informações atualizadas (ex: anamnese completa) sejam refletidas
3. Reportar ao usuário quantos foram movidos vs. atualizados

| Arquivo | Alteração |
|---|---|
| `src/components/crm/BulkMovePipelineDialog.tsx` | Refatorar `handleMove` para processar individualmente, e em caso de duplicata, mesclar dados no deal existente |

### Lógica do handleMove

```text
Para cada dealId selecionado:
  1. Buscar deal atual (contact_id, tags, custom_fields, name)
  2. Tentar UPDATE (origin_id + stage_id)
  3. Se erro de unique constraint:
     a. Buscar deal existente na pipeline destino (contact_id + origin_id)
     b. Mesclar tags (union) e custom_fields (merge) do deal origem → deal destino
     c. Atualizar deal destino com stage + dados mesclados
     d. Contabilizar como "atualizado"
  4. Se sucesso: contabilizar como "movido"

Toast final: "X movido(s), Y atualizado(s)"
```

### Dados que serão mesclados no deal existente

- `stage_id` → novo estágio selecionado
- `tags` → união das tags dos dois deals (sem duplicar)
- `custom_fields` → merge (campos do deal sendo movido sobrescrevem)
- `updated_at` → now()

Assim, quando leads de anamnese incompleta completaram o fluxo, as informações atualizadas (tags, custom_fields) são transferidas para o deal existente na pipeline destino.

