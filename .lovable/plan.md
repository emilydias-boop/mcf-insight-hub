
# Sincronizacao Bidirecional: Pipeline GR e Carteiras GR

## Situacao Atual

Identificamos que os 1.867 leads na pipeline "00 - GERENTES DE RELACIONAMENTO" **nao estao sincronizados** com as carteiras GR:

| Dado | Situacao |
|------|----------|
| Leads na pipeline GR | 1.867 deals |
| Entradas em `gr_wallet_entries` | 0 |
| Carteira do William | Criada (vazia) |
| Carteira da Marceline | **NAO EXISTE** |

## Problemas

1. **Marceline nao tem carteira GR** - precisa ser criada
2. **Deals nao populam carteiras automaticamente** - falta trigger/funcao
3. **Nenhuma sincronizacao bidirecional** entre CRM e carteiras

## Solucao Proposta

### 1. Criar carteira para Marceline

```sql
INSERT INTO gr_wallets (gr_user_id, bu, max_capacity)
SELECT '094a75c9-7e87-4886-be1a-1dba4297173f', 'credito', 700
WHERE NOT EXISTS (
  SELECT 1 FROM gr_wallets WHERE gr_user_id = '094a75c9-7e87-4886-be1a-1dba4297173f'
);
```

### 2. Sincronizar deals existentes com carteiras

Criar funcao SQL que popula `gr_wallet_entries` baseado nos deals existentes:

```sql
CREATE OR REPLACE FUNCTION sync_crm_deals_to_gr_wallets()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  synced_count integer := 0;
  deal_row RECORD;
  v_wallet_id UUID;
BEGIN
  -- Buscar todos os deals da pipeline GR que ainda nao tem entrada na carteira
  FOR deal_row IN 
    SELECT 
      d.id as deal_id,
      d.name,
      d.value,
      d.contact_id,
      d.owner_id,
      d.created_at,
      c.email as contact_email,
      c.phone as contact_phone,
      p.id as owner_profile_id
    FROM crm_deals d
    LEFT JOIN crm_contacts c ON c.id = d.contact_id
    LEFT JOIN profiles p ON p.email = d.owner_id
    WHERE d.origin_id = '016e7467-e105-4d9a-9ff5-ecfe5f915e0c'  -- Pipeline GR
      AND NOT EXISTS (
        SELECT 1 FROM gr_wallet_entries gwe WHERE gwe.deal_id = d.id
      )
  LOOP
    -- Buscar carteira do owner
    SELECT id INTO v_wallet_id
    FROM gr_wallets
    WHERE gr_user_id = deal_row.owner_profile_id;
    
    IF v_wallet_id IS NOT NULL THEN
      INSERT INTO gr_wallet_entries (
        wallet_id, deal_id, contact_id, customer_name, 
        customer_email, customer_phone, status, entry_source,
        product_purchased, purchase_value, entry_date
      ) VALUES (
        v_wallet_id, deal_row.deal_id, deal_row.contact_id,
        deal_row.name, deal_row.contact_email, deal_row.contact_phone,
        'ativo', 'crm_sync', NULL, deal_row.value, deal_row.created_at
      );
      synced_count := synced_count + 1;
    END IF;
  END LOOP;
  
  RETURN synced_count;
END;
$$;
```

### 3. Criar trigger para sincronizacao automatica futura

Trigger que sincroniza novos deals/mudancas com as carteiras:

```sql
CREATE OR REPLACE FUNCTION sync_deal_to_gr_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet_id UUID;
  v_owner_profile_id UUID;
  v_contact crm_contacts%ROWTYPE;
BEGIN
  -- Apenas para pipeline GR
  IF NEW.origin_id != '016e7467-e105-4d9a-9ff5-ecfe5f915e0c' THEN
    RETURN NEW;
  END IF;
  
  -- Buscar profile do owner
  SELECT id INTO v_owner_profile_id
  FROM profiles WHERE email = NEW.owner_id;
  
  -- Buscar carteira do GR
  SELECT id INTO v_wallet_id
  FROM gr_wallets WHERE gr_user_id = v_owner_profile_id;
  
  -- Buscar dados do contato
  SELECT * INTO v_contact FROM crm_contacts WHERE id = NEW.contact_id;
  
  IF v_wallet_id IS NOT NULL THEN
    -- INSERT or UPDATE na carteira
    INSERT INTO gr_wallet_entries (
      wallet_id, deal_id, contact_id, customer_name,
      customer_email, customer_phone, status, entry_source,
      purchase_value, entry_date
    ) VALUES (
      v_wallet_id, NEW.id, NEW.contact_id, NEW.name,
      v_contact.email, v_contact.phone, 'ativo', 'crm_sync',
      NEW.value, COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (deal_id) DO UPDATE SET
      wallet_id = EXCLUDED.wallet_id,
      customer_name = EXCLUDED.customer_name,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_deal_to_gr
AFTER INSERT OR UPDATE OF owner_id, stage_id ON crm_deals
FOR EACH ROW
EXECUTE FUNCTION sync_deal_to_gr_wallet();
```

### 4. Sincronizacao reversa: Carteira para CRM

Quando GR atualiza status/stage na carteira, refletir no deal:

```sql
CREATE OR REPLACE FUNCTION sync_gr_entry_to_deal()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se mudou status, atualizar stage do deal correspondente
  IF NEW.deal_id IS NOT NULL AND OLD.status != NEW.status THEN
    -- Mapear status GR para stages do CRM
    -- (implementar mapeamento especifico)
    UPDATE crm_deals
    SET updated_at = NOW()
    WHERE id = NEW.deal_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_gr_to_deal
AFTER UPDATE OF status ON gr_wallet_entries
FOR EACH ROW
EXECUTE FUNCTION sync_gr_entry_to_deal();
```

## Fluxo Apos Implementacao

```text
                     Bidirecional
┌─────────────────┐ ◄──────────────► ┌─────────────────────┐
│  PIPELINE GR    │                  │  CARTEIRA GR        │
│  (crm_deals)    │                  │ (gr_wallet_entries) │
├─────────────────┤                  ├─────────────────────┤
│ ┌───────────┐   │   Novo Deal      │ ┌───────────────┐   │
│ │ Deal entra│───┼─────────────────►│ │ Entry criada  │   │
│ └───────────┘   │   (trigger)      │ └───────────────┘   │
│                 │                  │                     │
│ ┌───────────┐   │   Owner muda     │ ┌───────────────┐   │
│ │Owner muda │───┼─────────────────►│ │ Transferido   │   │
│ └───────────┘   │                  │ └───────────────┘   │
│                 │                  │                     │
│ ┌───────────┐   │   Status muda    │ ┌───────────────┐   │
│ │Stage atua.│◄──┼──────────────────│ │ Status atua.  │   │
│ └───────────┘   │   (trigger rev.) │ └───────────────┘   │
└─────────────────┘                  └─────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Criar carteira Marceline + funcao sync + triggers |
| Ajustar `gr_wallet_entries` | Adicionar constraint UNIQUE em deal_id |

## Resultado Esperado

1. Carteira da Marceline criada automaticamente
2. 1.867 deals sincronizados com carteiras (William: ~1.000, Marceline: ~800)
3. Novos deals que entram na pipeline GR criam entrada automatica
4. Mudanca de owner transfere entre carteiras
5. Acoes do GR refletem no CRM
