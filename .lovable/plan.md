
# Correcao: Erro ao criar carta de consorcio

## Diagnostico

O erro nos logs do Postgres e claro:

```
insert or update on table "consortium_cards" violates foreign key constraint "consortium_cards_vendedor_id_fkey"
```

**Causa raiz:** A coluna `vendedor_id` na tabela `consortium_cards` tem uma foreign key apontando para a tabela `profiles`. Porem, o formulario envia IDs da tabela `consorcio_vendedor_options` (tabela de configuracao de vendedores). Esses IDs sao UUIDs diferentes e nao existem em `profiles`, causando a violacao de FK.

Exemplo:
- ID do vendedor "Joao Pedro" em `consorcio_vendedor_options`: `0789a02a-a280-4965-814f-ff9bef58720c`
- Esse ID nao existe na tabela `profiles`, entao o INSERT falha

## Solucao

Remover a foreign key constraint `consortium_cards_vendedor_id_fkey` que liga `vendedor_id` a `profiles`. A coluna continua como UUID nullable, mas sem a restricao que impede o uso dos IDs de `consorcio_vendedor_options`.

## Detalhes Tecnicos

### Migracao SQL

```sql
ALTER TABLE consortium_cards 
DROP CONSTRAINT consortium_cards_vendedor_id_fkey;
```

Isso e seguro porque:
- A coluna `vendedor_id` ja e nullable (nao quebra dados existentes)
- O campo `vendedor_name` continua guardando o nome como texto (redundancia util)
- Nenhum outro codigo depende dessa FK para JOINs com `profiles`
- A tabela `consorcio_vendedor_options` e a fonte correta desses IDs

### Nenhuma mudanca no frontend
O formulario ja funciona corretamente - o problema e exclusivamente a constraint no banco.
