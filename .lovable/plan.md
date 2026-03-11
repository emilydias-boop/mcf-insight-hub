

## Plano: Importação com colunas extras, tag, estágio e distribuição igualitária entre SDRs do Consórcio

### Contexto
A planilha do Consórcio tem 11 colunas (Cliente, Telefone, Estado/Cidade, Profissão, Empresário, Score, Nível, Imóvel Quitado, Terreno, Badges, Gerente). Hoje o dialog só mostra Nome/Email/Tel e atribui a **um** SDR. Precisa:
1. Mostrar colunas extras na tabela de resultados
2. Permitir adicionar uma tag aos deals criados
3. Permitir escolher um estágio específico
4. **Distribuir igualitariamente** entre os SDRs do Consórcio (round-robin) em vez de atribuir a um só

### Alterações

#### 1. `SpreadsheetRow` — campo `extraColumns`
**`src/hooks/useSpreadsheetCompare.ts`**: Adicionar `extraColumns?: Record<string, string>` à interface `SpreadsheetRow`.

#### 2. `SpreadsheetCompareDialog.tsx` — Colunas extras + Tag + Estágio + Distribuição

**Preservar colunas extras**: No `handleCompare`, incluir todas as colunas não-mapeadas (nome/email/phone) como `extraColumns` em cada `SpreadsheetRow`. Renderizar dinamicamente na tabela de resultados com scroll horizontal.

**Tag input**: Campo de texto para digitar uma tag (ex: "sem carta consórcio"). Passada para a edge function.

**Stage selector**: Select que busca estágios da pipeline atual (`crm_stages` by `origin_id`). Default = primeiro estágio.

**Modo de atribuição**: Trocar o select de SDR único por duas opções:
- **SDR único** (comportamento atual)
- **Distribuir igualmente** entre SDRs do Consórcio (usa `useSdrsFromSquad('consorcio')`)

Quando "Distribuir igualmente" estiver selecionado, o `handleSmartImport` faz round-robin: lead 1 → SDR A, lead 2 → SDR B, lead 3 → SDR C, etc. Cada lote enviado à edge function agrupa leads pelo SDR correspondente.

#### 3. Edge Function `import-spreadsheet-leads`
Aceitar parâmetros opcionais:
- `tags: string[]` — mesclado com `['base clint']`
- `stage_id: string` — usado no lugar do primeiro estágio quando fornecido

Alteração de ~5 linhas na edge function.

#### 4. Fluxo de distribuição round-robin (client-side)

```text
leads = [L1, L2, L3, L4, L5, L6, L7, L8, L9]
SDRs  = [Ana, Bia, Carlos]

Ana   → L1, L4, L7
Bia   → L2, L5, L8
Carlos→ L3, L6, L9
```

O client agrupa por SDR e faz N chamadas à edge function (uma por SDR), cada uma com `owner_email` e `owner_profile_id` do respectivo SDR.

### Arquivos modificados
- `src/hooks/useSpreadsheetCompare.ts` — interface `SpreadsheetRow`
- `src/components/crm/SpreadsheetCompareDialog.tsx` — UI completa (colunas extras, tag, estágio, distribuição)
- `supabase/functions/import-spreadsheet-leads/index.ts` — aceitar `tags` e `stage_id`

