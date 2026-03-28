

## Fix: SDR mostra Closer em vez do SDR real

### Causa raiz

O campo `sdrName` vem de `owner_profile_id` do deal (via `profiles.full_name`). Porém, o `owner_profile_id` é frequentemente atualizado para o Closer após reuniões (triggers de sync). O SDR correto deveria vir do `booked_by` do attendee da R1, conforme a regra de negócio de atribuição.

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **Adicionar `booked_by` na query de R1** (linha 500):
```typescript
.select('contact_id, status, booked_by, meeting_slot:meeting_slots!inner(...)')
```

2. **Expandir `R1Lookup`** para incluir `bookedBy: string | null`

3. **Buscar nomes dos `booked_by`** — após a query de R1, coletar todos os UUIDs de `booked_by`, fazer uma query em `profiles` para obter `full_name`, e armazenar no R1Lookup

4. **Na construção do lead final**, priorizar SDR assim:
   - 1o: `r1.bookedByName` (quem agendou a R1)
   - 2o: `dealInfo.sdrName` (dono do deal, fallback)

Isso segue a hierarquia de atribuição: `booked_by` > `owner_profile_id`.

### Arquivo alterado
- `src/hooks/useCarrinhoAnalysisReport.ts`

