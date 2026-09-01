# Mapa: inativação de William Ferreira do Nascimento (somente leitura)

Resumo: **ele já está inativado no acesso**. O que ainda está aberto é o registro de **closer** (`closers.is_active = true`) e **12 reuniões futuras** no nome dele. Nada foi executado.

## Q1 — Onde ele existe

Saída crua da consulta pedida (linhas do "Matheus william alves elpidio" apareceram por causa do `%william%` no nome — não é ele):

```text
t         | id                                   | full_name/name    | email                                    | extra1        | extra2
profiles  | d27c71c8-8afb-4cf4-bf61-777a99e3b188 | Matheus william…  | matheus.alves@minhacasafinanciada.com    | null          | null
profiles  | a3a75942-b550-4102-af6d-d5885b4ba370 | William Ferreira  | william.ferreira@minhacasafinanciada.com | null          | null
closers   | 0d4a5264-258f-4ba4-bef1-afea307eed2b | William Ferreira  | william.ferreira@minhacasafinanciada.com | incorporador  | true
```

Demais tabelas de pessoas encontradas em `information_schema` (`employees`, `sdr`, `user_roles`; não existe `squad_members`):

```text
employees  | e979aa3f-dead-45ad-bda7-6428d82cc1f5 | William Ferreira | email_pessoal=william.ferreira@… | status=desligado | user_id=profile_id=a3a75942…
sdr        | 91ef00e6-5010-459d-b484-97644605e4d1 | William Ferreira | william.ferreira@…               | (sem coluna de status)
user_roles | user_id=a3a75942-b550-4102-af6d-d5885b4ba370 | role=closer
profiles   | a3a75942-… | access_status=desativado | squad={"inside sales produto"}
auth.users | a3a75942-… | banned_until=2126-08-08 | last_sign_in_at=2026-08-25
```

## Q2 — O que "inativar" significa em cada lugar

| Tabela | Coluna de status | Valor hoje | Efeito |
|---|---|---|---|
| `profiles` | `access_status` (`ativo`/`bloqueado`/`desativado`) | **desativado** | **Barra o login de verdade** |
| `auth.users` | `banned_until` | **2126-08-08** (banido) | Barra o login no Supabase Auth |
| `employees` | `status` | **desligado** | Sai do RH; dispara a sync de acesso |
| `closers` | `is_active` | **true (ainda ativo)** | Só some das listas/agenda; não afeta login |
| `sdr` | não tem coluna de status | — | Registro apenas de referência |
| `user_roles` | — (papel `closer`) | presente | Define o que ele veria se entrasse |

O que barra acesso, com o código:
- `src/contexts/AuthContext.tsx:84-96` — em background, se `access_status` for `bloqueado`/`desativado` (ou `blocked_until` no futuro), executa `supabase.auth.signOut()` e mostra "Sua conta foi bloqueada ou desativada".
- `src/contexts/AuthContext.tsx:268-281` — no login, a mesma checagem derruba a tentativa com erro antes de entrar.
- `supabase/functions/sync-employee-access/index.ts:74-81` — ao marcar o colaborador como `desligado`, grava `access_status='desativado'` e aplica `ban_duration` de ~100 anos no Auth. Foi isso que já aconteceu com ele.
- `closers.is_active` não aparece em nenhuma checagem de acesso — só em filtros de listagem (`src/hooks/useClosersFromBu.ts:23`, `src/hooks/useAgendaData.ts:386,477,482,2096,2627`).

## Q3 — A tela existe, e é por ela que o dono deve agir

- Rota: **`/usuarios`** (`src/App.tsx:284`), item "Usuários" no menu (`src/components/layout/AppSidebar.tsx:324`), guardado por `ResourceGuard resource="usuarios"` + `RoleGuard allowedRoles={["admin"]}` na página (`src/pages/GerenciamentoUsuarios.tsx:37`).
- Caminho: `/usuarios` → busca "William" → **Gerenciar** → aba geral → campo **Status de acesso** → `Desativado` → salvar.
- O que o botão faz: `useUpdateUserAccess` (`src/hooks/useUserMutations.ts:211-235`) dá `update` em `profiles` (`access_status`, `blocked_until`, `squad`). Ele **não** bane no Auth — o ban veio pela rota de RH (`employees.status = desligado`).
- Consequência prática: nesse usuário os dois já estão feitos. Pela tela não há o que mudar em `profiles`.
- O único passo que falta é o registro de closer: hoje **não há tela** que edite `closers.is_active` neste projeto (só filtros de leitura). Isso precisa de decisão antes de qualquer ação.

