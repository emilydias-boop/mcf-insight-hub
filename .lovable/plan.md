# Retrato fiel do funil de Consórcio — Etapas 1, 2 e 3

Levantamento de leitura de código (nada foi alterado). Rótulos entre "aspas" são copiados da tela. Onde não foi possível confirmar, está escrito "não determinei".

---

## ETAPA 1 — R1 Agendada (na tela: "Reuniões Agendadas")

### 1. Onde fica
- Menu: **"Venda Consórcio"** (CRM Consórcio).
- Rota: `/consorcio/crm/venda-consorcio` (alias antigo `/consorcio/crm/pos-reuniao`).
- Aba: primeira aba da tela (aba padrão ao abrir), lista com o título **"Reuniões Agendadas (N)"**.
- A lista é partida em duas seções: **"Pendentes — reunião passou sem desfecho (N)"** (aberta) e **"Tratadas — realizada, no-show ou remarcada (N)"** (recolhida).

### 2. Quem vê
- A rota exige permissão no recurso `crm`; admin sempre passa. `sdr`, `closer` e `closer_sombra` são liberados explicitamente nesta aba (é onde eles dão o desfecho da reunião).
- **Cada pessoa vê tudo**: a consulta traz todas as reuniões da BU Consórcio no período. Não há filtro por closer/SDR da sessão. Não determinei se existe RLS no banco restringindo além disso.

### 3. O que a lista mostra
| Rótulo na tela | De onde vem |
|---|---|
| "Lead" | nome do participante da reunião; se vazio, nome do contato; se vazio, nome do negócio |
| "Telefone" | telefone do participante ou do contato (com botão de ligar) |
| "Data / Hora" | horário do slot da agenda, formato `dd/MM/aaaa às HH:mm` |
| "Closer" | closer dono do slot |
| "Status" | status do participante, abreviado: `Ag`, `OK`, `NS`, `RE`; badge extra "sem desfecho" |
| "Motivo" | motivo do desfecho (tooltip mostra a observação) |
| "Nota do Closer" | nota do closer / notas do participante |
| "Ações" | botões (só nesta aba) |
- Ao lado do nome, nas pendentes, aparece o selo **"N dias parado"** (calculado na hora a partir da data da reunião — não é campo salvo). Âmbar de 2 a 5 dias, vermelho a partir de 6.
- Clicar na linha abre o detalhe do negócio (só se houver negócio vinculado).

### 4. Botões e ações
- **"Realizada"** — marca o participante como realizado, sincroniza o slot e move o negócio no CRM para "Reunião 01 Realizada". **Sem confirmação.** O tooltip avisa: *"Marcar como Realizada muda o estágio do negócio no CRM e transfere a titularidade do negócio para o closer."* Fica desabilitado se já está realizada. Qualquer papel com acesso à aba pode clicar.
- **"No-Show"** (vira **"No-Show ✓"** quando já marcado) — abre a lista de motivos com o título **"Motivo do No-Show (obrigatório)"**. Para papel **SDR**, escolher o motivo **não grava ainda**: abre o diálogo de evidência/IA, e só depois de confirmar ali é que grava. Para os demais papéis grava direto. Grava status, motivo, observação, quem marcou e quando; move o negócio para o estágio de No-Show.
- **"Voltar p/ Agendada"** — só aparece quando o status não é "agendada". Devolve o participante para agendada.
- Clique na linha: abre o detalhe do negócio (leitura).

### 5. Obrigatório vs opcional
- Motivo do No-Show: **obrigatório** (é a própria escolha na lista).
- Observação livre: **obrigatória apenas no motivo "Outro"**, mínimo 3 caracteres (botão "Confirmar" fica inativo antes disso). Nos outros motivos é opcional.
- Diálogo de evidência (só SDR): não determinei a lista completa de campos obrigatórios.

### 6. Como se sai para a etapa 2
Clicar em **"Realizada"**. No banco: status do participante = `completed`; status do slot = `completed` (quando aplicável); estágio do negócio passa a "Reunião 01 Realizada"; **o dono do negócio passa a ser o closer**. Há proteção anti-regressão: o negócio nunca volta para trás no funil.

### 7. O que trava
- Mês fechado: **"Mês fechado: as reuniões deste mês estão travadas para alteração de status. Peça a reabertura em Administração → Travas de Mês."**
- Erro genérico: **"Erro ao atualizar status: …"**. Sucesso: **"Status atualizado"**.
- No-Show sem motivo: a interface não permite aplicar.

