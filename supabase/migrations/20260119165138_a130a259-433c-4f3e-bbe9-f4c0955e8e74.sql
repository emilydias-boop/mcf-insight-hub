-- Atualizar templates de NOVO LEAD com scripts detalhados
UPDATE activity_templates 
SET script_body = '## Abertura

Olá, Bom dia/Boa tarde **[NOME DO LEAD]**! Me chamo [SEU NOME], sou consultor da Minha Casa Financiada, tudo bem com você?

Vi que você se interessou em **Construir para Vender**. Me fala... *Escutar o lead.*

---

## Perguntas de Qualificação

Conforme o lead falar, registre as respostas:

1. **Como você chegou até a MCF?** Você já assistiu alguma live?

2. **Há quanto tempo nos acompanha?**

3. **Você tem alguma experiência com construção?**
   - *Etiquetar: TAG JÁ CONSTRUIU ou TAG NÃO CONSTRUIU*

4. **Qual sua profissão?**
   - *Identifique se é engenheiro, arquiteto, construtor ou investidor*

5. **Você possui terreno próprio ou imóvel?**

6. **Qual sua renda (média)?**

7. **Quanto você está disposto a investir no mercado imobiliário?**

8. **Existe mais alguém que apoie você como decisor?**

---

## Critérios de Qualificação

✅ **QUALIFICAR se:**
- Renda superior a R$ 7.000,00
- OU Renda entre R$ 3.000,00 a R$ 7.000,00 com terreno/imóvel

❌ **DESQUALIFICAR se:**
- Renda abaixo de R$ 3.000,00
- Deseja construir para morar
- Não tem pretensão de investir

*Se desqualificado: Dar LOST e convidar para a LIVE*',
script_title = 'Roteiro de Qualificação - Primeira Ligação'
WHERE name = 'Tentativa de Ligação 01' AND stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';

UPDATE activity_templates 
SET script_body = '## Mensagem WhatsApp - Apresentação

Olá [NOME]! 👋

Meu nome é [SEU NOME], sou consultor da **Minha Casa Financiada**.

Vi que você se interessou pelo nosso modelo de **Construir para Vender** e queria muito bater um papo contigo!

Você tem uns minutinhos para uma ligação rápida? 📞

---

*Se não responder em 2h, enviar a segunda mensagem (WhatsApp 02)*',
script_title = 'Mensagem de Apresentação'
WHERE name = 'Tentativa de Whatsapp 01' AND stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';

UPDATE activity_templates 
SET script_body = '## Mensagem WhatsApp - Follow-up

Oi [NOME], tudo bem? 😊

Tentei te ligar mais cedo mas não consegui falar contigo.

Aproveita e dá uma olhada na nossa **live de segunda-feira** onde o Marcelo explica todo o modelo de negócio:

🔗 [Link da Live]

Me avisa quando puder conversar! Tenho certeza que vai agregar muito no seu projeto de investimento imobiliário. 🏠

---

*Aguardar resposta antes de partir para ligação*',
script_title = 'Follow-up WhatsApp'
WHERE name = 'Tentativa de Whatsapp 02' AND stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';

UPDATE activity_templates 
SET script_body = '## Segunda Tentativa de Contato

Olá [NOME]! Aqui é [SEU NOME] da MCF novamente.

Tentei falar contigo ontem mas não consegui. Tudo bem por aí?

*Seguir o mesmo roteiro da Ligação 01 se conseguir contato*

---

**Se cair na caixa postal:**

"Olá [NOME], aqui é [SEU NOME] da Minha Casa Financiada. Estou tentando falar contigo sobre o seu interesse em Construir para Vender. Me retorna quando puder! Meu número é [SEU NÚMERO]."',
script_title = 'Roteiro - Segunda Tentativa'
WHERE name = 'Tentativa de Ligação 02' AND stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';

UPDATE activity_templates 
SET script_body = '## Terceira Tentativa de Contato

*Mesmo roteiro da Ligação 02*

---

**Se não atender:**
- Enviar WhatsApp informando que tentou contato
- Perguntar melhor horário para ligar

**Mensagem sugerida:**
"Oi [NOME]! Tentei te ligar agora mas não consegui. Qual o melhor horário pra gente conversar? 📞"',
script_title = 'Roteiro - Terceira Tentativa'
WHERE name = 'Tentativa de Ligação 03' AND stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';

