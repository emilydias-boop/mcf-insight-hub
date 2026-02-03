

# Plano: Vincular Contatos aos Leads do Ygor

## Diagnóstico

| Situação | Status |
|----------|--------|
| Contatos na base (crm_contacts) | Existem (já foram importados) |
| Deals do Ygor | 108 deals com `contact_id = NULL` |
| Problema | Deals não vinculados aos contatos |

Os contatos já têm email e telefone, mas os deals do Ygor não estão vinculados a eles.

---

## Solução

Usar a Edge Function `bulk-update-contacts` que:
1. Encontra o contato existente por email (já temos os dados)
2. Vincula o contato ao deal do owner usando match por nome (ILIKE)

---

## Execução

Chamar a função com os 108 contatos e o owner_id do Ygor:

```json
{
  "owner_id": "ygor.ferreira@minhacasafinanciada.com",
  "contacts": [
    {
      "clint_id": "1b7b30b7-3e26-44e6-ada2-1a1ed2c5e3fc",
      "name": "Ailton Aparecido de Sá",
      "email": "ailtonapsa@gmail.com",
      "phone": "+55 11981870466"
    },
    ... (mais 107 contatos)
  ]
}
```

---

## Fluxo Esperado

```text
108 contatos com email/telefone
              |
              v
+-----------------------------+
| Edge Function               |
| bulk-update-contacts        |
+-----------------------------+
              |
              v
+-----------------------------+
| Para cada contato:          |
| 1. Buscar por email         |
| 2. Se existir, pegar ID     |
| 3. Vincular ao deal do Ygor |
|    onde name ILIKE contato  |
+-----------------------------+
              |
              v
Deals vinculados com contatos
(agora visíveis com email/telefone)
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 108 deals sem contato | 108 deals com contato vinculado |
| Sem email/telefone visível | Email e telefone do contato visíveis |

---

## Observações Técnicas

1. A função `bulk-update-contacts` já está deployada e funcionando
2. Ela usa `ILIKE` para match flexível de nomes
3. Os contatos já existem na base (foram importados para a Ithaline anteriormente)
4. A vinculação será feita nos deals que pertencem ao Ygor (`owner_id`)

