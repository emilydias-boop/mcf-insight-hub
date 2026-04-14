

## Plano: Distribuição igualitária ao mover leads em massa

### Situação atual

O dialog "Mover para outra Pipeline" move os leads mas **não altera o owner** — eles chegam na pipeline destino sem atribuição ou mantendo o owner anterior. Não há opção de distribuir entre os SDRs da pipeline destino.

### Solução

Adicionar um **checkbox "Distribuir igualitariamente entre SDRs"** no `BulkMovePipelineDialog`. Quando ativado, após mover cada deal, o sistema atribui o owner usando round-robin entre os SDRs ativos da pipeline destino (via `lead_distribution_config` ou `get_next_lead_owner` RPC).

### Alterações

**Arquivo**: `src/components/crm/BulkMovePipelineDialog.tsx`

1. Adicionar state `distributeEqually: boolean` (default false)
2. Quando `selectedOriginId` é selecionado, buscar os SDRs configurados na `lead_distribution_config` daquela origin (usando `useDistributionConfig`)
3. Mostrar checkbox "Distribuir igualitariamente entre SDRs da pipeline" com preview dos SDRs configurados
4. No `handleMove()`, se `distributeEqually` estiver ativo:
   - Buscar SDRs da config de distribuição da pipeline destino
   - Fazer round-robin simples: deal 1 → SDR A, deal 2 → SDR B, deal 3 → SDR C, deal 4 → SDR A...
   - Atualizar `owner_id` (email) e `owner_profile_id` (UUID) de cada deal junto com a movimentação
5. Se não houver config de distribuição na pipeline destino, chamar o RPC `get_next_lead_owner(p_origin_id)` para cada deal como fallback

### UI

- Checkbox com label "Distribuir igualitariamente entre SDRs"
- Abaixo do checkbox, mostrar lista dos SDRs que receberão (nomes + quantidade estimada por SDR: "~X leads cada")
- Se não houver SDRs configurados, mostrar aviso "Nenhum SDR configurado na pipeline destino"

### Resultado

Os 447 leads serão movidos para a pipeline destino E distribuídos igualmente entre os SDRs configurados, sem precisar fazer transferência manual depois.