### 8. Armadilhas
- "Realizada" **troca o dono do negócio** — parece só uma marcação de status.
- **"Voltar p/ Agendada" não desfaz tudo**: o status do participante volta, mas o estágio do negócio e a titularidade já transferida **não são revertidos**.
- A fila **não é "minha fila"** — é de toda a BU.
- Ordenar por coluna **não reordena a seção "Pendentes"** (ela é sempre ordenada do mais parado para o mais recente): parece que o clique não fez nada.
- SDR que escolhe o motivo do No-Show e fecha a tela **não gravou nada** — falta confirmar a evidência.

---

## ETAPA 2 — R1 Realizada (na tela: "Reuniões Realizadas")

### 1. Onde fica
Mesma tela e rota da etapa 1, aba seguinte, card **"Reuniões Realizadas (N)"**. Duas seções: **"Pendentes — sem desfecho comercial (N)"** e **"Tratadas — venda lançada ou sem sucesso (N)"**. Vazio das pendentes: *"Toda reunião realizada do período já teve desfecho comercial."*

O **lançamento da venda** vive aqui (modal). O **aceite da proposta** e a **edição da proposta** **não vivem aqui** — vivem na aba "Propostas" (etapa 3).

### 2. Quem vê
Mesmo guard da etapa 1 (recurso `crm`). Também **sem filtro por dono**: todos veem todas as reuniões realizadas do período. Os dois botões de desfecho aparecem para qualquer papel com acesso à aba.

### 3. O que a lista mostra
Mesmas colunas da etapa 1 ("Lead", "Telefone", "Data / Hora", "Closer", "Status", "Motivo", "Nota do Closer", "Ações"). O selo de dias parados aqui tem o texto: *"Dias desde a reunião realizada sem desfecho comercial (nem venda lançada, nem 'sem sucesso'). Âmbar de 2 a 5 dias, vermelho a partir de 6."*

Uma reunião é "pendente" nesta etapa enquanto o negócio não tiver proposta lançada nem estiver marcado como sem sucesso.

### 4. Botões e ações
- **"Lançar Venda"** — abre o formulário da venda. Fica **desabilitado quando o negócio já tem carta/proposta**. Se a reunião não tiver negócio vinculado, aparece o texto "sem negócio vinculado" em vez do botão.
- **"Sem Sucesso"** (botão vermelho) — abre o modal de motivo; confirmação pelo botão **"Confirmar Sem Sucesso"**, inativo sem motivo. Grava o estágio de "Sem Sucesso" no negócio e, se houver proposta ligada, marca a proposta como `recusada`. **Não determinei botão de reverter** o "sem sucesso" nesta tela.
- Dentro do formulário de venda: botão final **"Lançar Venda"** (mostra "Lançando..." enquanto grava) e **"Cancelar"**. Nenhum dos dois pede confirmação; "Cancelar" descarta tudo o que foi digitado sem avisar.

### 5. Obrigatório vs opcional (formulário "Lançar Venda")
- **Bloco "1. Dados da venda" — obrigatório**: ao menos uma carta válida (crédito, prazo e tipo de produto). Detalhes da proposta e origem do lead não têm validação — na prática, opcionais. Não determinei a lista completa de campos que tornam uma carta "válida".
- **Bloco "2. Dados cadastrais do cliente (opcional)"** — recolhido, com o texto: *"A venda entra em Termos de Adesão Pendentes. Depois do termo assinado ela vai para Cotas a Fazer, e o que ficar em branco aqui aparece lá como pendência de cadastro, com selo de dias parados."* Preenchido, mesmo parcialmente, já cria o cadastro pendente (um por carta).

### 6. Como se sai para a etapa 3
Lançar a venda. No banco: insere a proposta e uma linha por carta; se o bloco 2 foi preenchido, cria também os cadastros pendentes. A partir daí a reunião sai das "Pendentes" desta etapa e a venda aparece na aba "Propostas" (etapa 3). "Sem Sucesso" também tira da fila, mas é desfecho terminal — não avança.

### 7. O que trava
- **"Informe ao menos uma carta com crédito, prazo e produto."**
- **"Todas as cartas precisam de prazo e tipo de produto."**
- Falha parcial: **"A venda pode ter sido criada, mas o cadastro da cota FALHOU: … Confira a venda em Termos de Adesão Pendentes e use 'Inserir Dados' para concluir o cadastro."**
- "Sem Sucesso": botão inativo sem motivo, sem mensagem.

