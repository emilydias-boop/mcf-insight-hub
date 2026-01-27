
# Plano: Corrigir Validação do Campo "Origem" no Formulário de Consórcio

## Problema Identificado

Você não consegue salvar uma carta de consórcio com origem "Reverter" porque o **schema Zod do formulário está hardcoded** com apenas 4 valores:

```typescript
// src/components/consorcio/ConsorcioCardForm.tsx (linha 121)
origem: z.enum(['socio', 'gr', 'indicacao', 'outros'])
```

Porém, a tabela `consorcio_origem_options` agora contém:

| name | label |
|------|-------|
| socio | Sócio |
| gr | GR |
| indicacao | Indicação |
| clube_arremate | Clube do Arremate |
| outros | Outros |
| **reverter** | **Reverter** |

**O formulário mostra a opção "Reverter" no dropdown** (vindo do banco), mas quando você tenta salvar, a **validação Zod rejeita** porque `reverter` não está na lista permitida.

## Solução Proposta

Tornar o schema Zod **dinâmico**, aceitando qualquer string no campo origem (já que as opções são validadas pelo banco/dropdown).

## Alterações Técnicas

### Arquivo: `src/components/consorcio/ConsorcioCardForm.tsx`

**Alteração 1: Schema Zod (linha 121)**

| Antes | Depois |
|-------|--------|
| `origem: z.enum(['socio', 'gr', 'indicacao', 'outros'])` | `origem: z.string().min(1, 'Origem é obrigatória')` |

**Alteração 2: Default values (linha 293, 547, 486)**

Atualizar os casts de `origem` para aceitar string genérica em vez de enum restrito.

### Arquivo: `src/types/consorcio.ts`

**Alteração 3: Tipo OrigemConsorcio (linha 5)**

| Antes | Depois |
|-------|--------|
| `type OrigemConsorcio = 'socio' \| 'gr' \| 'indicacao' \| 'outros'` | `type OrigemConsorcio = string` |

## Código Detalhado

```typescript
// src/components/consorcio/ConsorcioCardForm.tsx

// Linha 121 - Schema Zod
origem: z.string().min(1, 'Origem é obrigatória'),

// Linha 232 - Default value para edição
origem: card.origem || 'socio',

// Linha 486 - Reset para edição
origem: card.origem || 'socio',

// Linha 547 - Reset para criação
origem: 'socio',
```

```typescript
// src/types/consorcio.ts

// Linha 5
export type OrigemConsorcio = string;
```

## Resultado Esperado

Após a correção:

- O campo "Origem" aceitará qualquer valor cadastrado em `consorcio_origem_options`
- Você poderá salvar cartas com origem "Reverter", "Clube do Arremate" ou qualquer nova origem que adicionar no futuro
- A validação continuará garantindo que o campo não fique vazio

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/consorcio/ConsorcioCardForm.tsx` | Alterar schema Zod de enum para string |
| `src/types/consorcio.ts` | Alterar tipo OrigemConsorcio para string |

## Impacto

- **Zero impacto visual** - o dropdown continua igual
- **Comportamento corrigido** - salvar funciona com qualquer origem do banco
- **Flexibilidade futura** - novas origens funcionam sem alterar código