UPDATE activity_templates 
SET script_body = '## Quarta Tentativa de Contato

Olá [NOME], aqui é [SEU NOME] da MCF!

Tenho tentado falar contigo sobre o modelo de Construir para Vender. Você ainda tem interesse?

*Se conseguir contato, seguir roteiro de qualificação*

---

**⚠️ Atenção:** Esta é a penúltima tentativa. Se não houver resposta, registrar observação detalhada.',
script_title = 'Roteiro - Quarta Tentativa'
WHERE name = 'Tentativa de Ligação 04' AND stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';

UPDATE activity_templates 
SET script_body = '## Quinta e Última Tentativa

Olá [NOME], aqui é [SEU NOME] da Minha Casa Financiada.

Essa é minha última tentativa de contato. Caso você ainda tenha interesse em conhecer nosso modelo de **Construir para Vender**, me retorna!

Vou deixar nosso contato disponível caso queira falar futuramente.

---

**Após esta tentativa:**
- Se não houver resposta → Mover para LOST
- Motivo: "Sem contato após 5 tentativas"
- Convidar para seguir nas redes sociais',
script_title = 'Roteiro - Última Tentativa'
WHERE name = 'Tentativa de Ligação 05' AND stage_id = 'cf4a369c-c4a6-4299-933d-5ae3dcc39d4b';

-- LEAD QUALIFICADO
UPDATE activity_templates 
SET script_body = '## Confirmação de Interesse e Agendamento

Olá [NOME]! Que bom falar contigo novamente!

Então, pelo que conversamos, você tem perfil para o nosso programa. Agora o próximo passo é agendar uma **reunião de apresentação** com um dos nossos especialistas.

Nessa reunião você vai entender:
- Como funciona o modelo de negócio
- Cases de sucesso de alunos
- Próximos passos para começar

---

## Disponibilidade

Qual o melhor dia e horário pra você?

**Opções disponíveis:**
- Segunda a Sexta: 9h às 19h
- Duração: ~45 minutos
- Formato: Online (Google Meet)

*Após confirmar, mover para "Reunião 01 Agendada"*',
script_title = 'Agendamento de R1'
WHERE name = 'Confirmação de Interesse' AND stage_id = 'a1d19874-4d47-4405-94fd-fb5237da44dd';

UPDATE activity_templates 
SET script_body = '## Envio de Material Informativo

Enviar via WhatsApp:

---

Oi [NOME]! 📚

Como prometido, estou te enviando alguns materiais sobre a MCF:

📹 **Vídeo de apresentação:** [Link]
📄 **E-book Construir para Vender:** [Link]
📱 **Nosso Instagram:** @minhacasafinanciada

Qualquer dúvida, é só me chamar!

Nos vemos na reunião do dia [DATA] às [HORA]! 🚀',
script_title = 'Material Informativo'
WHERE name = 'Envio de Material' AND stage_id = 'a1d19874-4d47-4405-94fd-fb5237da44dd';

UPDATE activity_templates 
SET script_body = '## Follow-up de Qualificação

Olá [NOME]! Tudo bem?

Passando pra saber se você conseguiu dar uma olhada no material que te enviei.

Ficou alguma dúvida? Posso te ajudar com algo?

---

**Objetivos desta ligação:**
- Confirmar que recebeu o material
- Esclarecer dúvidas iniciais
- Reforçar a data da reunião agendada
- Manter o lead aquecido',
script_title = 'Follow-up Qualificação'
WHERE name = 'Follow-up de Qualificação' AND stage_id = 'a1d19874-4d47-4405-94fd-fb5237da44dd';

-- REUNIÃO 01 AGENDADA
UPDATE activity_templates 
SET script_body = '## Confirmação 24h Antes

Enviar via WhatsApp:

---

Oi [NOME]! 👋

Passando para confirmar nossa reunião de **amanhã, [DATA] às [HORA]**.

Você consegue participar nesse horário?

Responde com um "✅" se estiver confirmado!

---

**Se não confirmar:**
- Ligar para confirmar
- Se não atender, enviar nova mensagem 2h depois',
script_title = 'Confirmação 24h'
WHERE name = 'Confirmação de Reunião - 24h antes' AND stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53';

UPDATE activity_templates 
SET script_body = '## Lembrete 1h Antes

Enviar via WhatsApp:

---

Oi [NOME]! ⏰

Daqui a **1 hora** temos nossa reunião!

