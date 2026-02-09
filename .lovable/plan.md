
# Corrigir Mateus ausente nos filtros de Closer

## Causa Raiz

O Mateus Macedo existe na tabela `closers` (ID: `2396c873-a59c-4e07-bcd8-82b6f330b969`) com `is_active = true` e `bu = incorporador`, porem seu campo `meeting_type` esta **NULL**.

Quando os filtros usam `useGestorClosers('r1')`, a query faz `.eq('meeting_type', 'r1')`, que exclui registros com valor NULL. Por isso o Mateus nao aparece.

Outro hook (`useClosersWithAvailability`) ja trata isso corretamente usando `.or('meeting_type.is.null,meeting_type.eq.r1')`.

## Correcao (2 partes)

### 1. Corrigir o dado no banco

Atualizar o `meeting_type` do Mateus para `'r1'`:

```text
UPDATE closers 
SET meeting_type = 'r1', updated_at = NOW() 
WHERE id = '2396c873-a59c-4e07-bcd8-82b6f330b969';
```

### 2. Tornar a query resiliente a NULLs

Alterar `src/hooks/useGestorClosers.ts` para que, quando `meetingType = 'r1'`, inclua tambem closers com `meeting_type` NULL (que sao closers legados sem classificacao). Isso evita que o problema se repita com outros closers.

**Linha 29-31** — substituir:
```text
if (meetingType) {
  query = query.eq('meeting_type', meetingType);
}
```
por:
```text
if (meetingType === 'r1') {
  query = query.or('meeting_type.is.null,meeting_type.eq.r1');
} else if (meetingType) {
  query = query.eq('meeting_type', meetingType);
}
```

Aplicar a mesma logica na query do coordenador (linhas 77-79).

## Resultado

- Mateus aparecera imediatamente em todos os filtros de closer
- Closers sem `meeting_type` definido serao tratados como R1 por padrao
- Nenhum risco de quebrar filtros de R2 (que continuam usando `.eq('meeting_type', 'r2')`)
