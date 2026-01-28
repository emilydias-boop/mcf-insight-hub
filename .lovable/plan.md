

# Trocar "Convidado" para "Agendado"

## Problema
O status `invited` está exibindo "Convidado" como label, mas o termo mais claro e alinhado com o fluxo do sistema seria **"Agendado"**.

---

## Mudança Simples

| Arquivo | Alteração |
|---------|-----------|
| `src/components/crm/R2AgendadasList.tsx` | Trocar label de "Convidado" para "Agendado" em 2 lugares |

---

## Detalhes Técnicos

### 1. STATUS_LABELS (linha 37)
```typescript
// Antes
invited: { label: 'Convidado', className: 'bg-purple-500 text-white border-purple-500' },

// Depois
invited: { label: 'Agendado', className: 'bg-purple-500 text-white border-purple-500' },
```

### 2. POSITION_OPTIONS (linha 47)
```typescript
// Antes
{ value: 'invited', label: 'Convidado' },

// Depois
{ value: 'invited', label: 'Agendado' },
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Badge roxo "Convidado" | Badge roxo "Agendado" |
| Filtro "Convidado" | Filtro "Agendado" |

O usuário verá consistentemente o termo **"Agendado"** que é mais claro no contexto do Carrinho R2.