### 8. Armadilhas
- **Bug provável (leitura estática, não testado em execução):** ao abrir "Lançar Venda" e "Sem Sucesso" **a partir desta aba**, a origem do lead é passada vazia. Consequência: o estágio do negócio no CRM **não é atualizado** ao lançar a venda por aqui, e o "Sem Sucesso" cai sempre no ramo de Efeito Alavanca, independentemente da origem real. A venda é criada normalmente — só o estágio do CRM fica para trás.
- "Lançar Venda"/"Sem Sucesso" bloqueiam por checagem feita na tela; com duas abas abertas, o duplo lançamento não está descartado (não determinei se há restrição única no banco).
- Aceite/edição da proposta **não estão aqui** — quem procura o aceite nesta aba não encontra.
- Cancelar o formulário perde tudo, sem confirmação.

---

## ETAPA 3 — Termo de Adesão Pendente (na tela: "Termos de Adesão Pendentes")

### 1. Onde fica
Mesma tela e rota, aba **"Propostas"**, card **"Termos de Adesão Pendentes (N)"**. Duas seções: **"Pendentes — termo de adesão não assinado"** e **"Tratados — termo assinado ou desistência da carta"**.
Rota pública do cliente: **`/termo/:token`** — fora de login, servida pela função `termo-assinatura`; o acesso é só pelo token.

### 2. Quem vê
- A aba segue o guard do recurso `crm`; não há restrição de papel para gerar termo, cancelar termo ou "Adicionar Carta" no código lido. Não determinei as políticas RLS de `consorcio_termos`.
- Editar os **dados do cliente** dentro da proposta exige `admin`, `manager`, `coordenador`, `closer` ou `cobranca_consorcio` **e** termo não assinado; sem isso, o bloco aparece em leitura.
- O cliente, sem login, vê o termo com nome e documento mascarados até assinar.

### 3. O que a lista mostra
Cabeçalhos: **"Contato"**, **"Data Proposta"**, **"Data Reunião"**, **"Valor Crédito"**, **"Prazo"**, **"Produto"**, **"Status"**, **"Closer"**, **"Ações"**.
- "Contato": nome do contato ou do negócio; ícone de nota quando há nota do closer.
- "Data Proposta": data de criação da proposta, mais o selo de dias parados (enquanto o termo não estiver assinado) e um contador vermelho piscante `Nd` quando há documento pendente.
- "Prazo": "N meses". "Produto": badge.
- "Status": pilha de selos — proposta sem valor (âmbar); "Cadastrada" (quando aceita) ou o próprio status; **"Documento pendente"** (vermelho, clicável); selo do termo: **"Termo aguardando assinatura"**, **"Termo assinado · dd/mm/aaaa"**, **"Termo cancelado"** ou **"Termo expirado"**; e **"Desistência da Carta"** com o motivo em itálico.

### 4. Botões e ações
- **"Gerar Termo de Adesão"** — aparece quando a carta não foi desistida e ainda não existe termo. Fica **desabilitado se a venda não tem cadastro de cota**, com o aviso: *"O termo é montado a partir do cadastro da cota. Lance a venda (Inserir Dados) antes de gerar o termo."* Abre o modal de geração.
- No modal: **"Gerar termo e link"** — sem confirmação; cria o termo com o texto e os dados **congelados** (snapshot + hash). Toast **"Termo de adesão gerado"**. Depois aparece o link e o botão **"Copiar"**, com o texto *"Envie este link ao cliente por WhatsApp, e-mail ou qualquer outro canal. Ele vale por 30 dias."* Fechar não desfaz o termo. Botões **"Cancelar"/"Fechar"** e, quando faltam dados, **"Completar cadastro"**.
- **"Ver / reenviar termo"** — aparece quando já existe termo (tooltip: *"Ver, copiar o link ou reenviar o termo de adesão"*). Dentro dele: **"Copiar"** (só com termo pendente; toast "Link copiado"), **"Imprimir / Salvar PDF"** (sempre), **"Cancelar termo"** (só pendente) e **"Gerar novo termo"** (só quando todos os termos estão cancelados/expirados).
- **"Cancelar termo"** — abre um bloco com **"Motivo do cancelamento *"** (obrigatório), com **"Voltar"** (não grava) e **"Confirmar cancelamento"**. Grava status `cancelado` + data, autor e motivo, **só se ainda estiver pendente**. Depois de confirmado não há volta — só gerar novo.
- **"Cancelar termo e gerar novo"** — dentro da edição da proposta, só quando os dados do cliente foram alterados e o termo está pendente. Cancela com o motivo fixo *"Dados do cliente corrigidos antes da assinatura"* e reabre a geração.
- **"Adicionar Carta"** — no cabeçalho da aba, sempre visível. Cria a venda inteira de fora do funil: proposta já `aceita`, uma carta e um cadastro por carta, com documento replicado. Descrição: *"Venda de consórcio que não passou pelo funil (parceiro, indicação, collab, sócio). A carta criada aqui nasce na etapa Termos de Adesão Pendentes e só chega em Cotas a Fazer depois do termo assinado."*
- **"Assinar termo"** (lado do cliente, `/termo/:token`) — inativo enquanto faltar nome, documento com 11 ou 14 dígitos, ou o aceite. Grava status `assinado`, data, nome, CPF, IP e navegador. Não tem volta.
- Ainda na linha, fora do fluxo do termo: **"Cadastrar"**, **"Recusar"**, **"Inserir Dados"**, **"Ver Dados"**, **"Documentos"/"Anexar Documentos"**, ícone de lápis (editar venda) e ícone de lixeira (desistência, com o diálogo **"Registrar Desistência da Carta?"**, motivo obrigatório e botão **"Registrar desistência"**).

