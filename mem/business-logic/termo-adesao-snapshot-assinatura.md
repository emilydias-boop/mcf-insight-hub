---
name: Termo de Adesão é snapshot — e a assinatura confere contra ele
description: O termo congela dados e conteúdo na geração; a conferência de nome/CPF na assinatura usa o snapshot, então editar dado do cliente depois exige cancelar e gerar novo termo.
type: feature
---

O Termo de Adesão do Consórcio é **snapshot**, não visão ao vivo:

- `useCreateTermo` (`src/hooks/useConsorcioTermos.ts`) grava `dados_snapshot`, `conteudo_renderizado` e `conteudo_hash` no momento da geração.
- A página pública e a edge function `termo-assinatura` exibem `conteudo_renderizado` e mascaram nome/documento a partir de `dados_snapshot`. Nada é relido do banco.
- **Decisivo:** a conferência da assinatura compara o nome e o CPF digitados pelo cliente contra o **snapshot** (`doc_mismatch` / `name_mismatch`). Se alguém corrigir o CPF ou o nome no cadastro depois da geração, a assinatura CORRETA do cliente passa a ser recusada.

Consequência aplicada na etapa 3 (`EditProposalModal`):
- termo assinado → cartas e dados do cliente em LEITURA (termo assinado é intocável: sem DELETE, sem UPDATE);
- termo pendente → edição liberada com aviso âmbar ANTES de editar, e ação manual "Cancelar termo e gerar novo" (cancelamento só existe para `pendente`, como a RLS obriga);
- sem termo → edição livre.
- O bloco reusa `OpenCotaModal` em `mode='edit'`; nenhum caminho escreve em `crm_contacts`.
- Editar cadastro pendente exige papel admin/manager/coordenador (RLS): sem o papel, o bloco aparece em leitura com a explicação — nunca botão que falha no banco.
