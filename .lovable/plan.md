

## Problema

A função `syncDealStageFromAgenda` transfere o `owner_id` do deal para o closer em **todos** os status de transferência (completed, contract_paid, R2 no-show), independente do `meetingType`. Isso faz com que ao completar R2, o dono passe do closer R1 (Thayna) para o closer R2 (Claudia).

**Exemplo do usuário**: Wagner Ferreira → R1 com Thayna → R2 com Claudia → deal fica no nome da Claudia (errado). Deveria permanecer no nome da Thayna.

## Solução

**Arquivo: `src/hooks/useAgendaData.ts`** (linhas 1550-1586)

Manter a transferência de ownership **apenas para R1**. Para R2, salvar o `r2_closer_email` mas **não** alterar `owner_id` nem `owner_profile_id`.

Mudança na lógica (linha ~1550):

```typescript
if (shouldTransferOwnership) {
  // ... preservar original_sdr_email (sem mudança)
  // ... salvar r1_closer_email (sem mudança)
  // ... salvar r2_closer_email (sem mudança)
  
  // Transferir owner_id APENAS para R1
  // R2 mantém o dono como R1 closer para rastreabilidade
  if (meetingType === 'r1' || isR2NoShow) {
    const { data: closerProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', closerEmail)
      .maybeSingle();
    
    updateData.owner_id = closerEmail;
    if (closerProfile) {
      updateData.owner_profile_id = closerProfile.id;
    }
  }
}
```

**R2 no-show** continua transferindo para o closer R2, pois a coordenadora precisa ver esses leads para reagendar (comportamento existente mantido).

### Resultado
- R1 Realizada/Contrato Pago: deal passa para o closer R1 ✓
- R2 Agendada/Realizada: deal **permanece** no closer R1 ✓
- R2 No-show: deal passa para closer R2 (para gestão de reagendamento) ✓
- `r2_closer_email` continua sendo salvo para rastreabilidade ✓