### 5. Obrigatório vs opcional
- **Geração do termo**: o operador não digita nada — tudo vem do cadastro. Obrigatórios por venda: nome/razão social, CPF/CNPJ e **endereço**. Obrigatórios por carta: valor do crédito, prazo, parcela 1ª–12ª e parcela das demais.
- **Cancelamento**: motivo obrigatório.
- **"Adicionar Carta"**: lead vinculado, origem da venda, closer responsável e, por carta, crédito, prazo e produto. Nome de lead novo com no mínimo 3 letras.
- **Assinatura do cliente**: nome completo, CPF/CNPJ (11 ou 14 dígitos) e o aceite (declaração de validade jurídica com registro de nome, documento, data, hora e IP) — os três obrigatórios.

### 6. Como se sai para a etapa 4
A **assinatura do cliente**: o termo passa a `assinado`. A etapa 4 lê esse status — cadastro sem termo assinado fica travado fora da fila liberada. Não há campo novo gravado no cadastro; a trava é a leitura do termo. Exceções isentas da trava: cadastros sem proposta vinculada e cadastros anteriores a **19/08/2026** (data-corte fixa no código).

### 7. O que trava
- Geração: **"Cadastros da venda não são da mesma pessoa"** + *"Corrija os cadastros antes de emitir o termo — um único documento não pode cobrir pessoas diferentes."*; **"Dados obrigatórios faltando"** + *"Abra o cadastro em Cotas a Fazer → ⋮ → Ver detalhes → Editar, ou use o botão abaixo."*; **"Nenhum modelo ativo"** + *"Cadastre o texto do termo em Configurações do CRM → Termo de Adesão."*
- Assinatura: **"Este termo já foi assinado."**, **"Este termo foi cancelado."**, **"O prazo para assinatura deste termo expirou."**, **"O CPF/CNPJ informado não corresponde ao do termo."**, **"O nome informado não corresponde ao do termo."**, **"Informe nome completo e CPF."**, **"Este documento é apenas um comprovante e não requer assinatura."**
- Telas do cliente: **"Documento não encontrado"**, **"Documento cancelado"** (*"…não é mais válido. Fale com o seu consultor para receber um novo."*), **"Prazo expirado"**.
- Com termo assinado, salvar a edição da proposta é **bloqueado sem nenhuma mensagem** — a tela apenas fica em leitura.

### 8. Armadilhas
- **Corrigir o cadastro depois de gerar o termo não atualiza o termo enviado.** A assinatura confere nome e CPF contra o snapshot antigo — a assinatura correta do cliente passa a ser recusada. É preciso cancelar e gerar novo, manualmente.
- **O termo é um por VENDA**, não por carta; o vínculo confiável é a proposta.
- Termo assinado **não pode ser cancelado**.
- "Gerar Termo de Adesão" desabilitado por falta de cadastro parece defeito da tela.
- Carta criada por "Adicionar Carta" **não aparece em Cotas a Fazer** até o termo ser assinado.
- A expiração só é aplicada quando alguém abre o link ou tenta assinar — o termo pode continuar "pendente" no banco após a data.
- O texto "vale por 30 dias" está na tela, mas o prazo real vem do padrão da tabela — **não determinei** esse valor.
- A data-corte 19/08/2026 isenta cadastros antigos da trava de assinatura — confunde auditoria.

---

## Pontos que não determinei
- Políticas RLS reais de `meeting_slots`, `meeting_slot_attendees`, `crm_deals`, `consorcio_termos` e `consorcio_pending_registrations`.
- Quais papéis exatamente passam no guard do recurso `crm`.
- Campos obrigatórios completos do diálogo de evidência de No-Show e da validação de cada carta.
- Prazo real de expiração do termo (padrão da coluna no banco).
- O efeito do provável bug de origem vazia na etapa 2 não foi confirmado em execução.

---

# Manual do Funil de Consórcio — Etapas 4, 5 e 6

## Três pendências da rodada anterior (agora respondidas)

