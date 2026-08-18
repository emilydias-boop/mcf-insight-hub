# Pós-Reunião — aproveitamento de dados entre etapas (rodada 2)

- **Data:** 18/08/2026
- **Solicitante:** Grimaldo Neto
- **Módulo/BU:** BU Consórcio — CRM Consórcio → Pós-Reunião / Cadastros
- **Status:** implementado, aguardando conferência do gestor (não publicado)

## Contexto e objetivo

Segunda rodada da auditoria do fluxo Pós-Reunião: fechar perdas de dado entre as
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