📍 **Link da sala:** [LINK DO GOOGLE MEET]

Te espero lá! 🚀

---

*Enviar exatamente 1 hora antes do horário agendado*',
script_title = 'Lembrete 1h'
WHERE name = 'Confirmação de Reunião - 1h antes' AND stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53';

UPDATE activity_templates 
SET script_body = '## Envio do Link da Reunião

Enviar via WhatsApp:

---

Oi [NOME]! 🎯

Segue o link da nossa reunião:

📍 **Google Meet:** [LINK]

📅 **Data:** [DATA]
🕐 **Horário:** [HORA]

Qualquer problema pra acessar, me avisa!',
script_title = 'Link da Reunião'
WHERE name = 'Envio de Link da Reunião' AND stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53';

-- NO-SHOW
UPDATE activity_templates 
SET script_body = '## Tentativa de Reagendamento

Olá [NOME]! Tudo bem?

Tínhamos uma reunião agendada para [DATA/HORA] mas não consegui te encontrar na sala.

Aconteceu alguma coisa? Podemos reagendar para outro horário?

---

**Tom:** Compreensivo, sem julgamento

**Opções para oferecer:**
- Hoje mais tarde
- Amanhã no mesmo horário
- Outro dia que o lead preferir

*Se conseguir reagendar, mover de volta para "Reunião 01 Agendada"*',
script_title = 'Reagendamento - Ligação'
WHERE name = 'Tentativa de Reagendamento 01' AND stage_id = '8f170b9b-5c99-43ce-afeb-896e1a6f4151';

UPDATE activity_templates 
SET script_body = '## WhatsApp de Reagendamento

---

Oi [NOME]! 😊

Tentei te ligar agora porque não consegui te encontrar na nossa reunião.

Aconteceu algum imprevisto? Sem problemas, a gente pode remarcar!

Me fala um novo horário que funcione pra você. 📅

---

*Aguardar resposta. Se não responder em 4h, fazer segunda tentativa de ligação.*',
script_title = 'Reagendamento - WhatsApp'
WHERE name = 'WhatsApp de Reagendamento' AND stage_id = '8f170b9b-5c99-43ce-afeb-896e1a6f4151';

UPDATE activity_templates 
SET script_body = '## Segunda Tentativa de Reagendamento

Olá [NOME], aqui é [SEU NOME] da MCF novamente.

Tentei falar contigo ontem sobre a nossa reunião. Você ainda tem interesse em conhecer o programa?

---

**Se confirmar interesse:**
- Reagendar imediatamente
- Reforçar importância de comparecer

**Se não tiver mais interesse:**
- Entender o motivo
- Agradecer e mover para LOST

*Após esta tentativa, se não houver retorno, considerar LOST*',
script_title = 'Reagendamento - Segunda Tentativa'
WHERE name = 'Tentativa de Reagendamento 02' AND stage_id = '8f170b9b-5c99-43ce-afeb-896e1a6f4151';

-- REUNIÃO 01 REALIZADA
UPDATE activity_templates 
SET script_body = '## Follow-up Pós Reunião 01

Olá [NOME]! Tudo bem?

Passando pra saber o que você achou da nossa reunião!

Ficou alguma dúvida sobre o modelo? Posso te ajudar com algo?

---

## Pontos a Abordar

1. **Impressão geral** - O que mais chamou atenção?
2. **Dúvidas** - Esclarecer pontos pendentes
3. **Próximos passos** - O que falta para tomar a decisão?
4. **Objeções** - Identificar e tratar

---

**Objetivo:** Identificar se está pronto para fechar ou precisa de mais informações',
script_title = 'Follow-up R1'
WHERE name = 'Follow-up pós R1' AND stage_id = '34995d75-933e-4d67-b7fc-19fcb8b81680';

UPDATE activity_templates 
SET script_body = '## Envio de Proposta

Enviar por e-mail:

---

**Assunto:** Proposta MCF - [NOME DO LEAD]

Olá [NOME]!

Conforme conversamos, segue em anexo a proposta do programa **Construir para Vender**.

📄 **Proposta em anexo**

**Resumo:**
- Investimento: R$ [VALOR]
- Forma de pagamento: [CONDIÇÕES]
- Bônus inclusos: [LISTA]

Fico no aguardo do seu retorno!

Abraços,
[SEU NOME]

---