**1. Prazo de expiração do termo.** Real e igual ao que a tela diz: a coluna `consorcio_termos.expires_at` tem `DEFAULT (now() + '30 days'::interval)`. Não há cálculo alternativo no código. "Vale por 30 dias" está correto.

**2. Quem passa no guard do recurso `crm`.** O enum de papéis do sistema (`app_role`) tem 13 valores: `admin`, `manager`, `viewer`, `sdr`, `closer`, `coordenador`, `rh`, `financeiro`, `closer_sombra`, `gr`, `marketing`, `assistente_administrativo`, `cobranca_consorcio`. Níveis de `crm` por papel:
- **full**: `admin`, `manager`, `coordenador`, `assistente_administrativo` (quando BU = consórcio)
- **view**: `closer`, `closer_sombra`, `sdr`, `assistente_administrativo` (sem BU)
- **none (não entra)**: `financeiro`, `rh`, `viewer`
- **sem linha configurada** (portanto sem acesso): `gr`, `marketing`, `cobranca_consorcio`
O guard (`ResourceGuard`) libera qualquer nível diferente de `none` e sempre libera `admin`. Quem não passa vê o texto: "Acesso Negado — Você não tem permissão para acessar este recurso. Entre em contato com um administrador para solicitar acesso." Observação importante: o guard de tela lê apenas o nível **do papel**; permissões individuais por usuário não abrem a tela (as RPCs de reversão, sim, aceitam permissão individual).

**3. A trava de assinatura na entrada da etapa 4.** O cadastro **não some e não fica cinza por inteiro**. Ele vai para uma terceira seção da própria etapa 4, recolhida por padrão, entre a fila de trabalho e as tratadas, com o título exato **"Aguardando assinatura do termo (N)"** e a descrição **"a cota só é cadastrada na Embracon depois da assinatura"**. Dentro dessa seção a linha aparece completa; só o botão **"Cota Cadastrada"** fica desabilitado, com o texto ao passar o mouse: **"O cliente ainda não assinou o Termo de Adesão. Cadastre a cota na Embracon só depois da assinatura."** Os demais botões ("Declinada", menu de ações) continuam ativos. Cadastro sem proposta vinculada e cadastro criado antes de 19/08/2026 ficam liberados sem termo.

---

## Etapa 4 — Cotas a Fazer

**1. Onde fica.** Tela "Venda Consórcio" (rota `/consorcio/crm/venda-consorcio`; o endereço antigo `/consorcio/crm/pos-reuniao` continua válido e abre a mesma tela). Aba **"Cotas a Fazer"**. Título do card: "Cotas a Fazer (N)". Três seções: "Liberadas para cadastro — termo assinado (N)", "Aguardando assinatura do termo (N)" e "Tratadas — cota aberta ou declinada (N)".

**2. Quem vê.** Todo mundo que passa no guard `crm` (lista acima). A lista **não** é filtrada por vendedor: cada pessoa vê os cadastros de toda a equipe.

**3. O que a lista mostra.** Colunas: `Origem` · `Nome / Razão Social` · `Valor da Cota` · `Parcelas (empresa)` · `Total a pagar` · `Closer` · `SDR` · `Cotas existentes` · `Destinada` · `Solicitado em` · `Status` · `Ações`. Sob o nome aparecem selos: "Termo assinado" / "Termo pendente" (clicáveis, abrem o painel do termo), "cadastro incompleto (N)", "documento faltando", PF/PJ com CPF/CNPJ, e o contador de dias parados ("aguardando abertura há" na fila liberada, "aguardando assinatura há" na fila travada). Origem dos dados: tabela de cadastros pendentes, enriquecida com o negócio do CRM (closer, SDR, origem) e com a contagem de cotas do mesmo CPF/CNPJ. "Solicitado em" usa a data do aceite da proposta, ou a data de criação quando não há aceite. Status: "Aguardando abertura", "Cota aberta", "Vinculada", "Declinada".

