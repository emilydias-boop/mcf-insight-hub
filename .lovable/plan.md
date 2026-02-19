

# Aplicar Distribuicao de Leads nas Compras Diretas A010

## Problema
A funcao `createOrUpdateCRMContact` (usada quando alguem compra A010 direto na Hubla) cria deals no pipeline "PIPELINE INSIDE SALES", mas nao passa pelo sistema de distribuicao. O owner e herdado de outro deal ou fica nulo. Robert nao recebe esses leads.

## Solucao
Adicionar a mesma logica de distribuicao que foi implementada no `clint-webhook-handler` dentro da funcao `createOrUpdateCRMContact` no arquivo `supabase/functions/hubla-webhook-handler/index.ts`.

## Onde a mudanca acontece

### Arquivo: `supabase/functions/hubla-webhook-handler/index.ts`

**Trecho afetado: linhas 509-551** (dentro de `createOrUpdateCRMContact`, secao de criacao do deal)

Logica atual:
```text
contactId + originId prontos
  |
  v
Herda owner de outro deal do mesmo contato (ou null)
  |
  v
Cria deal com owner herdado ou sem owner
```

Logica nova:
```text
contactId + originId prontos
  |
  v
Verifica se existe distribuicao ativa para essa origin_id
  |
  +--> SIM: chama get_next_lead_owner(origin_id) --> owner = resultado
  |
  +--> NAO: herda owner de outro deal do mesmo contato (comportamento atual)
  |
  v
Cria deal com owner distribuido ou herdado
```

### Detalhes da mudanca

1. Antes de buscar o owner herdado (linha 510), verificar se existe distribuicao ativa para `originId`
2. Se existir, chamar `get_next_lead_owner` e usar o resultado como owner
3. Buscar o `owner_profile_id` correspondente ao email retornado
4. Se nao existir distribuicao, manter o comportamento atual (herdar owner de outro deal)
5. Salvar `distributed: true` e `owner_original` nos `custom_fields` quando houver redistribuicao

### Impacto
- Compras diretas do A010 via Hubla passarao pela distribuicao configurada na tela
- Robert passara a receber leads tanto do Clint quanto de compras diretas
- Se a distribuicao estiver desativada, o comportamento atual e mantido (heranca de owner)
