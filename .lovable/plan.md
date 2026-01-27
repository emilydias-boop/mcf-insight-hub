
# Plano: Corrigir Automacao de Stage ao Agendar Reuniao

## Problema Identificado

Leads agendados pelos SDRs **nao estao sendo movidos automaticamente** para o estagio "Reuniao 01 Agendada". Foram identificados **27 leads na pipeline A010 Hubla** que tem reuniao agendada mas continuam em "Novo Lead".

### Causa Raiz

A funcao `calendly-create-event` possui um bug na logica de busca de estagios:

1. **Pipeline A010 Hubla nao tem estagios proprios** - os deals usam estagios de outra pipeline ("Twilio - Teste")
2. **Busca inicial falha**: a funcao busca por `origin_id` do deal, mas esse origin nao tem o estagio "R1 Agendada"
3. **Fallback silencioso**: quando nao encontra, deveria mover para INSIDE SALES, mas o codigo atual nao atualiza a `origin_id` do deal para a nova pipeline

### Codigo Problematico (linhas 595-682)

```javascript
// 1. Busca estagios na pipeline do deal (falha para A010 Hubla)
for (const stageName of stageNames) {
  const { data: targetStage } = await supabase
    .from('crm_stages')
    .select('id, stage_name')
    .eq('origin_id', dealForStage.origin_id) // A010 Hubla nao tem estagios!
    .ilike('stage_name', `%${stageName}%`)
    ...
}

// 2. Fallback para INSIDE SALES
if (!targetStageId) {
  // Funciona, mas o deal nao eh atualizado porque
  // targetStageId !== dealForStage.stage_id avalia true
  // mas o stage_id do deal aponta para outra pipeline!
}
```

O problema eh que deals da A010 Hubla usam `stage_id = d24c5b70-a028-4929-80b5-a7c6cd4ed9a6` (Novo Lead da "Twilio - Teste"), e quando o fallback encontra o estagio correto, a comparacao `targetStageId !== dealForStage.stage_id` eh verdadeira mas a **atualizacao falha** porque o stage encontrado pertence a outra pipeline.

## Solucao Proposta

### 1. Corrigir a logica de fallback

Modificar `calendly-create-event` para:
- Se a pipeline atual nao tem o estagio alvo, **sempre** mover para INSIDE SALES
- Atualizar tanto `stage_id` quanto `origin_id` ao usar fallback
- Adicionar logs mais detalhados para debug

### Alteracoes no Arquivo: `supabase/functions/calendly-create-event/index.ts`

