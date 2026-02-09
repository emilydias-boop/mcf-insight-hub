
# Corrigir Leads Invisíveis para SDRs (owner_profile_id = NULL)

## Problema

Os novos leads que chegam via webhook do Clint não aparecem para os SDRs porque o campo `owner_profile_id` está NULL. O CRM filtra por esse campo para SDRs/Closers (`query.eq('owner_profile_id', user.id)`), então leads sem esse campo ficam invisíveis.

| Dado | Valor |
|------|-------|
| Leads de hoje sem owner_profile_id | 21 |
| Leads de hoje com owner_profile_id | 0 |
| Causa raiz | Caminho de criacao no DEAL.STAGE_CHANGED nao resolve UUID |

## Causa Raiz

No `clint-webhook-handler`, existem dois caminhos de criacao de deals:

1. **DEAL.CREATED** (linhas 611-662): Busca `owner_profile_id` corretamente via lookup na tabela `profiles`
2. **DEAL.STAGE_CHANGED** (linhas 1044-1062): Cria o deal **sem** `owner_profile_id` quando o deal nao existe ainda

O segundo caminho e o mais usado (Clint envia `DEAL.STAGE_CHANGED` quando o lead muda de estagio, mesmo que seja a primeira vez que o sistema ve esse deal). Resultado: todos os deals criados por esse caminho ficam com `owner_profile_id = NULL`.

## Solucao

### Passo 1: Corrigir o webhook (prevencao)

No `clint-webhook-handler/index.ts`, adicionar lookup do `owner_profile_id` antes da insercao do deal no caminho `DEAL.STAGE_CHANGED`:

```typescript
// Antes da linha 1044 (insert do deal)
const ownerEmail = data.deal_user || data.deal?.user || null;
let ownerProfileId: string | null = null;
if (ownerEmail) {
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', ownerEmail)
    .maybeSingle();
  if (ownerProfile) {
    ownerProfileId = ownerProfile.id;
  }
}

// No insert, adicionar:
owner_profile_id: ownerProfileId,
```

### Passo 2: Corrigir dados existentes (retroativo)

Executar uma migracao SQL para sincronizar todos os deals que tem `owner_id` mas nao tem `owner_profile_id`:

```sql
UPDATE crm_deals d
SET owner_profile_id = p.id
FROM profiles p
WHERE d.owner_id = p.email
  AND d.owner_profile_id IS NULL
  AND d.owner_id IS NOT NULL;
```

### Passo 3: Adicionar trigger de seguranca (prevencao permanente)

Criar um trigger que sincronize automaticamente `owner_profile_id` sempre que `owner_id` for inserido/atualizado sem o UUID correspondente:

```sql
CREATE OR REPLACE FUNCTION sync_owner_profile_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL AND NEW.owner_profile_id IS NULL THEN
    SELECT id INTO NEW.owner_profile_id
    FROM profiles
    WHERE email = NEW.owner_id
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_owner_profile_id
BEFORE INSERT OR UPDATE ON crm_deals
FOR EACH ROW
EXECUTE FUNCTION sync_owner_profile_id();
```

Este trigger garante que mesmo que algum webhook ou importacao futura esqueca de resolver o UUID, o banco resolve automaticamente.

## Arquivos a Modificar

| Local | Mudanca |
|-------|---------|
| `supabase/functions/clint-webhook-handler/index.ts` | Adicionar lookup de owner_profile_id no caminho DEAL.STAGE_CHANGED (linhas 1038-1062) |
| Migracao SQL | Sincronizar deals existentes + criar trigger de seguranca |

## Resultado Esperado

- Os 21 leads de hoje serao imediatamente visiveis para os SDRs apos a migracao
- Todos os leads futuros terao `owner_profile_id` preenchido automaticamente (pelo webhook corrigido + trigger de seguranca)
- Nenhum lead ficara "invisivel" novamente, independente do caminho de entrada

## Secao Tecnica

Fluxo corrigido:

```text
Clint Webhook (DEAL.STAGE_CHANGED)
        |
        v
  Deal existe? --NO--> Criar deal
        |                    |
        |               Lookup profiles.id  <-- FIX APLICADO
        |                    |
        |               INSERT com owner_profile_id
        |
       YES
        |
  Deal tem owner? --NO--> Update owner_id + owner_profile_id
        |
       YES --> Manter owner atual
        
  [BACKUP] Trigger: sync_owner_profile_id()
  Se qualquer INSERT/UPDATE chegar sem owner_profile_id,
  o trigger resolve automaticamente via tabela profiles.
```
