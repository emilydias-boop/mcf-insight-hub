# Clientes que não aparecem na agenda do Pós Venda

## O que a consulta mostrou (só leitura)
- **Barbara Mendonça Salomão**: nenhuma venda registrada por Hubla, Kiwify ou MCF Pay, nem cadastro com esse nome ou com o e-mail fsolucoes.comercial@gmail.com. Nenhum webhook com esses dados chegou.
  - O WhatsApp 85981128131 está gravado em outro cliente, **Wagner Santos** (admideias01@gmail.com). Ele comprou A009 em 02/10 pelo MCF Pay. A venda pode ter sido feita no nome dele.
- **Kawer de Avelar Tibaldi França**: o webhook chegou. Ele está cadastrado como "Kawer Avelar" (kaweravelartf@gmail.com), com A001 pago em 03/07/2026 pela Hubla. Hoje tem card em Inside Sales (Venda realizada) e em Gerentes de Relacionamento (Base 50K), mas **não tem card no Pós Venda**.
- **Causa:** a busca da agenda mostra só clientes que têm card na pipeline do Pós Venda. A entrada automática só vale para vendas pagas depois que ela foi ligada, em outubro. Por isso a venda de julho do Kawer não criou card. Wagner também não tem card no Pós Venda.

## Proposta (precisa da sua autorização, porque altera dados)
1. Criar o card do **Kawer** no Pós Venda, em "Novos licenciados", usando o mesmo procedimento da entrada automática. Assim ninguém é duplicado e a distribuição de gerentes é aplicada.
2. **Barbara:** confirmar com a Kallyane se ela é sócia ou compradora da venda do Wagner Santos.
   - Se for, crio o card do Wagner, ou um card com os dados da Barbara.
   - Se não for, ela não tem venda no sistema, e o comercial precisa conferir onde ela pagou.
3. Opcional: listar quem comprou A001/A003/A004/A009 antes de outubro e ainda não tem card no Pós Venda, só para você decidir. Nada seria criado sem sua aprovação.

Não é preciso alterar a tela, webhooks nem funções.
