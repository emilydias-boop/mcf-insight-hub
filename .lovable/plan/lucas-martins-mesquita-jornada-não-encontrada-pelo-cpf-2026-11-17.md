# Lucas Martins Mesquita — jornada não encontrada pelo CPF

## O que foi encontrado
- O cartão dele no Pós-venda existe (com Rebeca, etapa "Reunião de Viabilidade 1"), mas está sem CPF.
- As compras com o mesmo e-mail e telefone usam **dois CPFs**:
  - 117.369.496-08 — A000 (06/11) e A001 (13/11)
  - 148.392.816-02 — A010 (04/11, duas vezes) e A001 (13/11)
- Por segurança, a jornada só se liga a um cartão quando as compras dele têm um único CPF. Com dois, o sistema não sabe de quem é e responde "Não encontramos".
- A diferença de nome (LUCA no HARVEY e Lucas no Gestão) não é a causa.

## O que fazer
1. Gravar o CPF 117.369.496-08 no cartão do Lucas no Pós-venda.
2. Ajustar a regra: quando o cartão tem CPF gravado e esse CPF aparece nas compras dele, a jornada usa esse CPF mesmo se houver outro CPF nas compras. Cartões sem CPF continuam com a regra atual.
3. Testar na página da jornada com 117.369.496-08 e conferir que aparece Rebeca como gerente.
4. Listar outros clientes com o mesmo problema (dois CPFs), sem alterar nenhum deles.

## Para confirmar
- O CPF 148.392.816-02 pode ser de outra pessoa que pagou por ele. Se esse CPF também precisar abrir a jornada, me avise.

## Detalhes técnicos
- `jornada_resolver_cpf`: aceitar o cartão quando `crm_deals.cpf` está preenchido e é um dos CPFs candidatos (hoje exige `count(DISTINCT cpf)=1`).
- Atualizar `crm_deals.cpf` do cartão 15024d6b; nenhuma outra tabela ou outra BU é alterada.
