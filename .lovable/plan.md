# Editar dados do cliente na etapa 3 (antes da assinatura)

## A resposta que derruba o pedido como está formulado: é SNAPSHOT

O termo é congelado no momento da geração. Evidência:

- `src/hooks/useConsorcioTermos.ts` → `useCreateTermo` grava `dados_snapshot` (os dados do cliente), `conteudo_renderizado` (o texto final já montado) e `conteudo_hash` (SHA-256 do texto).
- `supabase/functions/termo-assinatura/index.ts` → o que o cliente vê é `t.conteudo_renderizado` (linha 79) e o nome/documento mascarado vêm de `t.dados_snapshot` (linha 69). Não há releitura de nenhuma tabela na hora de exibir ou assinar.
- Pior: a conferência da assinatura compara o que o cliente digita contra o **snapshot** (`docEsperado`/`nomeEsperado`, linhas 152-166). Se o dono corrigir o CPF ou o nome agora, o cliente **continua tendo que assinar com o dado errado** — o certo é rejeitado com `doc_mismatch` / `name_mismatch`.

Conclusão, dita na cara: **editar dado de cliente com termo já gerado e não assinado exige cancelar o termo, gerar de novo e reenviar o link.** Sem isso, a edição é cosmética no CRM e cria um documento assinado divergente do cadastro — buraco maior que o de hoje. Hoje há 3 termos `pendente` e 21 `assinado`.

## 1. Onde moram os dados do cliente

Os dados que o termo usa vivem **só** em `consorcio_pending_registrations` (um registro por carta). `montarDadosTermoMulti()` em `src/lib/consorcioTermo.ts` recebe exatamente esses registros.

- PF: `nome_completo`, `cpf`, `rg`, `profissao`, `telefone`, `email`, `endereco_completo`, `endereco_cep`, `renda`, `patrimonio`, `pix`.
- PJ: `razao_social`, `cnpj`, `natureza_juridica`, `inscricao_estadual`, `data_fundacao`, `telefone_comercial`, `email_comercial`, `endereco_comercial`, `endereco_comercial_cep`, `faturamento_mensal`, sócios.

`crm_contacts` (name/phone/email) aparece na etapa 3 apenas em **leitura**, para preencher a coluna Contato (`useConsorcioPostMeeting.ts`, joins nas linhas 274/408/663). Nenhum caminho de edição do cadastro pendente escreve em `crm_contacts`. **Portanto a edição aqui não contamina o contato do CRM usado por outras BUs** — e o desenho abaixo mantém isso.

## 2. Já existe caminho de edição — dá para reaproveitar inteiro

`OpenCotaModal` já tem `mode='edit'`: "SÓ edição do cadastro pendente (etapa 4): nunca abre cota". Tem `startEditing`, tem `onSaved` (para voltar ao modal de origem), tem diff de snapshot (`src/lib/formDiff.ts`) para não gravar campo em branco, e usa `useUpdatePendingRegistration`. É o mesmo formulário usado pelo "Editar cadastro" da etapa 4 e pelo atalho "Completar cadastro" do `GerarTermoModal`.

Não é preciso construir bloco novo. A resposta certa é **abrir o que já existe** a partir do Editar Proposta.

## 3. Os três estados do termo, em código

Fonte: `useTermosByProposal()` (mais recente primeiro) em `src/pages/crm/PosReuniao.tsx`.

- (a) nunca gerado: `termosDe(p).length === 0` → linha mostra "Gerar Termo de Adesão".
- (b) gerado, aguardando: `termosDe(p)[0].status === 'pendente'` → selo âmbar "Termo aguardando assinatura".
- (c) assinado: `termosDe(p).find(t => t.status === 'assinado')` (`termoAssinadoDe`) → selo verde; a venda cai na lista "Tratados".

## 4. A trava — e o buraco que já existe

Hoje `EditProposalModal` **não olha o termo**: `useEditarProposta` altera `consorcio_proposal_cartas` (valor de crédito, prazo, produto, parcelas) mesmo com termo assinado. Único freio: carta com `pending_registration_id`/`consortium_card_id` fica `travada` no editor. Ou seja, **sim, hoje dá para mudar as cartas de uma venda com termo assinado** — o documento assinado passa a divergir do CRM. É buraco pré-existente e o desenho abaixo fecha os dois.

## 5. Permissão hoje

- Cartas / proposta: RLS `Authenticated users can manage proposals` e `... proposal cartas` com `USING true` — **qualquer usuário autenticado edita**. O lápis na tela também não tem gate de papel.
- Cadastro pendente: `UPDATE` só para `admin`, `manager`, `coordenador`; leitura por `can_access_consorcio_pii(auth.uid())`. Ou seja, um closer comum verá o bloco de cliente mas o save será negado pelo banco — precisa ser escondido, não descoberto no erro.
- Cancelar termo: `admin`, `manager`, `coordenador`, `assistente_administrativo` ou o criador, e só com `status='pendente'` (a policy proíbe tocar termo assinado).

## Desenho proposto

**No `EditProposalModal`, um segundo bloco "Dados do cliente", recolhido, com comportamento por estado do termo:**

- (a) **sem termo** — bloco liberado. Botão "Editar dados do cliente" abre `OpenCotaModal` em `mode='edit'` `startEditing` para o cadastro da carta (via `useCadastrosDaVenda`), e ao salvar volta para o Editar Proposta (`onSaved`). Zero código de formulário novo.
- (b) **termo pendente** — bloco liberado, mas com aviso âmbar fixo: "o termo já enviado continua com os dados antigos; ao salvar será necessário cancelar e gerar um novo termo". Ao salvar, o modal oferece **"Cancelar termo e gerar novo"**, encadeando no `GerarTermoModal` (fluxo já existente). Sem isso a alteração não é aplicada ao documento — e é essa consequência que precisa ser aceita antes.
- (c) **termo assinado** — bloco somente leitura, com "Termo assinado em dd/mm — dados travados". **E, no mesmo movimento, travar as cartas**: `CartasProposalEditor` em modo leitura quando existe termo assinado, fechando o buraco do item 4.
- **Permissão**: o bloco de cliente só fica editável para `admin`/`manager`/`coordenador` (espelhando a RLS); os demais veem em leitura.
- Nada de escrita em `crm_contacts`.

## Detalhes técnicos

- Arquivos tocados: `src/components/consorcio/EditProposalModal.tsx` (bloco novo + gate), `src/pages/crm/PosReuniao.tsx` (passar os termos da proposta ao modal), reuso de `OpenCotaModal` (`mode='edit'`), `useCadastrosDaVenda`, `useCancelTermo`, `GerarTermoModal`.
- Sem migração, sem alteração de RLS, sem toque em dado existente.
- Uma venda pode ter várias cartas → vários cadastros pendentes; o bloco lista os cadastros na ordem das cartas e edita um por vez (mesma ordenação já usada na geração do termo).

## Fora de escopo desta rodada

Regenerar termo automaticamente sem confirmação; editar dados na etapa 4/5; qualquer alteração em `crm_contacts`; mexer no comprovante de cadastro.
