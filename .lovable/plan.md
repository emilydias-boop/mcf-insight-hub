
# Plano: Corrigir Transferência - 108 Leads da Ithaline → Ygor

## Situação

Os 108 leads foram transferidos erroneamente para a Ithaline Clara e precisam ser corrigidos para o Ygor Ferreira.

| Item | Valor |
|------|-------|
| Pipeline | Efeito Alavanca + Clube |
| Origin ID | `7d7b1cb5-2a44-4552-9eff-c3b798646b78` |
| Leads a transferir | 108 |

### Owners Envolvidos

| De (Ithaline) | Para (Ygor) |
|---------------|-------------|
| Profile ID: `411e4b5d-8183-4d6a-b841-88c71d50955f` | Profile ID: `d523e03f-6a23-4668-8286-9ccbba2a5d35` |
| Email: `ithaline.clara@minhacasafinanciada.com` | Email: `ygor.ferreira@minhacasafinanciada.com` |

---

## Solução

Executar UPDATE direto nos 108 deals que estão atualmente com a Ithaline neste pipeline, transferindo para o Ygor.

---

## Execução

Usar a Edge Function `bulk-transfer-by-name` com os mesmos 108 nomes, mas agora direcionando para o Ygor:

```json
{
  "names": [lista dos 108 nomes],
  "origin_id": "7d7b1cb5-2a44-4552-9eff-c3b798646b78",
  "new_owner_email": "ygor.ferreira@minhacasafinanciada.com",
  "new_owner_profile_id": "d523e03f-6a23-4668-8286-9ccbba2a5d35",
  "new_owner_name": "Ygor Ferreira"
}
```

**Obs:** A função `bulk-transfer-by-name` busca deals por nome E `owner_id IS NULL`. Como os deals agora têm owner (Ithaline), precisarei modificar a abordagem para buscar por owner atual OU usar uma query direta.

---

## Abordagem Alternativa (Mais Segura)

Como os deals já têm owner, vou usar uma query direta via Supabase para transferir todos os deals da Ithaline neste pipeline para o Ygor:

```sql
UPDATE crm_deals 
SET owner_id = 'ygor.ferreira@minhacasafinanciada.com',
    owner_profile_id = 'd523e03f-6a23-4668-8286-9ccbba2a5d35',
    updated_at = NOW()
WHERE owner_profile_id = '411e4b5d-8183-4d6a-b841-88c71d50955f'
  AND origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
```

---

## Fluxo

```text
108 deals da Ithaline
         |
         v
+------------------------+
| UPDATE crm_deals       |
| SET owner = Ygor       |
| WHERE owner = Ithaline |
| AND origin = Alavanca  |
+------------------------+
         |
         v
108 deals transferidos para Ygor
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Deals da Ithaline (Alavanca) | 108 | 0 |
| Deals do Ygor (Alavanca) | 0 | 108 |

---

## Arquivos Modificados

Nenhum arquivo será modificado. Executarei a transferência via query no banco de dados.
