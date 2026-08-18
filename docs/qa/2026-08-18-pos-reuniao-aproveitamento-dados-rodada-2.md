# Venda Consórcio (antiga Pós-Reunião) — aproveitamento de dados entre etapas (rodada 2)

- **Data:** 18/08/2026
- **Solicitante:** Grimaldo Neto
- **Módulo/BU:** BU Consórcio — CRM Consórcio → Venda Consórcio / Cadastros
- **Status:** implementado, aguardando conferência do gestor (não publicado)

## Contexto e objetivo

Segunda rodada da auditoria do fluxo Venda Consórcio: fechar perdas de dado entre as
etapas (proposta → aceite → cadastro pendente → abertura de cota) e eliminar
defaults silenciosos. Nada de origem/`origem_lead` foi alterado (frente própria por
decisão do gestor) e as definições de contagem do funil de 6 etapas seguem as da QA
de 16/08, com a única exceção já documentada (proposta pendente sem valor).

## Item a item

**1. Proposta pendente sem valor de crédito (robustez).**
O helper deixou de olhar só a flag `aguardando_retorno`: agora QUALQUER proposta com
status pendente e `valor_credito` nulo ou 0 recebe selo âmbar, fica fora do card
"Crédito Contratado", fora da etapa 3 do funil e com o botão **Cadastrar**
desabilitado. Texto do selo: "Aguardando retorno" quando a flag existir, "Sem valor
registrado" quando não. Arquivos: `useConsorcioPostMeeting.ts`
(`isPropostaSemValor`, `labelPropostaSemValor`), `PosReuniao.tsx`,
`FunilConsorcioTimeline.tsx`.

**2. Nome dos sócios PJ.** Novo campo "Nome do Sócio" em cada linha de sócio no
AcceptProposalModal, **obrigatório** quando o sócio for informado (schema e regra de
campo). O nome é gravado em `consorcio_pending_registrations.socios` e propagado
para `consortium_pj_partners.nome` na abertura da cota. `parseChecklistPJ` passou a
extrair nomes nos formatos "Nome - CPF" e "Nome: X / CPF: Y", pareando por posição
com os CPFs; sem nome no texto, o campo fica vazio para digitação manual.

**3. Vendedor no caminho do funil.** O AcceptProposalModal aberto pela aba Cartas
Negociadas passa a receber `vendedorName={closer_name}` — antes nascia vazio.

**4. Fim dos defaults silenciosos na abertura de cota.** Categoria, prazo, tipo de
produto, condição de pagamento, dia de vencimento e valor do crédito não têm mais
default. Sem valor no cadastro pendente, o campo aparece vazio e a validação exige
escolha explícita (valor do crédito precisa ser > 0; condição de pagamento agora é
obrigatória). Defaults legítimos mantidos: data de contratação = hoje,
`inclui_seguro`, `e_transferencia`, `empresa_paga_parcelas`, `tipo_contrato`,
`parcelas_pagas_empresa`.

**5. Objetivo chega à cota.** `useOpenCota` passou a enviar
`consortium_cards.objetivo` a partir do cadastro pendente.

**6. Prazo — catálogo x exceção.** (a) No OpenCotaModal, prazo fora do catálogo vindo
do cadastro pendente gera opção dinâmica "{X} meses (fora do catálogo)" já
selecionada, sem redigitação. (b) ProposalModal e EditProposalModal trocaram o input
livre por Select com 200/220/240 + "Outro (informar)", que libera o campo numérico.

**7. Critério único de "documento pendente".** Novo helper compartilhado
(`src/lib/consorcioDocumentosPendentes.ts`): um cadastro pendente tem documento se
existir `consortium_documents` ligado ao próprio `pending_registration_id` OU ao card
vinculado a ele. A proposta aparece como "documento pendente" se QUALQUER cadastro
pendente dela estiver sem documento. Mesmo helper nas abas 3 (Cartas Negociadas) e 4
(Cadastros) — os dois selos não podem mais divergir.

**8. Edição de detalhes propaga.** Ao editar uma proposta, `observacoes` dos cadastros
pendentes dela que ainda não abriram cota é ressincronizada — apenas quando estiver
vazia ou ainda idêntica ao `proposal_details` anterior. Observação escrita à mão nunca
é sobrescrita.

