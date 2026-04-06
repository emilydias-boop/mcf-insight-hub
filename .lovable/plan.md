

# Corrigir step dos campos de remuneração no Cargo

## Problema
Os inputs "Fixo (R$)" e "Variável (R$)" no `CargoFormDialog` usam `step={100}`, forçando validação nativa do browser para aceitar apenas múltiplos de 100. Valores como R$ 3.150 ou R$ 1.350 são rejeitados.

## Solução

### Arquivo: `src/components/hr/config/CargoFormDialog.tsx`
- Linha 451: alterar `step={100}` para `step={0.01}` (ou `step="any"`) no input de `fixo_valor`
- Linha ~471: mesma alteração no input de `variavel_valor`

Isso permite qualquer valor decimal, mantendo a validação `min={0}` do Zod.

## Resultado esperado
- Valores como R$ 3.150, R$ 2.750 são aceitos sem erro do browser

