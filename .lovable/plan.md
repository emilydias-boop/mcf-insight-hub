

## Fix: SDR mostra Closer porque fallback R1 não resolve booked_by

### Causa raiz (2 bugs)

1. **Fallback R1 query (linha 730)** não inclui `booked_by` no select. Resultado: `bookedById = null` para leads encontrados por email fallback.

2. **Resolução de nomes de bookers (linhas 541-559) executa ANTES do fallback R1 query (linhas 726-745)**. Mesmo que o fallback trouxesse `booked_by`, o nome nunca seria resolvido porque a resolução já rodou.

Consequência: `r1Fresh?.bookedByName` = `null` → cai no fallback `deal?.sdrName` → que é o `owner_profile_id` do deal (frequentemente o Closer).

### Correção

**`src/hooks/useCarrinhoAnalysisReport.ts`**:

1. **Linha 730**: Adicionar `booked_by` ao select do fallback R1:
```typescript
.select('contact_id, status, booked_by, meeting_slot:meeting_slots!inner(...)')
```

2. **Após o fallback R1 (após linha 745)**: Adicionar uma segunda rodada de resolução de nomes de bookers para os novos `bookedById` encontrados:
```typescript
// Resolve booked_by names for fallback R1 entries
const newBookedByIds = new Set<string>();
for (const r1 of r1Map.values()) {
  if (r1.bookedById && !r1.bookedByName) newBookedByIds.add(r1.bookedById);
}
if (newBookedByIds.size > 0) {
  const { data: newProfiles } = await supabase
    .from('profiles').select('id, full_name')
    .in('id', Array.from(newBookedByIds));
  for (const p of newProfiles || []) {
    if (!p.full_name) continue;
    for (const r1 of r1Map.values()) {
      if (r1.bookedById === p.id) r1.bookedByName = p.full_name;
    }
  }
}
```

### Arquivo alterado
- `src/hooks/useCarrinhoAnalysisReport.ts` (2 pontos)