**9. Zero legítimo preservado.** Renda e patrimônio iguais a zero passam a ser
gravados pelo modal de abertura (antes o filtro de `cleanClientData` e a conversão do
`onSubmit` descartavam o 0). String vazia e `undefined` continuam descartados.

## O que passou a ser obrigatório para o usuário

- Nome de cada sócio PJ no aceite da proposta.
- Na abertura da cota: escolher categoria, prazo, tipo, condição de pagamento, dia de
  vencimento e informar valor do crédito maior que zero (nada mais vem preenchido por
  default).
- Registrar valor de crédito na proposta antes de conseguir cadastrar (botão
  bloqueado enquanto a proposta pendente estiver sem valor).

## Roadmap de testes

### Funcionais
1. Proposta pendente com valor 0 sem flag `aguardando_retorno`: selo "Sem valor
   registrado", fora do card de crédito, fora da etapa 3, Cadastrar bloqueado, lápis
   habilitado.
2. Preencher valor pelo lápis: selo volta a "pendente" e Cadastrar libera.
3. Aceite PJ com 2 sócios: nomes obrigatórios, gravados no pendente e em
   `consortium_pj_partners` após abrir a cota.
4. Colar check-list PJ nos 3 formatos (só CPFs / "Nome - CPF" / "Nome: X / CPF: Y").
5. Cadastrar pelo funil: `vendedor_name` do pendente vem com o nome do closer.
6. Abrir cota com pendente incompleto: nenhum campo pré-selecionado; submit reprovado
   com a lista de campos faltantes.
7. Objetivo escolhido no aceite aparece em `consortium_cards.objetivo`.
8. Proposta com prazo 210: aparece como "210 meses (fora do catálogo)" no OpenCota.
9. ProposalModal/EditProposalModal: 200/220/240 no Select e "Outro" liberando número.
10. Documento anexado só no card: selos das abas 3 e 4 concordam.
11. Editar detalhes com observação automática → ressincroniza; com observação escrita
    à mão → preserva; cota já aberta → não mexe.
12. Renda 0 e patrimônio 0 gravados na abertura.

### Edge cases
- Proposta aceita com valor 0 (não deve receber selo âmbar — a regra é só de pendente).
- Cadastro pendente sem card e sem documento.
- Sócios com CPF repetido ou nomes com hífen no meio.
- Prazo digitado como texto vazio em "Outro".

### Regressão
- Contagens das 6 etapas do funil (exceto exclusão já documentada da etapa 3).
- Geração de parcelas e Termo de Adesão / Comprovante após abertura de cota.
- Abas Cadastros, Cartas Excluídas e ViewRegistrationDialog.

### Permissões/RLS
- Nenhuma migration e nenhuma política alterada nesta rodada.

### UI/UX
- Selos âmbar legíveis em tema claro/escuro; tooltips dos botões bloqueados.

## Riscos e rollback

Risco principal: cadastros antigos incompletos passam a exigir preenchimento
explícito na abertura da cota (comportamento desejado, pode gerar atrito na
operação). Rollback = reverter os arquivos citados; não há mudança de banco.

## Checklist final

- [ ] Itens 1 a 9 conferidos em preview
- [ ] Contagens do funil comparadas antes/depois
- [ ] Publicação autorizada pelo gestor

## Revisão do commit b5ea249e — 7 ajustes (18/08/2026)

**A. Parser PJ gravava sócio com nome "CPF" (grave).** Em `parseChecklistPJ`, o `:`
saiu da classe de separadores do formato "Nome - CPF" e os ramos rotulados
("Nome:" / "CPF:") passaram a ser testados ANTES do pareado. Antes, o trecho
`CPF: 111.111.111-11` casava como nome="CPF". Conferido nos dois formatos
("João Silva - 111.111.111-11" e "Nome: X / CPF: Y") e no formato só-CPFs.

**B. Selo "documento pendente" que nunca apagava (grave).** Em `useProposals`, o
cálculo de `documentos_pendentes` passa a ignorar cadastros pendentes com status
`declinada` ou `excluida`. Só cadastro ativo decide se falta documento.

**C. Paginação em `fetchPendingRegsWithDocs`.** As duas consultas a
`consortium_documents` agora usam chunk de ids (200) + paginação de 1000 linhas,
igual ao resto do fluxo. Acima de 1000 documentos nada mais desaparece da resposta.

