# Auditoria (somente leitura): gates de papel do auto-discador

Nenhuma alteração de código proposta aqui — este é o resultado do mapeamento pedido.

## 1. Botões na sidebar

`src/components/layout/AppSidebar.tsx:395-399`

```tsx
// Dialer (visível APENAS para SDRs — closers e admins não fazem ligação ativa)
const dialer = useDialerLauncher();
const autoDialer = useAutoDialer();
const dialerRoles = new Set(['sdr']);
const showDialerSection = (allRoles as string[]).some(r => dialerRoles.has(r));
```

`src/components/layout/AppSidebar.tsx:777-808` — o grupo com "Discador rápido" e "Auto-Discador" está inteiro dentro de `{showDialerSection && (...)}`.

Papéis aceitos: **apenas `sdr`**. Nem `closer`, nem `closer_sombra`, nem `cobranca_consorcio`.

Separadamente, o item de menu "Discador" (rota `${crmBasePath}/discador`, página Sonax) tem `requiredRoles: ["sdr", "closer"]` (`AppSidebar.tsx:484-491`).

## 2. Gates dentro do painel / contexto

`src/contexts/AutoDialerContext.tsx`: **nenhum gate de papel**. Não lê `role`/`allRoles`; só ramal, motor e filas.

`src/components/sdr/AutoDialerPanel.tsx:40-74`:

```tsx
const { user, role, allRoles } = useAuth();
const isSdr = isSdrRole(role, allRoles);
...
const sdrOriginIds = useMemo<string[]>(() => {
  if (!isSdr) return [];
  if (sdrOriginOverride && sdrOriginOverride.length > 0) return sdrOriginOverride;
  return buMapping?.origins || [];
}, [isSdr, sdrOriginOverride, buMapping]);
...
const restrictToSdrOrigins = isSdr;
```

`isSdrRole` (`src/components/auth/NegociosAccessGuard.tsx:147-152`) só retorna true para `sdr`.

Não há bloqueio de abrir o painel, carregar fila ou iniciar discagem por papel. O que muda é o *escopo*: `isSdr === false` cai no ramo `PipelineSelector` genérico (`AutoDialerPanel.tsx:545-555`) e **não** aplica o filtro por dono.

Guard real e único: ramal. `AutoDialerPanel.tsx:411` — "Ramal não configurado — fale com o gestor antes de iniciar."

## 3. Fila de leads

Query direta em `crm_deals` (não RPC), `AutoDialerPanel.tsx:122-145`:

```tsx
let q = supabase
  .from('crm_deals')
  .select('id, name, contact_id, origin_id, custom_fields, lead_temperature, owner_profile_id, crm_contacts(name, phone)')
  .eq('stage_id', stageId)
  .eq('is_duplicate', false)
  .is('archived_at', null)
  .eq('is_archived', false)
  .or(`last_auto_dialer_call_at.is.null,last_auto_dialer_call_at.lt.${cutoff}`)
  .order('created_at', { ascending: false })
  .range(from, from + pageSize - 1);
if (restrictToSdrOrigins && pipelineId) q = q.eq('origin_id', pipelineId);
if (restrictToSdrOrigins && user?.id) q = q.eq('owner_profile_id', user.id);
```

Filtros: estágio (obrigatório), duplicado/arquivado, "já discado hoje". Dono (`owner_profile_id`) e origem só quando `isSdr`. Sem filtro por squad e sem filtro por papel. Modo "Colar" ignora o CRM por completo.

## 4. Banco / RLS

- `crm_deals` SELECT: `Authenticated can view crm_deals` → `qual: true`. Não barra papel.
- `crm_deals` UPDATE: `SDRs e closers podem atualizar deals` → `manager OR admin OR sdr OR closer`. **`cobranca_consorcio` não passa** — o carimbo `last_auto_dialer_call_at` (`AutoDialerContext.tsx:255-262`) falha silenciosamente (só `console.warn`), então o lead volta na fila no mesmo dia.
- `deal_activities` SELECT `true`, INSERT sem `qual`, UPDATE `user_id = auth.uid()` → ok.
- `sonax_call_events` SELECT `sonax_call_events_select_scoped`: admin/manager/coordenador, ou `sdr_email = jwt email`, ou dono do deal (`owner_id`/`owner_profile_id`). Cobrança só vê o evento se o e-mail do ramal casar ou se for dona do deal — senão a detecção automática de atendimento não chega.
- `calls` SELECT: `user_id = auth.uid()` OR admin/manager/coordenador — ok para o próprio.
- `sdr_ramal_mapping` SELECT: `true` — não barra.

Nenhuma função de banco chamada pelo auto-discador exige `sdr`.

## 5. Atalho Ctrl+Shift+A

`src/components/crm/QuickDialerLauncher.tsx:27-40` registra o listener global; `MainLayout.tsx:71-79` monta o launcher para todo `podeDiscar`. O atalho **funciona independente da sidebar** — quem tem `podeDiscar` abre o painel pelo teclado mesmo sem o botão.

## Conclusão

(a) Falta só incluir `cobranca_consorcio` em `dialerRoles` no `AppSidebar.tsx:398` (e, para escopo/fila próprios, tratá-lo como restrito por dono em `AutoDialerPanel.tsx:74`); no banco, faltaria a política de UPDATE em `crm_deals` cobrir o papel, senão o carimbo anti-repetição falha.

(b) Hoje a fila não viria vazia: sem `isSdr`, o painel usa o `PipelineSelector` genérico e retorna todos os deals do estágio escolhido — ou seja, cobrança veria leads de qualquer dono, o oposto do desejado; para fila de cobrança fazer sentido seria preciso escopo próprio (estágios/pipeline de cobrança + dono), que hoje não existe.
