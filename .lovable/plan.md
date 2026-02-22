

# Correcao: Foreign Key do vendedor_id apontando para tabela errada

## O que esta acontecendo

Quando voce seleciona um vendedor e salva a carta, o banco de dados rejeita porque ele tenta verificar se o ID do vendedor existe na tabela de **perfis de usuario** (`profiles`). Porem, os vendedores sao cadastrados em uma tabela separada (`consorcio_vendedor_options`), entao os IDs nunca vao bater.

Quando voce **remove** o vendedor, o campo vai vazio e nao ha verificacao — por isso funciona sem vendedor.

## O que precisa ser feito

Uma unica alteracao no banco de dados:

- Remover a referencia incorreta para a tabela `profiles`
- Criar uma nova referencia para a tabela correta `consorcio_vendedor_options`

Nenhum codigo precisa ser alterado. O formulario e os hooks ja estao corretos.

## Detalhes tecnicos

Migracao SQL a ser executada:

```text
ALTER TABLE consortium_cards DROP CONSTRAINT consortium_cards_vendedor_id_fkey;

ALTER TABLE consortium_cards ADD CONSTRAINT consortium_cards_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES consorcio_vendedor_options(id)
  ON DELETE SET NULL;
```

## Resultado esperado

- Criar e editar cartas com vendedor selecionado funciona sem erro
- Se um vendedor for removido do catalogo, as cartas associadas ficam com vendedor em branco (sem quebrar)

