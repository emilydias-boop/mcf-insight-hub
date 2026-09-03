# Relatório: trava sem-R1 (A) e desvio de R$ 1,39 mi (B)

## A — A trava NÃO falhou. Ela funcionou e foi usada com justificativa.

`proposal_details` da proposta `485819b8…` (texto cru):

```
[lead novo sem R1] Sócios MCF
Rodada 2 - Mutuantes 2026.1
```

Os **6 cadastros** têm exatamente o mesmo texto em `observacoes` (ids `990b82dc`, `5c5b5e6e`, `f31ffb4a`, `f8ae08ca`, `d58208a9`, `4502d4cf`, criados entre 22:41:48 e 22:41:56 de 27/08).

Leitura: o diálogo bloqueante apareceu, o operador clicou "Criar assim mesmo" e escreveu o motivo — "Sócios MCF / Rodada 2 - Mutuantes 2026.1", ou seja, foi tratado como venda de rodada de sócios/mutuantes, não como lead comercial. Não há furo de caminho: a trava está em `AddCartaModal.handleSubmit` (único arquivo que importa `useBuscarReuniaoConsorcio`, linha 45/286; prefixo gravado na linha 494) e foi por ali que a proposta passou. Não foi necessário checar `ProposalModal`/`AcceptProposalModal` como furo, porque o registro prova que o fluxo com trava foi o usado. O deploy de 26/08 estava no ar (o prefixo só existe nesse código).

Consequência real: o caso Naufel não é bug de trava, é **decisão consciente sem atribuição de closer** — a venda de sócios entra na produção como `sem_atribuicao`. Isso é regra de negócio a decidir, não código quebrado.

## B — O desvio de R$ 1,39 mi: parcialmente explicado por edição legítima, ~R$ 890 mil ainda em aberto.

Janela 01–26/08 pela RPC hoje: **R$ 16.220.000** (perna A R$ 5.220.000 / 27 cartas; perna B R$ 10.850.000 / 63 cartas; perna C R$ 150.000 / 1 carta).

Saídas legítimas após o print (26/08):
- Proposta `68a1624b` — "Thiago Felipe Faustino - EFEITO ALAVANCA", `proposal_date` 22/08, **R$ 500.000**, hoje `status = recusada` e `carta_excluida = true`, alterada em **31/08 13:49**; o cadastro ligado (`808473fd`, R$ 150.000) virou `declinada` em 31/08 13:51. Em 26/08 essa venda estava viva e contava. **R$ 500.000 saíram da base por edição legítima.**
- Único outro cadastro `declinada` de agosto (Rodrigo Costa, R$ 500.000) foi declinado em **03/08**, antes do print — não explica nada.
- Proposta `27919b65` (Lynaldo, R$ 480.000) foi recusada em 03/09, mas o aceite é 27/08: está fora da janela 01–26 em qualquer cenário.

Não encontrei nenhum `aceite_date` movido para fora da janela: todas as propostas com `updated_at` posterior a 26/08 e aceite em agosto mantêm aceite dentro do próprio mês. Também não encontrei cadastro avulso de agosto que tenha virado vinculado depois — os cadastros de 01–26/08 com `updated_at` pós-26/08 já nasceram com `proposal_id` e `deal_id` preenchidos, e `deal_vinculo_ajustado_em` está nulo em todos eles.

Saldo: dos R$ 1.390.000, **R$ 500.000 são saída comprovadamente legítima**. Restam ~R$ 890.000 sem explicação por movimentação de dados.

## Próximo passo proposto (escolha uma linha)

1. **Fechar a conta dos R$ 890 mil**: abrir o painel de Produção Gerada no recorte 01–26/08 e comparar carta a carta com a RPC (hook em memória vs. RPC), até localizar quais cartas o print tinha e a RPC não tem. Somente leitura.
2. **Aceitar R$ 21,22 mi como verdade do mês** (RPC e hook concordam entre si; o print é que está datado e já tinha R$ 500 mil depois desfeitos) e seguir para a rodada 2 — `relatorio_diario_bu`.

Recomendação: opção 1 antes da rodada 2, porque o relatório diário vai congelar snapshots e um desvio não explicado de R$ 890 mil viraria histórico imutável.

## Nada foi alterado

Somente consultas de leitura e leitura de arquivos. Nenhuma migration, nenhum deploy, nenhuma escrita.
