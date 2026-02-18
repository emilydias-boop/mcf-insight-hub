
# Correção: Tabela "Faturamento por SDR" mostra apenas SDRs da BU

## Problema

O campo `owner_profile_id` do `crm_deals` pode ser qualquer pessoa que "possui" o deal -- closers, managers, SDRs de outras BUs. O sistema resolve o nome via `profiles` sem verificar se a pessoa é de fato um SDR da BU incorporador.

Nomes como "Thobson", "Jessica Bellini R2", "VINICIUS RANGEL MOTOLLO", "Caroline Aparecida Corrêa" aparecem porque são donos de deals que foram matcheados com transações, mas não são SDRs do incorporador.

## Solução

Buscar a lista de SDRs válidos da BU (tabela `sdr`, filtrada por `squad = bu` e `role_type = 'sdr'`) e usar esse Set para filtrar os nomes na classificação. Se o `owner_profile_id` não pertencer a um SDR da BU, classificar como "Sem SDR".

### Arquivo: `src/hooks/useAcquisitionReport.ts`

**Adicionar query para buscar SDRs válidos da BU:**

```text
// Nova query (após closers):
sdr WHERE active = true AND squad = {bu} AND role_type = 'sdr'
// Criar Set de profile_ids válidos cruzando sdr.email com profiles.email
```

Como a tabela `sdr` não tem `profile_id` diretamente, a abordagem mais simples é:
1. Buscar SDRs ativos do squad (já existe o padrão em `useSdrsFromSquad`)
2. Buscar os `profile_ids` correspondentes via email (tabela `profiles`)
3. Criar um Set de `profile_id` válidos
4. Na classificação (passo 8), verificar se `owner_profile_id` está no Set antes de usar o nome

**Alteração na classificação (passo 8):**

```text
// Antes:
const sdrId = matchedAttendee?.crm_deals?.owner_profile_id || null;
const sdrName = sdrId ? (sdrNameMap.get(sdrId) || 'SDR Desconhecido') : (isAutomatic ? origin : 'Sem SDR');

// Depois:
const rawSdrId = matchedAttendee?.crm_deals?.owner_profile_id || null;
const sdrId = rawSdrId && validSdrProfileIds.has(rawSdrId) ? rawSdrId : null;
const sdrName = sdrId ? (sdrNameMap.get(sdrId) || 'SDR Desconhecido') : (isAutomatic ? origin : 'Sem SDR');
```

## Resultado

- Tabela SDR: apenas SDRs reais da BU incorporador (Jessica Martins, Claudia Carielo, Julio Caetano, etc.) e "Sem SDR"
- Nomes como Thobson, Caroline, Vinicius desaparecem da tabela SDR
- Deals desses owners não-SDR passam para "Sem SDR"
