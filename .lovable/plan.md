

## Corrigir Vazamento de Dados: SDR Ranking e Closer Ranking

### Diagnóstico

Após investigação no banco de dados, identifiquei **3 problemas distintos**:

| Problema | Exemplo |
|---|---|
| SDRs de outras BUs aparecem no ranking | cleiton.lima (consórcio), rangel.vinicius (crédito), jessica.bellini (crédito) |
| Closers aparecem no ranking de SDR | cristiane.gomes, julio.caetano, mateus.macedo, thaynar.tavares (todos com `role_type: closer`) |
| Pessoas desativadas aparecem | evellyn.santos (`active: false`), angelina.maia (`active: false`) |

A causa: o ranking SDR é construído agrupando `crm_deals.owner_id` sem verificar se o owner é de fato um SDR ativo da BU. Qualquer pessoa que já possuiu um deal na pipeline aparece.

### Correção

**Arquivo: `src/hooks/useCRMOverviewData.ts`**

1. **Buscar lista de SDRs ativos da BU** — Adicionar query na `sdr` table filtrando `squad = buName`, `active = true`, `role_type = 'sdr'`. Usar os `user_id`/`email` como whitelist para o ranking.

2. **Filtrar SDR ranking** — Antes de montar o `sdrRanking`, cruzar os `owner_id` dos deals com a lista de SDRs ativos. Owners que não estejam na lista são excluídos do ranking (seus leads ainda contam nos KPIs gerais, mas não aparecem na tabela de SDR).

3. **Filtrar Closer ranking por `is_active`** — Na query de `meeting_slot_attendees` para R1 e R2, adicionar `.eq('meeting_slots.closers.is_active', true)` para excluir closers desativados.

### Detalhes técnicos

```text
// Nova query paralela para SDRs ativos da BU
const sdrListResult = await supabase
  .from('sdr')
  .select('user_id, name, email')
  .eq('squad', buName)
  .eq('active', true)
  .eq('role_type', 'sdr');

// Construir whitelist de profile_ids e emails
const activeSdrIds = new Set(sdrList.map(s => s.user_id).filter(Boolean));
const activeSdrEmails = new Set(sdrList.map(s => s.email).filter(Boolean));

// Filtrar SDR ranking: só incluir owners que são SDRs ativos
sdrMap entries filtered by: activeSdrIds.has(ownerId) || activeSdrEmails.has(ownerEmail)

// Closer R1/R2 queries: adicionar filtro is_active
.eq('meeting_slots.closers.is_active', true)
```

### Arquivo afetado
- `src/hooks/useCRMOverviewData.ts` — Adicionar query de SDRs ativos, filtrar ranking SDR por whitelist, filtrar closers por `is_active`

