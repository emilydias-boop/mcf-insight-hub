# Diagnóstico — "Lançar Venda" travado para Edson Carmo do Nascimento (somente leitura)

## Causa provável
O botão "Lançar Venda" fica **desabilitado** porque o negócio do Edson (`96222fb2-…`) já tem uma proposta viva de 23/07/2026 (carta de R$ 150 mil, 240 meses, cota aberta). A tela trata "1 negócio = 1 venda", então a reunião nova de 07/10 cai em "Tratadas" e o botão não responde. O produto Auto não é o que trava.

## Evidência — código
- Lista e botão: `src/components/consorcio/R1FunnelTab.tsx`. Título "Tratadas — venda lançada ou sem sucesso" na linha 534. O botão está na linha 366, com `disabled={jaTemCarta}`. O "Sem Sucesso" (linha 372) também fica desabilitado.
- `jaTemCarta` (linha 272) = `dealsWithProposal.has(p.deal_id)`.
- `dealsWithProposal` (linhas 115-124) reúne todo `deal_id` com proposta em `useProposals()` que não tem `carta_excluida = true`. A trava olha o **negócio**, não a reunião nem a data.
- Critério de "Tratadas" (linhas 185-188): no modo "realizadas", a reunião é pendente só se o negócio não tem proposta viva nem "sem sucesso". Esse critério é o mesmo que trava o botão.
- O botão abre o `ProposalModal` (linha 549). Como o botão está desabilitado, o modal nem abre. Por isso as validações dele (prazo, produto, toast da linha 141) não chegam a rodar.
- Mensagem de erro (console, rede ou toast): **nenhuma**. O usuário vê só o botão apagado.

## Evidência — dados (somente SELECT)
- Contato `35cfddef-…` (+5521986426373).
- Negócio `96222fb2-23f1-49dd-a715-fbf99637b0b9`: origem Efeito Alavanca + Clube, etapa **R1 Realizada**.
- Reuniões desse negócio:
  - 23/07: Cleiton Lima (`1472d772`), concluída
  - 04/08: Cleiton Lima (`1472d772`), concluída
  - **07/10 17:00 (São Paulo)**: closer `f8283cdc-…`, concluída, participante `9fbaa13e-…`
- Proposta `67d2a1ec-…`: status `aceita`, proposta e aceite em 23/07/2026, `carta_excluida = false`, crédito R$ 150.000, prazo 240.
- Cadastro `c9838af8-…`: status `cota_aberta`, ligado a essa proposta.
- O contato tem mais 4 negócios (dois em "Novo Lead", "Base 50K" e "Venda realizada" do A010). Nenhum deles tem proposta de consórcio.
- Atenção: a reunião de 07/10 está com o closer `f8283cdc`, e o Cleiton é `1472d772`. Não determinei se `f8283cdc` também é o Cleiton (não consultei o nome).

## Produto Auto
- Existe produto ativo **TPA — "TABELA ESTENDIDO AUTO APE (Parcelinha)"**, com prazo disponível **100 meses**.
- Isso não confirma o achado de que só existem prazos 200/220/240: há um Auto com prazo de 100.
- Pagamento "1x de 60K": não determinei se o formulário aceita, porque o modal não chega a abrir. Esse ponto só vira bloqueio depois que a trava do negócio for resolvida.

## O que seria preciso para destravar (nada implementado)
Cabe ao dono escolher uma das opções:
1. **Regra (código):** permitir uma segunda venda no mesmo negócio. Por exemplo, a trava passaria a considerar só propostas criadas depois da reunião em questão, ou passaria a valer por reunião. Muda a regra "1 negócio = 1 venda" do `R1FunnelTab`.
2. **Operacional, sem código:** lançar a carta de Auto pelo botão "Adicionar Carta" na etapa 3 (Termos de Adesão Pendentes). Ele cria proposta, cartas e cadastros sem depender dessa trava. Só funciona se o modal aceitar prazo 100 e pagamento em 1x, o que não verifiquei.
3. **Dados:** criar um negócio separado para essa nova venda. Isso é alteração de dado e precisa de autorização.

Depois de destravar, ainda falta confirmar que o `ProposalModal` aceita produto TPA, prazo 100 e pagamento em 1x de R$ 60 mil.
