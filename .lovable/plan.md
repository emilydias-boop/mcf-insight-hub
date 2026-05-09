## Objetivo

Quando um lead **entra na pipeline**, disparar um WhatsApp automático com um **botão "Falar com {{dono}}"** (link `wa.me/<telefone-do-dono>`) — onde "dono" é resolvido **dinamicamente conforme o estágio atual** do lead.

## Resolução do Dono (regra "depende do estágio")

A regra é uma cascata por prioridade dentro do `crm_deals`:

```text
Estágio do lead              → Dono (telefone usado no botão)
─────────────────────────────────────────────────────────────
R2 Agendada / Contrato Pago  → r2_closer_email
R1 Agendada / R1 Realizada   → r1_closer_email
Demais (prospecção, IS, etc) → owner_profile_id (SDR responsável)

Fallback final               → SDR do round-robin da BU/origem
```

A resolução vira uma RPC `resolve_deal_owner(deal_id)` que retorna `{ profile_id, full_name, telefone, email }`. Telefone vem de `employees.telefone` (via `email_pessoal` do profile). Se faltar telefone do dono → o passo de envio é pulado e logado.

## Variáveis novas no template

| Variável            | O que substitui                                 |
|---------------------|--------------------------------------------------|
| `{{dono_nome}}`     | Primeiro nome do dono resolvido                  |
| `{{dono_telefone}}` | Telefone E.164 (ex: `5511999999999`) sem `+`     |
| `{{dono_link_wa}}`  | `https://wa.me/{{dono_telefone}}?text=Olá%20...` |

O **botão URL** do template Twilio fica:
- Texto: `Falar com {{1}}` → preenchido com `{{dono_nome}}`
- URL: `https://wa.me/{{2}}` → preenchido com `{{dono_telefone}}`

## Fluxo no Admin (sem mudar a tela)

1. Em `/admin/automacoes` aba **Templates**, criar um template WhatsApp:
   - Nome: "Boas-vindas — agendar com dono"
   - BU: a desejada (Consórcio, Incorporador, etc.)
   - Conteúdo: `Olá {{nome}}! Eu sou {{dono_nome}} e vou te ajudar...`
   - Botão URL: texto `Falar com {{dono_nome}}`, URL `https://wa.me/{{dono_telefone}}`
   - Categoria: `utility` (aprovação Meta mais rápida)
   - Submeter à Meta → aguardar `approved`.

2. Em **Fluxos**, criar um Flow:
   - Pipeline: a desejada
   - Stage: o de **entrada** (ex: "Novo Lead")
   - Trigger: `enter`
   - Passo 1: canal WhatsApp, template acima, delay 0min.

Pronto — entrou no estágio, o engine resolve dono → renderiza variáveis → envia.

## O que precisa ser construído

### Backend
- **Migration**: nada de schema; só a função `public.resolve_deal_owner(_deal_id uuid)` (SECURITY DEFINER, search_path public) com a cascata acima + cleanup do telefone para E.164.
- **Edge function nova `automation-render-context`** (ou estender a existente que renderiza variáveis): chamar `resolve_deal_owner` e injetar `dono_nome / dono_telefone / dono_link_wa` no contexto antes de mandar pra Twilio.
- **Trigger `crm_deals` AFTER INSERT/UPDATE OF stage_id**: se o `stage_id` novo bate com algum flow `enter` ativo, enfileirar uma execução em `automation_executions` (mesma tabela já usada pelos flows hoje).

### Frontend
- **TemplateEditorDialog**: adicionar `dono_nome`, `dono_telefone`, `dono_link_wa` no array `AVAILABLE_VARIABLES` para serem inseridas com 1 clique. Sem nova UI estrutural.
- **Banner explicativo no editor** quando o template usar `{{dono_*}}`: "Este template requer que o lead tenha dono resolvível — leads sem dono serão pulados".

### Operacional / dados
- Garantir que `employees.telefone` esteja preenchido para cada SDR/Closer ativo (precisa de uma tela ou aviso). Sem telefone do dono → mensagem não sai.
- A normalização para E.164 assume Brasil (+55); números sem DDD/pais ganham `+55` automaticamente.

## Validação

1. Cadastrar telefone do SDR `joao@x` em `employees.telefone`.
2. Criar template aprovado pela Meta com botão `wa.me/{{dono_telefone}}`.
3. Criar flow trigger=enter no estágio "Novo Lead".
4. Importar lead com `owner_profile_id = joão`.
5. Conferir log `automation_executions`: contexto deve ter `dono_telefone=5511...` e Twilio retorna `queued`.
6. Mover o mesmo lead para "R1 Agendada" (com `r1_closer_email` setado) — segundo flow nesse stage deve trazer o **closer**, não o SDR.

## Fora de escopo

- Cadência D+1/D+3 (depende da Onda 2 do plano original).
- Página interna de agendamento — usuário escolheu botão `wa.me`, não calendário próprio.
- Mensagem de **distribuição** (assignar dono): só envia depois que dono já existe.
