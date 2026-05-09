## Objetivo

Validar end-to-end o WhatsApp automático "Falar com {{dono_nome}}" entrando um lead na pipeline **Inside Sales**, com **Carol Correa** como dono e o teste sendo entregue no número **11 99366-6464**.

## Pré-requisitos a corrigir

1. `employees.telefone` da Carol está NULL → preencher com `11 99021-9017` (número real dela).
2. Conferir se existe pipeline Inside Sales e seu primeiro estágio (vou descobrir o nome exato durante a execução — o schema usa `pipelines`/`pipeline_stages`, não `crm_pipelines`).

## Passo a passo do teste

### 1. Preparar dado da Carol
- `UPDATE employees SET telefone='11990219017' WHERE email_pessoal='carol.correa@minhacasafinanciada.com'`.
- Validar que `resolve_deal_owner` retorna `dono_nome=Caroline`, `dono_telefone=5511990219017`.

### 2. Criar template WhatsApp em `/admin/automacoes` → Templates
- Nome: `Boas-vindas — Falar com Dono (TESTE)`
- BU: Inside Sales (ou a BU dona da pipeline)
- Categoria: `utility`
- Conteúdo: `Olá {{nome}}! Sou {{dono_nome}}, sua especialista da MCF. Estou aqui para te ajudar a agendar sua reunião. Clique abaixo para falar comigo no WhatsApp.`
- Botão URL: texto `Falar com {{dono_nome}}`, URL `https://wa.me/{{dono_telefone}}`
- Criar no Twilio → Submeter à Meta → aguardar `approved` (pode levar minutos a horas)

### 3. Criar Flow em `/admin/automacoes` → Fluxos
- Pipeline: Inside Sales
- Stage: estágio inicial (ex.: "Novo Lead")
- Trigger: `enter`
- Passo: WhatsApp, template acima, delay 0

### 4. Disparar o teste
- Criar lead na pipeline Inside Sales:
  - Nome: `Teste Dono Dinâmico`
  - Telefone: `11 99366-6464` (destinatário)
  - `owner_profile_id` = profile da Carol (`c7005c87-76fc-43a9-8bfa-e1b41f48a9b7`)
- Trigger `crm_deals AFTER INSERT` enfileira execução em `automation_executions`.

### 5. Validação
- Conferir `automation_executions`: contexto deve conter `dono_nome=Caroline`, `dono_telefone=5511990219017`, `dono_link_wa=https://wa.me/5511990219017`.
- Conferir log Twilio: status `queued`/`sent`.
- WhatsApp deve chegar no **11 99366-6464** com botão clicável que abre conversa com a Carol (`5511990219017`).

## Detalhes técnicos

- Migrations: 1 UPDATE em `employees` (Carol).
- Sem código novo — toda infra (resolve_deal_owner, processor, trigger) já está no ar das ondas anteriores.
- Cleanup pós-teste: deletar lead de teste; manter template/flow se quiser usar em produção.

## Riscos

- **Template não aprovado pela Meta**: bloqueia envio. Mitigação: usar categoria `utility` e conteúdo simples; tempo médio de aprovação 5-30 min.
- **Pipeline Inside Sales pode ter nome de estágio diferente**: vou descobrir o nome exato no momento de criar o flow.
- **Trigger `crm_deals` pode não estar instalado**: se executions não aparecerem, enfileiro manualmente via `automation-enqueue`.
