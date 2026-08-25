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
