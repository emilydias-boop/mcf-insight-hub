
# Plano: Transferir 108 Leads para Ithaline

## Situação Identificada

| Item | Valor |
|------|-------|
| Pipeline | Efeito Alavanca + Clube |
| Origin ID | `7d7b1cb5-2a44-4552-9eff-c3b798646b78` |
| Total de deals órfãos no pipeline | 3.419 |
| Leads na lista da Ithaline | 108 |
| Match exato confirmado | ✅ Nomes batem perfeitamente |

### Dados da Ithaline
- **Profile ID**: `411e4b5d-8183-4d6a-b841-88c71d50955f`
- **Email**: `ithaline.clara@minhacasafinanciada.com`
- **Nome**: `ithaline clara dos santos`

---

## Solução

Usar a Edge Function `bulk-transfer-by-name` já existente para transferir os 108 deals órfãos para a Ithaline.

---

## Execução

Chamar a função com os 108 nomes da lista:

```json
{
  "names": [
    "Ailton Aparecido de Sá",
    "Alan Edermann",
    "Aleandre da",
    "ALEX ALBUQUERQUE SILVA",
    "Alex Castro Wiedemann",
    "Alex Ribeiro dos santos",
    "Alisson de morais",
    "Amanda Andrade Silva",
    "Anderson Ferreira",
    "Andre",
    ... (mais 98 nomes)
  ],
  "origin_id": "7d7b1cb5-2a44-4552-9eff-c3b798646b78",
  "new_owner_email": "ithaline.clara@minhacasafinanciada.com",
  "new_owner_profile_id": "411e4b5d-8183-4d6a-b841-88c71d50955f",
  "new_owner_name": "ithaline clara dos santos"
}
```

---

## Fluxo da Transferência

```text
Lista de 108 nomes
        |
        v
+------------------------+
| Edge Function          |
| bulk-transfer-by-name  |
+------------------------+
        |
        v
+------------------------+
| SELECT deals WHERE     |
| origin_id = Alavanca   |
| AND owner_id IS NULL   |
| AND name IN (lista)    |
+------------------------+
        |
        v
+------------------------+
| UPDATE deals SET       |
| owner_id = ithaline    |
| owner_profile_id = ... |
+------------------------+
        |
        v
+------------------------+
| INSERT deal_activities |
| (log de auditoria)     |
+------------------------+
        |
        v
Resultado: ~108 deals transferidos
```

---

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Deals órfãos no Alavanca | 3.419 | ~3.311 |
| Deals da Ithaline | 0 | ~108 |

---

## Arquivos Modificados

Nenhum arquivo será criado ou modificado. Apenas executarei a Edge Function existente com os dados fornecidos.

---

## Observações

1. A função usa match **exato** de nomes (case-sensitive)
2. Os nomes foram verificados e batem perfeitamente com os deals no banco
3. Cada transferência será registrada em `deal_activities` para auditoria
4. Os contatos já foram importados na etapa anterior, então os deals serão automaticamente vinculados
