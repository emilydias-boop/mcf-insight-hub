

## Ajuste do Fluxo ANAMNESE-INCOMPLETA → ANAMNESE Completa

### Contexto atual
- Endpoint `anamnese-incompleta`: SDR fixo = Antony, tag = `ANAMNESE-INCOMPLETA`
- Endpoint `anamnese-mcf`: distribuição equitativa entre SDRs, tag = `ANAMNESE`
- **Problema**: Quando o lead entra como incompleta (Antony) e depois preenche tudo (re-submit via `anamnese-mcf`), o código atual apenas faz merge de tags e atualiza `lead_profile`, mas **não muda o estágio** e não preserva o owner Antony (pois o endpoint `anamnese-mcf` usaria distribuição normal se criasse um novo deal)

### Regras de negócio
1. **Entrada incompleta**: Lead entra via `anamnese-incompleta` → estágio inicial da pipeline, tag `ANAMNESE-INCOMPLETA`, owner = Antony (fixo)
2. **Completou depois**: Lead re-submete via `anamnese-mcf` → deal já existe → **atualizar info + custom_fields**, adicionar tag `ANAMNESE`, mover estágio para "Lead Gratuito", **manter owner Antony**
3. **Nunca completou**: Permanece em incompleta com Antony até preencher ou ser movido manualmente
4. **Entrada completa direta**: Lead entra direto via `anamnese-mcf` sem ter passado por incompleta → fluxo normal com distribuição equitativa

### Mudança técnica

**Arquivo**: `supabase/functions/webhook-lead-receiver/index.ts`

**No bloco "deal já existe" (linhas ~327-364)**, adicionar lógica específica:

```
Se deal existente TEM tag "ANAMNESE-INCOMPLETA" E o endpoint atual é "anamnese-mcf":
  1. Adicionar tag "ANAMNESE" ao deal
  2. Atualizar custom_fields com dados completos do payload
  3. Buscar stage "Lead Gratuito" na mesma origin
  4. Mover deal para stage "Lead Gratuito"
  5. Registrar deal_activity (stage_change)
  6. NÃO alterar owner (permanece Antony)
  7. Atualizar lead_profile normalmente
  8. Retornar action: "anamnese_completed"
```

**Detalhes da implementação**:
- Buscar `tags` e `stage_id` do deal existente (já busca `id`, adicionar `tags, stage_id, custom_fields, owner_id, owner_profile_id`)
- Verificar se `currentTags` inclui `ANAMNESE-INCOMPLETA`
- Buscar stage "Lead Gratuito" via query em `local_pipeline_stages` ou `crm_stages` com `stage_name ILIKE 'Lead Gratuito'` na `origin_id`
- Fazer `update` no deal com: novo stage_id, tags merged, custom_fields merged, `stage_moved_at`
- Inserir `deal_activities` com `activity_type: 'stage_change'`

### Arquivos afetados
- `supabase/functions/webhook-lead-receiver/index.ts` — Adicionar lógica de "completar anamnese" no bloco de deal existente
- Deploy da edge function após alteração

