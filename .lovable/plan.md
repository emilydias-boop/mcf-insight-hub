

# Fix: Distribuicao de Leads Nao Funciona para Robert (e outros)

## Causa Raiz Identificada

O Clint envia **exclusivamente** eventos `deal.stage_changed` -- foram **2107 eventos** desde fevereiro, e **ZERO** eventos `deal.created`.

A logica de distribuicao (`get_next_lead_owner`) esta **apenas** no handler `handleDealCreated`, que **nunca e executado** porque o Clint nao envia esse tipo de evento.

Quando o `handleDealStageChanged` recebe um lead novo e nao encontra o deal no banco, ele **cria o deal diretamente** usando o `deal_user` do Clint (o owner que o Clint atribuiu), **sem consultar a distribuicao**.

### Por que o contador mostra 28?

Outros webhooks (como `webhook-lead-receiver` para formularios de Lead Gratuito e `hubla-webhook-handler`) **usam** a distribuicao corretamente. Esses webhooks chamam `get_next_lead_owner`, o que incrementa o contador. Porem, a grande maioria dos leads entra pelo Clint via `deal.stage_changed`, ignorando a distribuicao.

## Correcao

### Arquivo: `supabase/functions/clint-webhook-handler/index.ts`

Na funcao `handleDealStageChanged`, quando um deal NAO e encontrado e precisa ser criado (por volta da linha 1158), adicionar a mesma logica de distribuicao que existe no `handleDealCreated`:

1. Antes de criar o deal, verificar se existe `lead_distribution_config` ativa para a `origin_id`
2. Se existir, chamar `get_next_lead_owner(origin_id)` para obter o proximo dono
3. Usar o owner distribuido ao inves do `deal_user` do Clint
4. Marcar `custom_fields.distributed = true` e salvar `deal_user_original`

Codigo a adicionar (antes da insercao do deal na linha 1178):

```typescript
// Verificar distribuicao ativa antes de usar deal_user do Clint
let finalOwnerEmail = ownerEmail;
let finalOwnerProfileId = ownerProfileId;
let wasDistributed = false;

if (originId) {
  try {
    const { data: distConfig } = await supabase
      .from('lead_distribution_config')
      .select('id')
      .eq('origin_id', originId)
      .eq('is_active', true)
      .limit(1);

    if (distConfig && distConfig.length > 0) {
      const { data: nextOwner, error: distError } = await supabase
        .rpc('get_next_lead_owner', { p_origin_id: originId });

      if (!distError && nextOwner) {
        finalOwnerEmail = nextOwner;
        wasDistributed = true;

        // Resolver profile_id do owner distribuido
        const { data: distProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', finalOwnerEmail)
          .maybeSingle();
        if (distProfile) {
          finalOwnerProfileId = distProfile.id;
        }
      }
    }
  } catch (err) {
    console.log('[DEAL.STAGE_CHANGED] Erro na distribuicao:', err);
  }
}
```

E atualizar o INSERT do deal para usar `finalOwnerEmail`/`finalOwnerProfileId` e adicionar flags de distribuicao nos custom_fields.

### Tambem: Resetar contadores

Apos o deploy, resetar os contadores da distribuicao para que todos os SDRs partam do zero e a distribuicao seja justa novamente. Isso pode ser feito pelo botao "Resetar Contadores" na UI.

## Resumo

| Item | Detalhe |
|------|---------|
| Problema | Clint envia apenas `deal.stage_changed`, e a distribuicao so existe em `handleDealCreated` |
| Impacto | Robert (e potencialmente outros) nao recebe leads novos; leads vao para quem o Clint define |
| Correcao | Adicionar logica de distribuicao ao criar deals dentro de `handleDealStageChanged` |
| Arquivo | `supabase/functions/clint-webhook-handler/index.ts` (linhas ~1158-1209) |
| Pos-deploy | Resetar contadores via UI |

