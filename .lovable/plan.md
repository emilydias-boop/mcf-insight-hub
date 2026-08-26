# Onde o "Reconhecer fora do funil" existe (e onde não existe)

Correção do meu levantamento anterior: eu descrevi o comportamento de **um** dos modais e o dono abriu **outro**. Existem quatro aberturas do `ResiduoDetalheModal` no Painel de Equipe do Consórcio, com props diferentes.

## 1) As quatro aberturas

| # | De onde abre | Título | Itens | `permitirForaFunil` |
|---|---|---|---|---|
| 1 | Caixa de alerta **acima** da tabela, 1ª caixa (`CadastroSemLeadAlerta.tsx:74-81`, clique em `Caixa`) | "Cotas sem lead vinculado" (`CadastroSemLeadAlerta.tsx:119`) | `semVinculo` = subconjunto de `cadastroSemLeadItems` com problema `sem_cadastro`/`sem_lead`/`deal_inexistente` (`:60-66`) | **true** (`:124`) |
| 2 | Caixa de alerta **acima** da tabela, 2ª caixa (`CadastroSemLeadAlerta.tsx:83-90`) | "Cotas com cadastro a ajustar" (`:130`) | `semAgendador` = restante de `cadastroSemLeadItems`, incluindo `sem_reuniao_bu` | **true** (`:135`) |
| 3 | **Linha itálica da tabela de SDRs** "Sem agendamento de consórcio" (`ConsorcioSdrSummaryTable.tsx` — a linha que faz `setDetalhe("semVinculo")`) | "Sem agendamento de consórcio" (`ConsorcioSdrSummaryTable.tsx:481`) | `cotasSemVinculoItems` = `cotasContratadas.semVinculoItems` (`PainelEquipe.tsx:713`) | **false** — a prop não é passada (`ConsorcioSdrSummaryTable.tsx:478-487`) |
| 4 | Linha itálica da tabela de Closers "Sem vendedor identificado" (`ConsorcioCloserSummaryTable.tsx:515-523`) | "Sem vendedor identificado" | `cotasSemCloserItems` | **false** (só `permitirCorrigirVendedor`) |

Há ainda o `ForaFunilListaModal` (3ª caixa do alerta, `CadastroSemLeadAlerta.tsx:92-113`), que só lista/desfaz reconhecimentos já feitos.

## 2) O modal da captura

É o item 3. Chamada literal, `src/components/sdr/ConsorcioSdrSummaryTable.tsx:478-487`:

```
<ResiduoDetalheModal
  open={detalhe === "semVinculo"}
  onOpenChange={(o) => setDetalhe(o ? "semVinculo" : null)}
  kind="cota"
  titulo="Sem agendamento de consórcio"
  descricao="Cotas de clientes que não têm NENHUM agendamento de consórcio ..."
  items={cotasSemVinculoItems}
  esperado={cotasSemVinculo}
  permitirCorrigirVinculo
/>
```

`permitirForaFunil` = **false** (ausente).

## 3) Consequência — confirmado

Sim. Com `permitirForaFunil` false, o ramo prioritário de `ResiduoDetalheModal.tsx:299` (`permitirForaFunil && i.semSaidaPorVinculo`) nunca dispara e o ramo `:349` (fallback "Reconhecer fora do funil") também não. Para `problema === "sem_reuniao_bu"` sobra só o ramo `:334-340`: botão único **"Trocar lead"**. Nesse modal, o dono não tem como reconhecer fora do funil, e o único botão oferecido é justamente o que não resolve o caso — exatamente o que a captura mostra.

## 4) Caminho de clique onde o botão existe hoje

Painel Comercial → **BU Consórcio → Painel de Equipe** → aba **SDRs** → **caixa de alerta âmbar acima da tabela**, a que hoje diz *"10 cotas apontando para o lead sem reunião — alerta de cadastro"* (ícone de engrenagem/usuário) → clicar na caixa abre o modal **"Cotas com cadastro a ajustar"** → em cada linha, botão em destaque **"Reconhecer fora do funil"** e link discreto "Trocar lead" abaixo.

Só ali (e na 1ª caixa, "Cotas sem lead vinculado") o botão existe. Não existe pela linha da tabela.

## 5) As 10 cotas aparecem nesse caminho?

Sim, as mesmas 10. As duas listas vêm do mesmo predicado `!temBookerProprio` (`useConsorcioCotasContratadas.ts:704-723` alimenta `cadastroSemLeadItems`; `:685-701` alimenta `semVinculoItems`), e como nenhum dos dois clientes tem `clienteSdr`, todas as 10 cotas caem nas duas listas. Na caixa de alerta elas têm `problema = "sem_reuniao_bu"` e `semSaidaPorVinculo = true`, logo exibem "Reconhecer fora do funil" em destaque. Confere com o número que o dono está vendo na caixa: 10 cotas / R$ 1.260.000.

## Correção sugerida (só frontend, se aprovar depois)

1. Passar `permitirForaFunil` na abertura da linha "Sem agendamento de consórcio" (`ConsorcioSdrSummaryTable.tsx:478-487`) — é literalmente a lista de clientes sem nenhum agendamento, o público exato do reconhecimento.
2. Renomear a 2ª caixa do alerta para separar "reunião a ajustar" (informar agendador) de "venda sem R1 de Consórcio" (reconhecer fora do funil), e trocar o texto pós-ação quando o vínculo salvo cair em `sem_reuniao_bu` com `semSaidaPorVinculo`.

Nenhuma migration, nenhuma função SQL, nenhum UPDATE.
