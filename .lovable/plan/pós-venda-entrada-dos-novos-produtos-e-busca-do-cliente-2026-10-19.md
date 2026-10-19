# Pós-Venda: entrada dos novos produtos e busca do cliente

## O que a consulta mostrou (só leitura)
- **NAEMISSON CIRQUEIRA ROCHA já está no Pós-Venda.** A venda A009 da Hubla de 17/10 às 15:06 (pedido f619748f…) criou o card na hora, na etapa "Novos licenciados", com a responsável Karen Nazario.
- O card foi gravado como **"Naêmisson Cirqueira Rocha"**, com acento no "ê", porque foi assim que a Hubla mandou o nome.
- **Causa:** a busca de cliente na janela "Nova reunião" da Agenda do Pós-Venda procura só pelo nome e diferencia acento. Quem digita "Naemisson" não encontra "Naêmisson". A busca também não procura por e-mail nem por telefone.
- Produtos: hoje entram A001, A003, A004, A009, R001, R002, R004 e R009. **R003, A005 e R005 não entram.**

## O que será feito
1. **Busca da Agenda do Pós-Venda (Nova reunião):** encontrar o cliente sem diferenciar acento ("naemisson" encontra "Naêmisson"), e também pelo e-mail ou pelo telefone do contato. A busca continua restrita à pipeline do Pós-Venda.
2. **Produtos que criam card no Pós-Venda:** manter os atuais e somar **R003, A005 e R005**. As outras regras não mudam: reembolso, renovação, ofertas e parcela 2 em diante continuam de fora, e a distribuição para os gerentes também.
3. Nada é retroativo. Se você quiser, faço depois uma lista, só para leitura, de quem comprou R003, A005 ou R005 e não tem card.

## Detalhes técnicos
- Front (`AgendaPosVenda.tsx`, `NovaReuniaoDialog`): trocar `ilike('name')` por uma busca que normaliza o termo (sem acento) e procura em `name`, e-mail e telefone dos contatos, via `crm_contacts`, com `contact_id.in.(...)` e sempre filtrada por `POS_VENDA_ORIGIN_ID`. Para ignorar acento no banco, usar a extensão `unaccent`, se já existir. Se não existir, buscar com variações do termo ou fazer uma RPC de leitura (aviso antes).
- Migração: `CREATE OR REPLACE` de `pos_venda_on_venda`, mudando só a lista `IN (...)` para incluir 'R003','A005','R005'. O gatilho `zzz_pos_venda_entrada` e o resto da função ficam iguais.
- Verificação: typecheck/build, busca "naemisson" retornando o card 8e608d3b, conferência da definição nova da função. Nada publicado.
