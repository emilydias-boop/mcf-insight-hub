

# Corrigir Validação em TODOS os Campos de Valores

## Problema

Os campos de "Valores por Métrica" (Agendamentos, R1 Realizadas, Tentativas, Organização) estão configurados com `step="10"`, o que só aceita múltiplos de 10 (470, 480, 490...).

O catálogo possui valores como **R$ 475,00** que não são múltiplos de 10, causando erro de validação.

## Campos Afetados

| Campo | Linha | Valor Atual | Problema |
|-------|-------|-------------|----------|
| Métricas dinâmicas | 247 | `step="10"` | Bloqueia 475, 225, etc. |
| Agendadas (R$) | 265 | `step="10"` | Bloqueia valores não múltiplos de 10 |
| Realizadas (R$) | 278 | `step="10"` | Bloqueia valores não múltiplos de 10 |
| Tentativas (R$) | 289 | `step="10"` | Bloqueia valores não múltiplos de 10 |
| Organização (R$) | 301 | `step="10"` | Bloqueia valores não múltiplos de 10 |

## Solução

Alterar todos os `step="10"` para `step="1"` nos campos de valores por métrica.

### Arquivo a Modificar

**src/components/fechamento/EditIndividualPlanDialog.tsx**

### Alterações

```jsx
// Linha 247 - Métricas dinâmicas
step="1"  // Era step="10"

// Linha 265 - Agendadas
step="1"  // Era step="10"

// Linha 278 - Realizadas
step="1"  // Era step="10"

// Linha 289 - Tentativas
step="1"  // Era step="10"

// Linha 301 - Organização
step="1"  // Era step="10"
```

## Resultado Esperado

- Todos os valores do catálogo serão aceitos (475, 225, 350, etc.)
- Sem erros de validação HTML5
- Usuário poderá salvar qualquer valor inteiro

