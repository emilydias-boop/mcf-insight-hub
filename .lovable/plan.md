## Problema

Em `src/components/crm/SpreadsheetCompareDialog.tsx` (linha 165-166), a lista de SDRs para o round-robin é derivada da **BU ativa do usuário** (`activeBU` do contexto), e não da pipeline (origin) para onde os leads estão sendo efetivamente importados. Resultado: o usuário vê os SDRs do Consórcio (Cleiton, Ithaline, Ygor) mesmo quando o destino selecionado é uma pipeline de outra BU.

```ts
const distributionSquad: BusinessUnit = (activeBU as BusinessUnit) || 'consorcio';
const { data: consorcioSdrs } = useSdrsFromSquad(distributionSquad);
```

## Solução

Resolver a BU dinamicamente a partir do `activeOriginId` (a pipeline de destino realmente selecionada), via `bu_origin_mapping`, e usar essa BU para alimentar `useSdrsFromSquad`. Mantém `activeBU` apenas como fallback enquanto o origin de destino ainda não foi resolvido.

### Passos

1. **Adicionar query** em `SpreadsheetCompareDialog.tsx` que busca a BU do origin de destino:
   - `SELECT bu FROM bu_origin_mapping WHERE entity_type='origin' AND entity_id = activeOriginId LIMIT 1`
   - Habilitada apenas quando `activeOriginId` existe.
   - Cache via React Query (`['origin-bu', activeOriginId]`).

2. **Derivar `distributionSquad`** assim:
   ```ts
   const destinationBU = originBuQuery.data ?? null;
   const distributionSquad: BusinessUnit = (destinationBU || activeBU || 'consorcio') as BusinessUnit;
   ```

3. **Atualizar o label** "X SDRs do {BU}" para refletir o squad resolvido (já funciona via `BU_OPTIONS.find(...)`).

4. **Reagir à troca de destino**: como `useSdrsFromSquad` já é um hook reativo (key inclui squad), apenas garantir que o `queryKey` use `distributionSquad` e que a lista re-renderize quando o usuário troca a pipeline de destino no seletor (`selectedDestinationOriginId`).

5. **Edge cases**:
   - Se o origin não tiver mapeamento em `bu_origin_mapping`, cair no `activeBU`.
   - Se nem `activeBU` nem mapeamento existirem, manter o fallback atual `'consorcio'` (preserva comportamento legado).
   - Não alterar a lógica de `bu-filtered-origins` nem nada fora da resolução de SDRs.

### Arquivos tocados

- `src/components/crm/SpreadsheetCompareDialog.tsx` (única alteração — frontend puro)

### Fora de escopo

- Não mexer em `LeadDistributionConfig`, `BulkDistributeSdrsDialog`, `useSdrsFromSquad`, nem em hooks de BU.
- Sem migrações de banco.
