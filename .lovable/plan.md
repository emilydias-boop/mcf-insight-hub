

## Corrigir nome do SDR exibindo email em vez do nome

### Problema
O nome do SDR está aparecendo como email (ex: `cristiane.gomes@minhacasafinanciada.com`) em vez do nome completo. Isso ocorre porque no `useContractReport.ts`, a query na tabela `profiles` seleciona o campo `name` (que não existe) em vez de `full_name`. Como `p.name` retorna `undefined`, o fallback `p.name || p.email` sempre cai no email.

### Correção
**Arquivo:** `src/hooks/useContractReport.ts` (linha 143)

Trocar:
```ts
.select('id, name, email')
```
Por:
```ts
.select('id, full_name, email')
```

E na linha 148, trocar:
```ts
acc[p.email] = p.name || p.email;
```
Por:
```ts
acc[p.email] = p.full_name || p.email;
```

### Impacto
Apenas 2 linhas alteradas. O nome correto do SDR passará a aparecer nos cards do Controle Diego e em todos os relatórios que usam `useContractReport`.