**4. Botões e ações.**
- **"Cota Cadastrada"** — abre o formulário curto (grupo, cota, contrato). É a ação que cria a cota e promove para a etapa 5. Só aparece em cadastros ainda sem cota; fica desabilitado sem termo assinado.
- **"Declinada"** — abre "Declinar carta". Texto: "O parceiro desistiu da aquisição desta carta. Só o valor desta carta é abatido da meta e do saldo acumulado — as outras cartas da mesma venda continuam valendo. A carta continua listada aqui mesmo, em Cotas a Fazer, marcada como declinada, e a ação pode ser revertida a qualquer momento pelo menu da linha (Reverter declínio)." Exige "Motivo do declínio *". Confirma em "Confirmar declínio". Grava o declínio na carta e, se todas as cartas caírem, a proposta vira recusada. Tem volta.
- **"Reverter declínio"** — desfaz o declínio, sem confirmação.
- **"Dossiê do cadastro"** (menu, ou clique no nome) — leitura.
- **"Editar cadastro"** (menu) — abre o cadastro para edição. **Nunca abre cota**, mesmo parecendo o caminho principal.
- **"Termo de Adesão"** (menu) — abre o painel do termo. Só aparece se já houver termo.
- **"Vincular a cota existente"** (menu) — liga o cadastro a uma cota já criada no sistema.
- **"Excluir cadastro"** (menu, destrutivo) — confirmação "Excluir cadastro pendente?" com o texto "Esta ação remove o cadastro e os documentos vinculados. O negócio no CRM não será afetado." Apaga o cadastro e os documentos e devolve a proposta para pendente. **Sem volta.**
- **Anexar documentos** — dentro de "Editar cadastro"/Dossiê, campo "Anexar novos documentos".
- **"Exportar"** — planilha da lista filtrada.

**5. Obrigatório x opcional.** Formulário curto de cadastro da cota: `Grupo *` e `Cota *` obrigatórios; "Contrato Embracon" opcional. Edição do cadastro (pessoa física): Nome Completo, CPF, Telefone e E-mail obrigatórios; RG, CPF do cônjuge, profissão, endereço, CEP, renda, patrimônio e PIX opcionais no formulário (mas contam para o selo "cadastro incompleto"). Pessoa jurídica: nenhum campo é bloqueante no formulário — a cobrança vem pelo selo de incompleto.

**6. Como se sai para a etapa 5.** Botão "Cota Cadastrada" confirmado: cria a cota como **reserva** (data de reserva = hoje, sem data de contratação), copia os dados do plano, gera o cronograma previsto e liga o cadastro à cota. A linha sai desta aba e passa a aparecer em "Cotas Cadastradas".

**7. O que trava.** Sem termo assinado, o botão de cadastro fica desabilitado (texto no item 3 das pendências). Se faltar valor do crédito, prazo, tipo de produto, categoria ou origem, o formulário curto nem abre: aparece "Dados do plano incompletos" com "Faltam {lista}. Como esses campos definem a cota, use o formulário completo de abertura para informá-los." e o botão "Abrir formulário completo". Declínio sem motivo não confirma. Duplicidade de grupo/cota é **aviso, não bloqueio**: "Já existe cota com grupo X / cota Y — pode ser erro de digitação, confira antes de confirmar."

**8. Armadilhas.** (a) O botão desabilitado não explica nada sem passar o mouse. (b) "Editar cadastro" parece a ação principal e não abre cota. (c) Excluir cadastro devolve a proposta para pendente e reabre trabalho na aba de Propostas — o aviso não diz isso. (d) Os dois contadores de "dias parados" na mesma tela têm âncoras diferentes (criação do cadastro na fila liberada; geração do termo na fila travada).

---

## Etapa 5 — Cotas Cadastradas

**1. Onde fica.** Mesma tela, aba **"Cotas Cadastradas"**. Título: "Cotas Cadastradas (N)". Duas listas: aguardando pagamento e parcela inicial paga.

**2. Quem vê.** Mesmo guard `crm`, sem filtro por vendedor — todos veem tudo. As ações de reversão têm uma segunda checagem no banco, que aceita os papéis operacionais (`admin`, `manager`, `coordenador`, `closer`, `closer_sombra`, `sdr`, `financeiro`, `gr`, `assistente_administrativo`, `cobranca_consorcio`) ou quem tenha permissão individual de `crm`; `viewer` e `marketing` são recusados mesmo chamando a API direto.

**3. O que a lista mostra.** Colunas: `Cliente` · `Grupo / Cota` · `Valor do Crédito` · `Cadastrada em` · `Parcela inicial` · `Vendedor` · `Ações`. "Cadastrada em" é a data de abertura da cota; "Parcela inicial" mostra "aguardando" ou a data com marca de conferido. Dados vêm dos cadastros com cota vinculada e grupo/cota preenchidos.

