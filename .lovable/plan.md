

## Permitir SDR ver múltiplas pipelines (caso Antony Elias)

### Diagnóstico

O Antony Elias está cadastrado com `allowed_origin_ids = ['7431cf4a... PILOTO ANAMNESE']` na tabela `sdr`. Como o array só tem **uma** origem, a regra de UI em `Negocios.tsx` (`sdrOverrideSingle = true`) esconde a sidebar de pipelines e trava o `effectiveOriginId` no único item do override — mesmo ele tendo **890 deals** legítimos em `PIPELINE INSIDE SALES` (`e3c04f21...`), que ficam invisíveis.

A lógica atual do código já está **correta** para o caso multi-pipeline: se `allowed_origin_ids` tiver 2+ entradas, a sidebar aparece, o usuário escolhe a pipeline, e `effectiveOriginId` respeita a seleção (linhas 141-148 e 679-685 de `src/pages/crm/Negocios.tsx`). Não precisa mexer em código, só nos dados do SDR.

Levantamento mostrou que **só o Antony Elias** está nessa situação hoje (SDR ativo com 1 origem no override mas leads em 2+ origens reais). Os outros SDRs ou não têm override (veem o padrão da BU) ou já têm múltiplas origens listadas.

### Decisão

**Atualizar somente o registro do Antony Elias** para incluir as duas pipelines onde ele tem volume operacional real:

- `7431cf4a-dc29-4208-95a6-28a499a06dac` — PILOTO ANAMNESE / INDICAÇÃO (1545 deals)
- `e3c04f21-ba2c-4c66-84f8-b4341c826b1c` — PIPELINE INSIDE SALES (890 deals)

As outras 2 origens onde aparecem deals esparsos (1 e 2 leads — `00 - GERENTES DE RELACIONAMENTO` e `VIVER DE ALUGUEL`) ficam de fora propositalmente: são resíduos de atribuição antiga, não fluxo de trabalho dele.

### Implementação

**Migration única** atualizando `allowed_origin_ids`:

```sql
UPDATE public.sdr
SET allowed_origin_ids = ARRAY[
  '7431cf4a-dc29-4208-95a6-28a499a06dac'::uuid,
  'e3c04f21-ba2c-4c66-84f8-b4341c826b1c'::uuid
],
updated_at = now()
WHERE id = '11111111-0001-0001-0001-000000000005'
  AND email = 'antony.elias@minhacasafinanciada.com';
```

Sem mudança em código. A lógica de `Negocios.tsx` / `OriginsSidebar` já trata múltiplos overrides corretamente.

### Comportamento esperado pós-fix

Para o Antony, ao abrir `/crm/negocios`:

- **Sidebar de Origens reaparece** (porque `sdrOverrideSingle = false` agora).
- Mostra os dois itens dentro do grupo "Perpétuo - X1": **PILOTO ANAMNESE / INDICAÇÃO** e **PIPELINE INSIDE SALES**.
- Pipeline default abre em **PILOTO ANAMNESE** (primeiro item do array — comportamento atual).
- Clicar em **PIPELINE INSIDE SALES** carrega os 890 deals daquela origem normalmente.
- Filtros, busca e kanban funcionam em ambas.
- Demais SDRs continuam exatamente como estão hoje (sem regressão — a migration só altera o registro do Antony).

### Validação pós-fix

1. Login com `antony.elias@minhacasafinanciada.com` → `/crm/negocios` → sidebar visível.
2. Default selecionado: PILOTO ANAMNESE → 1545 leads no kanban.
3. Clicar em PIPELINE INSIDE SALES → 890 leads carregam.
4. Conferir que ele **não** vê outras pipelines não autorizadas (Crédito, Consórcio, etc.).
5. Login com outro SDR (ex: Antony Nicolas, sem override) → continua com fluxo padrão da BU dele (Consórcio).

### Arquivos afetados

- Migration nova em `supabase/migrations/` — UPDATE no registro do Antony Elias.
- Nenhum arquivo `.ts/.tsx` modificado.

### Como expandir no futuro (sem novo deploy)

Se outro SDR aparecer no mesmo cenário (leads em N pipelines mas travado em 1), basta rodar:

```sql
UPDATE public.sdr 
SET allowed_origin_ids = ARRAY[<uuid1>, <uuid2>, ...]::uuid[]
WHERE email = '<sdr_email>';
```

Tudo o resto (sidebar, navegação, filtros) já funciona automaticamente.