*Após enviar, agendar follow-up para 24-48h*',
script_title = 'Envio de Proposta'
WHERE name = 'Envio de Proposta' AND stage_id = '34995d75-933e-4d67-b7fc-19fcb8b81680';

-- CONTRATO PAGO
UPDATE activity_templates 
SET script_body = '## Boas-vindas ao Novo Cliente

Enviar via WhatsApp:

---

🎉 **Parabéns, [NOME]!**

Seja muito bem-vindo(a) à família **Minha Casa Financiada**!

Seu acesso à plataforma será liberado em até 24h no e-mail: [EMAIL]

📱 **Grupo de alunos:** [Link]
📚 **Central de ajuda:** [Link]

Qualquer dúvida, estou à disposição!

Bora construir juntos! 🏠🚀

---

*Confirmar que o cliente recebeu a mensagem*',
script_title = 'Boas-vindas'
WHERE name = 'Boas-vindas ao Cliente' AND stage_id = '062927f5-b7a3-496a-9d47-eb03b3d69b10';

UPDATE activity_templates 
SET script_body = '## Agendar Reunião de Onboarding (R2)

Olá [NOME]! Tudo bem?

Agora que você já é nosso aluno, vamos agendar sua **reunião de onboarding**!

Nessa reunião vamos:
- Apresentar a plataforma
- Tirar suas primeiras dúvidas
- Definir seus próximos passos

---

## Disponibilidade

Qual o melhor horário pra você essa semana?

**Duração:** ~30 minutos
**Formato:** Online (Google Meet)

*Após agendar, mover para "Reunião 02 Agendada"*',
script_title = 'Agendamento Onboarding'
WHERE name = 'Agendar R2 / Onboarding' AND stage_id = '062927f5-b7a3-496a-9d47-eb03b3d69b10';

-- REUNIÃO 02 AGENDADA
UPDATE activity_templates 
SET script_body = '## Confirmação R2 - 24h Antes

Enviar via WhatsApp:

---

Oi [NOME]! 👋

Amanhã temos nosso **onboarding** às [HORA]!

Você consegue participar? Responde com ✅

📍 Link: [GOOGLE MEET]

---

*Se não confirmar, ligar para verificar*',
script_title = 'Confirmação R2 - 24h'
WHERE name = 'Confirmação R2 - 24h antes' AND stage_id = 'af1734ad-9ed8-46b0-9389-3ad8d1973931';

UPDATE activity_templates 
SET script_body = '## Lembrete R2 - 1h Antes

Enviar via WhatsApp:

---

Oi [NOME]! ⏰

Em **1 hora** temos nosso onboarding!

📍 **Link:** [GOOGLE MEET]

Te espero lá! 🚀',
script_title = 'Lembrete R2 - 1h'
WHERE name = 'Confirmação R2 - 1h antes' AND stage_id = 'af1734ad-9ed8-46b0-9389-3ad8d1973931';

-- REUNIÃO 02 REALIZADA
UPDATE activity_templates 
SET script_body = '## Follow-up Pós Onboarding

Olá [NOME]! Tudo bem?

Como foi sua primeira semana na plataforma?

Conseguiu acessar todos os módulos? Alguma dúvida?

---

## Checklist de Acompanhamento

- [ ] Acessou a plataforma?
- [ ] Assistiu as primeiras aulas?
- [ ] Entrou no grupo de alunos?
- [ ] Tem dúvidas específicas?

---

**Objetivo:** Garantir engajamento inicial do aluno',
script_title = 'Follow-up Onboarding'
WHERE name = 'Follow-up pós R2' AND stage_id = '155f9eab-0c1d-4215-b2e8-25fb546ba456';

UPDATE activity_templates 
SET script_body = '## Próximos Passos

Enviar via WhatsApp:

---

Oi [NOME]! 🎯

Seguem os **próximos passos** do seu projeto:

1️⃣ Assistir o Módulo 1 completo
2️⃣ Fazer o exercício de análise de terreno
3️⃣ Participar da mentoria ao vivo de [DIA]

📅 **Próxima mentoria:** [DATA/HORA]
📍 **Link:** [ZOOM/MEET]

Bons estudos! 📚🚀

---

*Acompanhar progresso do aluno na plataforma*',
script_title = 'Próximos Passos'
WHERE name = 'Próximos Passos' AND stage_id = '155f9eab-0c1d-4215-b2e8-25fb546ba456';