**4. Botões e ações.**
- **"Parcela inicial paga"** — modal de mesmo nome. Texto: "{cliente} — grupo {grupo} / cota {cota}. Ao confirmar, a cota é convertida em contratação com esta data e passa a aparecer na etapa Cotas. Nada é cobrado nem lançado no financeiro." Campo obrigatório "Data do pagamento" (não aceita data futura, começa em hoje). Botões "Cancelar" / "Confirmar". É a ação que promove para a etapa 6. Aviso final: "Parcela inicial paga — cota contratada e movida para Cotas". Tem volta.
- **"Desfazer parcela inicial"** — reversão 6→5. Texto: "... A cota volta para reserva e sai da etapa Cotas. Nada é cobrado, cancelado ou enviado para fora." Se a venda já foi anunciada ao Dash, acrescenta: "Atenção: esta venda já foi anunciada ao Dash — depois de voltar, reconcilie por lá manualmente." Exige "Motivo" com no mínimo 15 caracteres (contador na tela).
- **"Voltar p/ Cotas a Fazer"** — reversão 5→4. Texto: "... O cadastro volta para Cotas a Fazer. A cota não é apagada: fica viva, marcada como revertida e fora do funil. Nenhuma cobrança, comissão ou webhook é enviado ou cancelado." Também exige motivo de 15 caracteres.
- **"Comprovante"** — abre "Gerar Comprovante de Cadastro": "Comprova o cadastro da cota na Embracon (grupo, cota e contrato) e mostra o cronograma das primeiras parcelas, indicando quais a MCF paga. É só leitura — o cliente não assina este documento." Dentro dele: "Salvar dados da cota", "Gerar as 12 primeiras parcelas", "Salvar cronograma na cota", "Abrir cota completa" e "Gerar comprovante e link" (com "Copiar" do link).
- Quando a reversão está bloqueada, o botão é **substituído pelo texto do motivo** — não fica desabilitado.

**5. Obrigatório x opcional.** Parcela inicial: data obrigatória. Reversões: motivo com 15+ caracteres. Comprovante: contrato Embracon, dia de vencimento e valor da parcela 1ª–12ª são obrigatórios para emitir ("obrigatório para emitir"); "demais parcelas" é opcional; cada linha do cronograma precisa de valor e vencimento. Vincular cota existente: escolher uma cota é obrigatório; "Buscar cotas de outros clientes" é opcional e vem com o aviso "Vincular a cota de outro cliente corrompe o histórico — use só com validação do operacional."

**6. Como se sai para a etapa 6.** "Parcela inicial paga" confirmada: grava a data e o autor no cadastro e converte a cota para **contratação** com a data informada pelo operador. A etapa 6 lista por essa data de contratação. Nenhum webhook externo é disparado.

**7. O que trava (textos exatos).**
- "Não dá para voltar: existe parcela paga nesta cota."
- "Não dá para voltar: a cota tem contemplação registrada."
- "Não dá para voltar: a cota está em processo de transferência."
- "Não dá para voltar: o mês de comissão {mês} já está fechado."
- Só ao desfazer a parcela inicial: "Esta cota não tem data de reserva registrada — não dá para devolvê-la para reserva. Ajuste a data de reserva na cota antes de desfazer."
- Comprovante: botão desabilitado com a lista do que falta; dia de vencimento fora de 1–31 dá "Dia de vencimento deve estar entre 1 e 31".

**8. Armadilhas.** (a) A ação de **abrir cota** não está aqui: ela é da etapa 4. (b) A data da parcela inicial é digitada, não é "hoje" automático — errar a data desloca a venda de mês. (c) Nenhuma reversão apaga cota: ela fica viva, marcada como revertida e fora do funil, e reconciliar com o Dash é manual. (d) Existe um selo "já anunciada ao Dash — reconciliar" que é aviso, não bloqueio. (e) Esta marcação de parcela é independente do financeiro: não é a parcela nº 1 do cronograma de pagamentos.

---

## Etapa 6 — Cotas Contratadas

**1. Onde fica.** A etapa 6 está em **dois lugares**, e isso é o ponto mais importante do manual:
- A **lista** fica na mesma tela, aba **"Cotas"** (dica no funil: "contratadas no período"). É a última etapa; não existe etapa 7.
- **Confirmar a contratação** e **reverter para a etapa 5** ficam na aba "Cotas Cadastradas" (etapa 5), nos botões "Parcela inicial paga" e "Desfazer parcela inicial".
- **Reconhecer venda fora do funil**, **trocar lead**, **informar agendador** e o **alerta de divergência de origem** ficam na tela "Painel de Equipe" (`/consorcio/painel-equipe`), no alerta de cadastro sem lead.
Não existe uma tela única chamada "Cotas Contratadas" que reúna tudo.

**2. Quem vê.** Ambas as telas atrás do guard `crm`, sem filtro por vendedor. No Painel de Equipe, `sdr` e `closer` têm a navegação de detalhamento por pessoa desativada, mas veem o alerta igual.