## Q4 — O que quebra (histórico)

- **Deals**: `crm_deals.owner_id = a3a75942…` → **0 linhas**. Não há deal em nome dele, logo nada fica órfão.
- **Reuniões históricas como closer**: 655 slots com `closer_id = 0d4a5264…`. A leitura de histórico é por `closer_id`/e-mail, não filtrada por `is_active`; o filtro `.eq('is_active', true)` aparece só onde se monta a lista de closers para **agendar/selecionar** (`useAgendaData.ts:386,477,482,2096,2627`, `useClosersFromBu.ts:23`) e em `useAgendaData.ts:443` a inatividade apenas zera a *disponibilidade*. Ou seja: **as reuniões e vendas passadas continuam atribuídas a ele nos painéis**.
- **Agendamentos como SDR**: 164 slots e 162 attendees com `booked_by = a3a75942…` — continuam apontando para o `profiles.id` dele, que permanece existindo. Nada vira "sem atribuição".
- Risco real a validar antes de desligar `closers.is_active`: telas que montam a lista de closers a partir da consulta filtrada por `is_active` podem deixar de exibir o **nome** dele em filtros/seletores de período histórico (o dado do slot continua, mas a opção de filtro pode desaparecer). Isso é cosmético em painéis que resolvem o nome pelo join do slot, e precisa de conferência tela a tela caso o dono queira desativá-lo em `closers`.

## Q5 — O que está aberto no nome dele hoje

- Deals como `owner_id`: **0**.
- Propostas de consórcio criadas por ele: **0**. Cadastros pendentes de consórcio criados por ele: **0**.
- Reuniões **futuras** (a partir de agora): **12** — 7 como closer (R1) e 5 que ele agendou como `booked_by` (R2, 5 attendees correspondentes).

```text
2026-09-01 21:00Z  r1  closer     deal 7893696d…  scheduled
2026-09-02 12:15Z  r1  closer     deal fcc1527a…  scheduled
2026-09-02 13:15Z  r1  closer     deal 6d4e06c4…  scheduled
2026-09-02 13:15Z  r2  booked_by  deal b9b14644…  scheduled
2026-09-02 14:15Z  r2  booked_by  deal 3da344b3…  scheduled
2026-09-02 14:30Z  r1  closer     deal 1545ff22…  scheduled
2026-09-02 17:00Z  r1  closer     deal 707007c3…  scheduled
2026-09-02 18:15Z  r1  closer     (sem deal)      scheduled
2026-09-02 19:00Z  r2  booked_by  deal fb32c441…  scheduled
2026-09-02 21:00Z  r1  closer     deal 06db3669…  scheduled
2026-09-03 13:15Z  r2  booked_by  deal 3893f892…  scheduled
2026-09-04 14:00Z  r2  booked_by  deal b83c1168…  scheduled
```

As 7 R1 como closer são as que exigem redistribuição — sem closer ativo ninguém assume a reunião. As 5 R2 que ele agendou só o mantêm como autor do agendamento; não bloqueiam a reunião.

## Q6 — Auth

- Existe registro em `auth.users`: `a3a75942-b550-4102-af6d-d5885b4ba370`, `banned_until = 2126-08-08 17:36Z`, último login em **2026-08-25 13:12Z**.
- Desativar o `profiles` **não invalida a sessão pelo servidor**: quem já tem refresh token continua com token válido até o app rodar a checagem. O corte acontece no cliente, em `AuthContext.tsx:84-96`, no próximo carregamento/refresh do app — na prática, ao recarregar a página ou reabrir o sistema ele cai imediatamente com o toast de conta desativada. Com o ban do Auth já aplicado, o refresh do token também falha ao expirar o access token (padrão de 1h).
- Conclusão: ele não tem como entrar de novo hoje.

## Caminho recomendado para o dono (nada executado aqui)

1. `/usuarios` → William Ferreira → conferir que o Status de acesso está **Desativado** (já está). Autoria/auditoria preservadas pela tela.
2. RH → Colaboradores → confirmar `status = desligado` (já está) — é o que aplica o ban no Auth.
3. Redistribuir as **7 R1 futuras** onde ele é closer, pela Agenda R1, antes de qualquer outra mudança.
4. Só depois decidir sobre `closers.is_active`: pedir uma verificação tela a tela dos painéis do incorporador antes, porque hoje não há tela para isso e a mudança afetaria seletores de closer.

Aprovar este plano não executa nada — ele é o mapa. Se quiser, o próximo passo pode ser só a verificação de Q4 (painéis do incorporador com closer inativo), também em leitura.