```typescript
// Linhas 581-687: Reescrever logica de atualizacao de estagio

try {
  const meetingType = body.meetingType || 'r1';
  const stageNamesR1 = ['Reunião 01 Agendada', 'Reunião 1 Agendada', 'R1 Agendada'];
  const stageNamesR2 = ['Reunião 02 Agendada', 'Reunião 2 Agendada', 'R2 Agendada'];
  const stageNames = meetingType === 'r2' ? stageNamesR2 : stageNamesR1;
  
  // Buscar o deal atual
  const { data: dealForStage } = await supabase
    .from('crm_deals')
    .select('origin_id, stage_id')
    .eq('id', dealId)
    .single();
  
  if (!dealForStage) {
    console.log('⚠️ Deal not found for stage update');
    return; // Nao bloquear agendamento
  }
  
  let targetStageId: string | null = null;
  let targetStageName: string | null = null;
  let newOriginId = dealForStage.origin_id;
  
  // 1. Tentar buscar na pipeline atual
  for (const stageName of stageNames) {
    const { data: stages } = await supabase
      .from('crm_stages')
      .select('id, stage_name')
      .eq('origin_id', dealForStage.origin_id)
      .ilike('stage_name', `%${stageName}%`)
      .limit(1);
    
    if (stages?.[0]) {
      targetStageId = stages[0].id;
      targetStageName = stages[0].stage_name;
      break;
    }
  }
  
  // 2. FALLBACK OBRIGATORIO: Se nao encontrou, usar INSIDE SALES
  if (!targetStageId) {
    console.log(`⚠️ Stage nao encontrado em origin ${dealForStage.origin_id}, usando fallback INSIDE SALES`);
    
    const { data: insideSalesOrigin } = await supabase
      .from('crm_origins')
      .select('id')
      .eq('name', 'PIPELINE INSIDE SALES')
      .single();
    
    if (!insideSalesOrigin) {
      console.error('❌ PIPELINE INSIDE SALES nao encontrada!');
      return;
    }
    
    // SEMPRE atualizar origin quando usar fallback
    newOriginId = insideSalesOrigin.id;
    
    for (const stageName of stageNames) {
      const { data: stages } = await supabase
        .from('crm_stages')
        .select('id, stage_name')
        .eq('origin_id', insideSalesOrigin.id)
        .ilike('stage_name', `%${stageName}%`)
        .limit(1);
      
      if (stages?.[0]) {
        targetStageId = stages[0].id;
        targetStageName = stages[0].stage_name;
        console.log(`📍 Fallback stage encontrado: ${targetStageName}`);
        break;
      }
    }
  }
  
  // 3. Aplicar atualizacao (forcar mesmo se origin mudou)
  if (targetStageId) {
    const originChanged = newOriginId !== dealForStage.origin_id;
    
    // SEMPRE atualizar se: stage diferente OU origin diferente
    if (targetStageId !== dealForStage.stage_id || originChanged) {
      const updateData: Record<string, string> = { 
        stage_id: targetStageId 
      };
      
      if (originChanged) {
        updateData.origin_id = newOriginId;
        console.log(`📍 Movendo deal para INSIDE SALES + ${targetStageName}`);
      }
      
      const { error: updateError } = await supabase
        .from('crm_deals')
        .update(updateData)
        .eq('id', dealId);
      
      if (updateError) {
        console.error('❌ Erro ao atualizar deal:', updateError.message);
      } else {
        console.log(`✅ Deal movido para ${targetStageName}${originChanged ? ' (pipeline alterada)' : ''}`);
        
        // Registrar atividade
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          activity_type: 'stage_change',
          description: originChanged 
            ? `Movido automaticamente ao agendar ${meetingType.toUpperCase()} (pipeline alterada)`
            : `Movido automaticamente ao agendar ${meetingType.toUpperCase()}`,
          from_stage: dealForStage.stage_id,
          to_stage: targetStageId,
          metadata: { 
            via: 'agenda_scheduling', 
            meeting_slot_id: slotId,
            origin_changed: originChanged,
            from_origin_id: originChanged ? dealForStage.origin_id : undefined,
            to_origin_id: originChanged ? newOriginId : undefined
          }
        });
      }
    } else {
      console.log(`⏭️ Deal ja esta no estagio correto`);
    }
  }
} catch (stageError) {
  console.error('⚠️ Erro ao atualizar stage (nao-fatal):', stageError);
}
```

### 2. Correcao Retroativa dos 27 Leads

Executar uma funcao manual de sincronizacao para corrigir os leads que ja foram agendados mas nao movidos:

```sql
-- Atualizar deals da A010 Hubla que tem reuniao agendada para INSIDE SALES + R1 Agendada
WITH deals_to_fix AS (
  SELECT DISTINCT msa.deal_id
  FROM meeting_slot_attendees msa
  JOIN meeting_slots ms ON ms.id = msa.meeting_slot_id
  JOIN crm_deals d ON d.id = msa.deal_id
  JOIN crm_stages s ON s.id = d.stage_id
  WHERE ms.meeting_type = 'r1'
    AND msa.status NOT IN ('cancelled', 'no_show')
    AND LOWER(s.stage_name) IN ('novo lead', 'lead qualificado')
)
UPDATE crm_deals 
SET 
  origin_id = 'e3c04f21-ba2c-4c66-84f8-b4341c826b1c', -- INSIDE SALES
  stage_id = 'a8365215-fd31-4bdc-bbe7-77100fa39e53'   -- Reuniao 01 Agendada
WHERE id IN (SELECT deal_id FROM deals_to_fix);
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| ~30% dos leads nao sao movidos automaticamente | 100% dos leads movidos |
| Leads A010 Hubla ficam em "Novo Lead" | Automaticamente vao para INSIDE SALES + R1 Agendada |
| Fallback silencioso | Logs detalhados do processo |
| 27 leads retroativos nao corrigidos | Corrigidos via SQL |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/calendly-create-event/index.ts` | Corrigir logica de fallback (linhas 581-687) |

## Testes Necessarios

1. Agendar lead da pipeline A010 Hubla
2. Verificar que move para INSIDE SALES + R1 Agendada
3. Verificar que deal_activity eh registrada
4. Verificar logs da edge function