**D. Objetivo da tela de Abertura de Cota.** O `objetivo` escolhido no próprio
OpenCotaModal entra no `cotaData` no submit e tem prioridade sobre o do cadastro
pendente ao gravar `consortium_cards.objetivo`.

**E. Zero preservado também ao salvar a edição do pendente.**
`handleSavePendingEdit` usa `numOuNull` para renda e patrimônio (antes `|| null`
transformava 0 em null nesse caminho).

**F. Limpeza.** Removido o alias `isAguardandoRetornoSemValor` (todos os call sites
já usam `isPropostaSemValor`). No AcceptProposalModal, o schema zod
(`pfSchema`/`pjSchema`/`formSchema`) era código morto — o `useForm` nunca recebeu
`zodResolver` — e foi removido junto dos imports. A validação real segue nas `rules`
de cada campo e no `checklistOk`.

**G. Vendedor não altera o rótulo de origem.** `formatOrigemLabel` deixou de receber
`vendedor_name` como fallback do rótulo; com o vendedor agora preenchido (item 3), o
texto de origem continua igual ao de antes. O vendedor segue gravado no campo próprio.

**H. Ajuda no "Nome do Sócio".** O campo continua obrigatório, mas quando o
"Colar Check-list" não traz nome, o campo vazio exibe "o check-list não trouxe o
nome — preencha".

### Testes desta revisão
1. Check-list `Nome: A, CPF: 1, Nome: B, CPF: 2` → nomes [A, B], sem "CPF".
2. Cadastro declinado sem documento → proposta aceita perde o selo de documento pendente.
3. Base com >1000 documentos → nenhum cadastro com documento aparece como faltando.
4. Trocar objetivo na abertura da cota → valor gravado em `consortium_cards.objetivo`.
5. Salvar edição do pendente com renda 0 → grava 0, não null.
6. Rótulo de origem de cadastro vindo do funil idêntico ao anterior.
7. Colar check-list PJ sem nomes → ajuda âmbar nos campos vazios.
## Revisão do commit 66a465b — 4 ajustes

**1. Origem dos cadastros manuais restaurada.** O item G acima removeu o 3º
argumento de `formatOrigemLabel`, e com isso os cadastros criados pelo
`AddPendingRegistrationModal` (onde "Origem / Parceiro" é salvo em `vendedor_name`
e normalmente não existe deal) passaram a exibir "Sem origem". O fallback voltou,
mas condicionado: 3º argumento = `r.deal_id ? null : r.vendedor_name`. Cadastro
vindo do funil mantém o rótulo de antes; o manual volta a mostrar o parceiro na
coluna Origem, no filtro e no export XLSX.

**2. Parser PJ — ordem dos ramos.** O formato "Nome: João Silva - 111.111.111-11"
caía no ramo "só nome" e perdia o CPF. Agora o prefixo "Nome:" é retirado antes do
pareamento e o ramo pareado é testado primeiro, mas só quando o trecho tem 11+
dígitos (senão "Nome: João Silva" seria lido como pareado). Formatos verificados:
`João Silva - 111.111.111-11`, `Nome: João Silva / CPF: 111.111.111-11`,
`Nome: João Silva - 111.111.111-11`, lista só de CPFs e lista só de nomes.

**3. Aviso de nome de sócio não fica preso.** `checklistSemNomeSocio` é zerado a
cada nova colagem e a cada abertura/fechamento do modal, além de já desaparecer
por campo assim que o nome é digitado.

**4. Objetivo volta para o cadastro pendente.** O `pendingUpdate` do passo 6 de
`useOpenCota` passou a gravar `objetivo` (o da tela de abertura tem prioridade
sobre o do aceite), evitando que o Termo de Adesão — gerado a partir do pendente —
saia com o objetivo antigo.

### Testes desta revisão
1. Cadastro manual com parceiro → coluna Origem mostra "Parceiro · Mês/Ano".
2. Cadastro vindo do funil → rótulo inalterado.
3. Os quatro formatos de sócio do parser (conferidos fora do app).
4. Reabrir o modal de aceite → aviso âmbar não aparece sem colagem.
5. Trocar objetivo na abertura da cota → grava no card e no cadastro pendente.
6. Typecheck limpo; nenhum arquivo importa `isAguardandoRetornoSemValor`.
