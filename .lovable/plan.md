

# Correcao: Foreign Key do vendedor_id ainda aponta para profiles

## Situacao atual

Confirmei agora no banco de dados que a constraint `consortium_cards_vendedor_id_fkey` ainda referencia `profiles(id)`. As migracoes propostas anteriormente nao foram aplicadas, por isso o erro continua.

## O que precisa ser feito

Executar uma unica migracao SQL no banco:

1. Remover a foreign key incorreta que aponta para `profiles`
2. Criar a foreign key correta apontando para `consorcio_vendedor_options`

## Detalhes tecnicos

```text
ALTER TABLE consortium_cards DROP CONSTRAINT consortium_cards_vendedor_id_fkey;

ALTER TABLE consortium_cards ADD CONSTRAINT consortium_cards_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES consorcio_vendedor_options(id)
  ON DELETE SET NULL;
```

Nenhum codigo precisa ser alterado. Apenas essa correcao no banco de dados.

## Resultado esperado

- Criar e editar cartas com vendedor selecionado funciona sem erro
- Se um vendedor for removido do catalogo, as cartas ficam com vendedor em branco