**3. O que a lista mostra (aba "Cotas").** Colunas: `Nº` · `Nome` · `Grupo` · `Cota` · `Valor Crédito` · `DT Reserva` · `DT Contratação` · `Vencimento` · `Tipo` · `Objetivo` · `Origem` · `Status` · `Responsável` · `Origem no funil` · `Criada por` · `Criada em` · `Comissão` · `Ações` (fixa à direita). Quase todas ordenáveis. Dados vindos das cotas do consórcio.
No alerta do Painel de Equipe, o detalhamento mostra: `Cliente` · `Grupo/Cota` · `Data de contratação` · `Valor do crédito` · `Vendedor` · `Motivo` · `Ação`. A lista de vendas já reconhecidas mostra: `Cliente` · `Grupo/Cota` · `Contratação` · `Crédito` · `Motivo do reconhecimento` · `Reconhecido por` · `Ação`.

**4. Botões e ações (alerta de divergência).**
- **"Reconhecer fora do funil"** — abre "Reconhecer venda fora do funil": "A cota sai das pendências do alerta e passa para o bloco de vendas reconhecidas, com registro de quem reconheceu e quando. Não muda nenhum número: Consórcio Efetivado, Produção Gerada, Cotas Contratadas, Vendas Realizadas e Ticket Médio continuam idênticos. Nenhum SDR é atribuído." Motivo obrigatório, mínimo 10 caracteres (validado também no banco). Só aparece quando nenhum lead do cliente tem R1 elegível. Tem volta.
- **"Desfazer"** (na lista de reconhecidas) — devolve a cota às pendências mantendo a trilha: "Reconhecimento desfeito — a cota volta às pendências (trilha preservada)."
- **"Trocar lead"** (quando a cota já aponta para um lead errado) ou **"Vincular lead"** (quando não há lead) — abre "Trocar o lead desta cota" / "Corrigir vínculo da cota com o lead". Texto ao trocar: "Esta cota já aponta para um lead, mas não é o lead que passou pela reunião. Escolha abaixo o lead com o selo 'tem R1 de consórcio' — é ele que credita a venda." Escolher um lead é obrigatório; "Buscar qualquer lead" é opcional; se o lead já tiver outras cotas, exige marcar "Confirmo que esta cota também pertence a este lead". Botão final: "Trocar para este lead" / "Vincular ao lead" / "Criar cadastro e vincular".
- **"Informar agendador"** — abre "Informar quem agendou a reunião": "A reunião de consórcio deste cliente existe e está elegível, mas ficou sem agendador registrado. Ao informar quem agendou, a venda passa a ser creditada a essa pessoa." Se a reunião não for achada: "Não foi possível localizar a reunião a corrigir. Abra a Agenda R1 do dia para ajustar."
- **"Corrigir vendedor"** (em certos diagnósticos) — abre a cota em outra aba, fora do fluxo do modal.

**5. Obrigatório x opcional.** Fora do funil: motivo com 10+ caracteres. Troca de lead: seleção do lead (e a confirmação extra quando aparece o aviso de duplicidade). Reversões: motivo com 15+ caracteres. Informar agendador: campos do editor de agendador — não determinei a lista exata.

**6. Como se sai da etapa 6.** Só para trás: "Desfazer parcela inicial" devolve a cota para reserva (zera a data de contratação, preserva a data de reserva) e registra a reversão. Não há avanço além desta etapa: a cota contratada permanece na aba "Cotas" e alimenta as métricas de venda.

**7. O que trava.** Mesmas cinco travas de reversão da etapa 5, aplicadas também no banco. Troca de lead com mês fechado: "O mês {ano-mês} está fechado. O vínculo desta cota não pode mais ser alterado." Reconhecimento fora do funil sem motivo de 10 caracteres é recusado pelo banco.

**8. Armadilhas.** (a) O selo **"ajustado"** é só registro de autoria da última correção — a linha continua no alerta se o problema persistir. (b) Depois de salvar vínculo ou agendador pode aparecer "Vínculo salvo, mas o caso continua na lista: {motivo atual}" — salvar não garante resolver. (c) "Reconhecer fora do funil" **não muda nenhum número**: é recorte visual do alerta. (d) Se o detalhamento e o número do painel divergirem, aparece "Atenção: o detalhamento trouxe N registros e a linha mostra M. Reporte esta divergência." — não ignorar. (e) Reversão nunca apaga cota. (f) Quem procurar as ações de correção na aba "Cotas" não vai achar: elas estão no Painel de Equipe.

## Pontos que não determinei (etapas 4–6)
- Campos obrigatórios internos do editor de agendador ("Informar agendador").
- Mensagens exatas de erro da rotina de banco que corrige o vínculo da cota com o lead.
- A tela de "Corrigir vínculo" também é usada em fluxos de SDR/resíduo fora do funil de Consórcio; não mapeei esses outros usos.
