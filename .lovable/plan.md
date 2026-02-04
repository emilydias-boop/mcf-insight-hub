
# Plano: Adicionar Grupo "Perpétuo - X1" ao Consórcio

## Problema
A pipeline "PIPELINE - INSIDE SALES - VIVER DE ALUGUEL" está mapeada como **origin**, mas o dropdown de funis na sidebar filtra por **groups**. O grupo pai "Perpétuo - X1" não está mapeado para o Consórcio no banco de dados.

## Dados

| Item | ID |
|------|-----|
| Grupo pai | Perpétuo - X1 (`a6f3cbfc-0567-427f-a405-5a869aaa6010`) |
| Origin filha | PIPELINE - INSIDE SALES - VIVER DE ALUGUEL (`4e2b810a-6782-4ce9-9c0d-10d04c018636`) |

## Solução

Adicionar o grupo "Perpétuo - X1" como um mapeamento de **group** para o Consórcio no banco de dados:

```sql
INSERT INTO bu_origin_mapping (bu, entity_type, entity_id, is_default)
VALUES ('consorcio', 'group', 'a6f3cbfc-0567-427f-a405-5a869aaa6010', false)
ON CONFLICT DO NOTHING;
```

## Resultado Esperado

Após essa alteração:
- O dropdown de "Funil" mostrará o grupo "Perpétuo - X1"
- Ao selecionar esse grupo, a sidebar exibirá a origin "PIPELINE - INSIDE SALES - VIVER DE ALUGUEL"
- A navegação para essa pipeline funcionará corretamente

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| Banco de dados (via SQL) | Inserir grupo no `bu_origin_mapping` |
