

# Corrigir erro "invalid input syntax for type date"

## Problema

Ao cadastrar um equipamento com campos de data vazios (Data de Compra, Garantia Inicio, Garantia Fim), o formulario envia strings vazias `""` para o Supabase, que rejeita porque `""` nao e uma data valida no PostgreSQL.

## Solucao

Sanitizar os dados do formulario antes de enviar ao banco, convertendo strings vazias para `null` nos campos de data.

### Arquivo: `src/components/patrimonio/AssetFormDialog.tsx`

No metodo `onSubmit`, antes de chamar `createAsset` ou `updateAsset`, limpar os campos de data:

```text
const cleanData = {
  ...data,
  data_compra: data.data_compra || null,
  garantia_inicio: data.garantia_inicio || null,
  garantia_fim: data.garantia_fim || null,
};
```

Usar `cleanData` no lugar de `data` nas chamadas de mutacao. Tambem aplicar a mesma logica para outros campos opcionais de texto (marca, modelo, etc.) para consistencia -- strings vazias serao convertidas para `null` ou mantidas como string, conforme preferencia.

Alteracao de apenas 1 arquivo, sem impacto no banco de dados.

