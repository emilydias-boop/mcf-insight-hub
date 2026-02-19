
# Distribuicao de Leads via Clint Webhook

## Problema
O `clint-webhook-handler` recebe ~85% dos leads mas ignora a configuracao de distribuicao da tela. Ele usa diretamente o `deal_user` (email) que vem do Clint, por isso o Robert nunca recebe leads.

## Solucao
Modificar a funcao `handleDealCreated` no `clint-webhook-handler` para consultar a tabela `lead_distribution_config` antes de definir o owner. Se houver distribuicao ativa para aquela origin, usar `get_next_lead_owner()` em vez do owner do Clint.

## Onde a mudanca acontece

### Arquivo: `supabase/functions/clint-webhook-handler/index.ts`

**Trecho afetado: linhas 670-691** (entre resolver a origin e criar o deal)

Logica atual:
```text
originId resolvido
  |
  v
ownerId = deal_user do Clint (fixo)
  |
  v
Busca profile_id do owner
  |
  v
Cria deal com esse owner
```

Logica nova:
```text
originId resolvido
  |
  v
Verifica se existe distribuicao ativa para essa origin_id
  |
  +--> SIM: chama get_next_lead_owner(origin_id) --> ownerId = resultado
  |
  +--> NAO: ownerId = deal_user do Clint (comportamento atual)
  |
  v
Busca profile_id do owner
  |
  v
Cria deal com esse owner
```

### Codigo a ser adicionado (entre linhas 669 e 671)

Apos resolver a `originId`, antes de definir o `ownerId`:

1. Consultar `lead_distribution_config` filtrando por `origin_id` e `is_active = true`
2. Se existirem registros, chamar `supabase.rpc('get_next_lead_owner', { p_origin_id: originId })`
3. Usar o resultado como `ownerId` (email), guardando o `deal_user` original nos `custom_fields` para rastreabilidade
4. Se nao existirem registros, manter o `deal_user` do Clint como hoje

### Preservacao do owner original

O `deal_user` original do Clint sera salvo em `custom_fields.deal_user_original` para auditoria, garantindo que se possa rastrear de onde o lead veio antes da redistribuicao.

### Nenhuma mudanca no frontend

A tela de configuracao de distribuicao ja funciona. A unica mudanca e no backend para que o Clint respeite essa configuracao.

### Impacto esperado

- Robert passara a receber leads na proporcao configurada na tela (junto com os outros SDRs)
- Contadores da tela de distribuicao refletirao todos os leads, incluindo os do Clint
- Se a distribuicao for desativada para uma origin, o comportamento volta ao normal
