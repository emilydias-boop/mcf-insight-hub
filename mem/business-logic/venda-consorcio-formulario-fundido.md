---
name: Venda Consórcio — formulário fundido e parcelas MCF
description: Lançamento da venda em dois blocos (comercial obrigatório + cadastral opcional), marcação das 12 parcelas MCF por carta e regra de cadastro incompleto na etapa 4.
type: feature
---

Lançamento da venda (`ProposalModal`, botão "Lançar Venda") é UM formulário com dois blocos:

- **Bloco 1 (obrigatório)**: cartas (`CartasProposalEditor`), detalhes e origem do lead.
- **Bloco 2 (opcional, recolhido)**: dados cadastrais do cliente + documentos, via bloco
  compartilhado `src/components/consorcio/DadosClienteBloco.tsx` (`useDadosCliente` +
  `DadosClienteFields`), o MESMO usado pelo `AcceptProposalModal` — lá ele é obrigatório.

Se o bloco 2 for preenchido (mesmo parcialmente), o cadastro pendente já nasce no lançamento —
uma carta = um cadastro. Incompleto **gera pendência visível** na etapa 4 (Cotas a Fazer), com selo
"cadastro incompleto (N)"; `src/lib/consorcioCadastroIncompleto.ts` diz QUAIS campos faltam
(mesma regra do `isChecklistIncompleto` no hook) e o Dossiê mostra a lista.

**Parcelas MCF**: cada carta guarda `consorcio_proposal_cartas.parcelas_mcf` (int[]), a marcação
das 12 primeiras parcelas feita pelo closer. É **intenção**, não verdade oficial (a confirmação
segue na etapa 5) e não alimenta comissão nem cronograma. `derivarParcelasEmpresa()` em
`src/types/consorcioCartas.ts` traduz o array para os campos legados
(`empresa_paga_parcelas`, `tipo_contrato`, `parcelas_pagas_empresa`) que o resto do sistema lê.

`dia_vencimento` e `inicio_segunda_parcela` saíram do lançamento/aceite (`hide` no
`DadosPlanoFields`): quem define é a Embracon, depois.
