

# Fix: Foreign key invalida em vendedor_id do consortium_cards

## Problema

A coluna `vendedor_id` na tabela `consortium_cards` possui uma foreign key (`consortium_cards_vendedor_id_fkey`) que referencia `profiles(id)`. Porem, os vendedores sao gerenciados pela tabela independente `consorcio_vendedor_options`, cujos IDs nao existem na tabela `profiles`. Ao selecionar qualquer vendedor e salvar a carta, o banco rejeita o insert por violacao de foreign key.

## Solucao

Remover a foreign key constraint `consortium_cards_vendedor_id_fkey` da coluna `vendedor_id`. Essa coluna deve continuar existindo como campo texto/UUID livre, sem referencia a `profiles`.

Opcionalmente, criar uma nova FK apontando para `consorcio_vendedor_options(id)` para manter integridade referencial correta — porem com `ON DELETE SET NULL` para nao quebrar cartas se um vendedor for removido.

## Alteracoes

| Tipo | Detalhe |
|------|---------|
| Migracao SQL | `ALTER TABLE consortium_cards DROP CONSTRAINT consortium_cards_vendedor_id_fkey;` |
| (Opcional) Migracao SQL | `ALTER TABLE consortium_cards ADD CONSTRAINT consortium_cards_vendedor_id_fkey FOREIGN KEY (vendedor_id) REFERENCES consorcio_vendedor_options(id) ON DELETE SET NULL;` |

Nenhuma alteracao de codigo e necessaria. O formulario e hooks ja estao corretos.

## Resultado

- Criar e editar cartas com vendedor selecionado funciona sem erro
- Integridade referencial mantida contra a tabela correta (`consorcio_vendedor_options`)

