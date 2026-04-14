

## Plano: Enviar relatório apenas para Bellini (teste)

### O que fazer

Adicionar suporte a um parâmetro `buFilter` no body da request para enviar apenas o relatório especificado, e então invocar a função com `buFilter: "incorporador"`.

### Alteração em `supabase/functions/weekly-manager-report/index.ts`

Na função `serve` (linha ~936), parsear o body para extrair `buFilter`:

```ts
const body = await req.json().catch(() => ({}));
const buFilter = body?.buFilter || null;
```

Envolver os blocos de envio (linhas 948-966 e 968-986) com condicionais:

```ts
if (!buFilter || buFilter === 'incorporador') {
  // bloco incorporador existente
}

if (!buFilter || buFilter === 'consorcio') {
  // bloco consórcio existente
}
```

### Execução

1. Aplicar a alteração
2. Deploy da edge function
3. Invocar com `{ buFilter: "incorporador" }` para enviar somente para Bellini

### Resultado

Bellini recebe o email com os números atualizados (incluindo classificação A010/ANAMNESE/LIVE). Thobson nao recebe nada.

