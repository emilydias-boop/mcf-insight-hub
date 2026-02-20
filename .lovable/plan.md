
# Fix: Erro "Preencha todos os campos" ao Adicionar Horário no Domingo

## Causa Raiz

O Domingo tem `day_of_week = 0`. Na validação do `handleAdd`:

```ts
if (!addingDay || !newTime || !newLink) {
  toast.error('Preencha todos os campos');
  return;
}
```

Em JavaScript, `!0` é `true`. Então quando o dia selecionado é Domingo (valor `0`), a condição `!addingDay` é avaliada como `true`, fazendo o formulário rejeitar o salvamento mesmo com todos os campos preenchidos.

O mesmo bug existe nos dois componentes de configuração:
- `src/components/crm/CloserAvailabilityConfig.tsx` (linha 121) — usado na Agenda R1
- `src/components/crm/R2CloserAvailabilityConfig.tsx` (linha 128) — usado na Agenda R2

## Solução

Trocar a verificação de `!addingDay` por `addingDay === null || addingDay === undefined`, que é a verificação correta para "nenhum dia selecionado" sem confundir o valor `0` com `false`.

### CloserAvailabilityConfig.tsx — linha 121

```ts
// ANTES (bugado)
if (!addingDay || !newTime || !newLink) {

// DEPOIS (correto)
if (addingDay === null || addingDay === undefined || !newTime || !newLink) {
```

### R2CloserAvailabilityConfig.tsx — linha 128

```ts
// ANTES (bugado)
if (!addingDay || !newTime || !newLink) {

// DEPOIS (correto)
if (addingDay === null || addingDay === undefined || !newTime || !newLink) {
```

## Arquivos Modificados

| Arquivo | Linha | Mudança |
|---------|-------|---------|
| `src/components/crm/CloserAvailabilityConfig.tsx` | 121 | Corrigir validação `!addingDay` → `addingDay === null \|\| addingDay === undefined` |
| `src/components/crm/R2CloserAvailabilityConfig.tsx` | 128 | Mesma correção |

Apenas 2 linhas alteradas — uma em cada arquivo. Nenhuma outra lógica é afetada.
