

# Marcar Transacoes A000 do Lancamento como Launch

## Problema Identificado

Os contratos **A000 - Contrato MCF** vendidos pelo link de lancamento (`hub.la/iJXA3NxU83uPBplff5z9`) estao com `sale_origin = NULL` no banco. Apenas as parcerias dos 25 emails fornecidos anteriormente foram marcadas -- os A000 nao foram.

**Dados atuais no banco (Janeiro):**
- A000 sem tag: 535 transacoes
- A000 com tag launch: 73 transacoes
- Precisam ser marcadas: todas as transacoes dos 45 emails do Excel

## Solucao

Executar um UPDATE no banco de dados para marcar como `sale_origin = 'launch'` **todas as transacoes** dos 45 emails do Excel que ainda nao estao marcadas.

## Alteracao

### Migracao SQL

Um unico UPDATE que marca todas as transacoes (A000, parcerias, bumps, etc.) dos emails do Excel como launch:

```text
UPDATE hubla_transactions
SET sale_origin = 'launch'
WHERE sale_origin IS NULL
  AND lower(customer_email) IN (
    'olavovilela10@gmail.com',
    'harissonoliveira27@gmail.com',
    'sandrojuniores@hotmail.com',
    'engenheiroyurimonteiro@gmail.com',
    'paulo@lbastar.com.br',
    'linofernandoviveiros@gmail.com',
    'dil_903@hotmail.com',
    'alexriolargo2015@outlook.com',
    'fernandamauzer@gmail.com',
    'shssilva2016@gmail.com',
    'fabioacq10@gmail.com',
    'liga.contato@gmail.com',
    'sulymanreformas@gmail.com',
    'drpedrohquirino@gmail.com',
    'robson@roarquitetura.net',
    'viniciusevertom@hotmail.com',
    'r.966178000@gmail.com',
    'wmplastica@gmail.com',
    'brenolucas@gmail.com',
    'david@dlarconstrutora.com.br',
    'wandeeley.aragao36@gmail.com',
    'ricardson.rocha@gmail.com',
    'luzisilva1987@gmail.com',
    'alessandrosantanasouza4@gmail.com',
    'joseclerqb@gmail.com',
    'abraopericias@gmail.com',
    'fernandaholdorf@gmail.com',
    'arlan_unai45@hotmail.com',
    'thiago.vilhena@hotmail.com',
    'lincon_ferrera@hotmail.com',
    'jfmoveis@icloud.com',
    'ettorifernandes94@gmail.com',
    'gobira.thon@gmail.com',
    'alessandro.perossi@hotmail.com',
    'rodrigomoreira@harpiapecas.com.br',
    'edinho.vasques@yahoo.com.br',
    'rjcoliveira80@gmail.com',
    'chavesjunior60@gmail.com',
    'neynrap2017@gmail.com',
    'americopercinato@gmail.com',
    'wallceveras@gmail.com',
    'pedrofmanco@outlool.com.br',
    'thiago.c.machado@icloud.com',
    'augusto_landiva@hotmail.com',
    'goncalves.wesley@hotmail.com'
  );
```

Nota: o email do Pedro Ferreira no Excel aparece como `pedrofmanco@outlool.com.br` (com typo "outlool"), diferente do email fornecido na lista anterior (`pedrofmanco@outlook.com.br`). O UPDATE usa o email exato do Excel para garantir o match.

### Nenhuma alteracao de codigo

O codigo do `CloserRevenueSummaryTable.tsx` ja esta correto -- prioriza `sale_origin === 'launch'` antes do matching de closers. O problema era apenas dados nao marcados no banco.

## Resultado Esperado

- Todas as transacoes dos 45 compradores do lancamento serao marcadas como `launch`
- A linha "Lancamento" no relatorio mostrara o faturamento correto incluindo os contratos A000
- Os totais por closer diminuirao proporcionalmente (essas vendas serao removidas dos closers)

