
# Plano: Isolamento de Closers por BU na Agenda Global

## Problema Identificado

Os closers do Consórcio estão aparecendo na agenda do Incorporador (rota `/crm/agenda`). A imagem mostra closers como **João Pedro Martins Vieira**, **Luis Felipe**, **Thobson** e **Victoria Paz** (todos da BU Consórcio) aparecendo junto com closers do Incorporador.

### Causa Raiz

A rota global `/crm/agenda` não possui um `BUProvider` definido:

```text
Fluxo Atual:
┌─────────────────────────────────────────────────────────────────────┐
│  Rota /crm/agenda (global)                                          │
│  ↓                                                                  │
│  useActiveBU() → Não há BUContext → Tenta usar userBUs[0]          │
│  ↓                                                                  │
│  Se usuário não tem squad → Retorna NULL                            │
│  ↓                                                                  │
│  useClosersWithAvailability(null) → NÃO aplica filtro de BU        │
│  ↓                                                                  │
│  Retorna TODOS os closers (Incorporador + Consórcio + ...)         │
└─────────────────────────────────────────────────────────────────────┘
```

### Dados Confirmados no Banco

| Closer | BU |
|--------|-----|
| Cristiane Gomes | incorporador |
| João Pedro Martins Vieira | **consorcio** |
| Julio | incorporador |
| Luis Felipe de Souza Oliveira Ramos | **consorcio** |
| Mateus Macedo | incorporador |
| Thayna | incorporador |
| Thobson | **consorcio** |
| Victoria Paz | **consorcio** |

---

## Solução Proposta

Envolver o layout `CRM.tsx` (rota global `/crm`) com um `BUProvider` padrão para **incorporador**. Isso mantém a compatibilidade com o comportamento histórico (o CRM global sempre foi do Incorporador) e resolve o vazamento de closers de outras BUs.

### Alterações Necessárias

**Arquivo:** `src/pages/CRM.tsx`

1. Importar o `BUProvider` do contexto
2. Envolver o conteúdo do componente com `<BUProvider bu="incorporador" basePath="/crm">`

```text
Fluxo Corrigido:
┌─────────────────────────────────────────────────────────────────────┐
│  Rota /crm/agenda (global)                                          │
│  ↓                                                                  │
│  CRM.tsx com BUProvider bu="incorporador"                           │
│  ↓                                                                  │
│  useActiveBU() → Retorna "incorporador" do contexto                │
│  ↓                                                                  │
│  useClosersWithAvailability("incorporador")                         │
│  ↓                                                                  │
│  Retorna apenas closers com bu="incorporador"                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Impacto

- **Agenda R1 e R2**: Mostrará apenas closers do Incorporador na rota `/crm/agenda`
- **Negócios, Contatos, Atendimentos**: Filtrados automaticamente pelo contexto da BU
- **Rotas específicas** (`/consorcio/crm/agenda`, etc.): Continuam funcionando normalmente com seus próprios `BUProvider`

---

## Detalhes Técnicos

### Modificação em `src/pages/CRM.tsx`

```tsx
// Adicionar import
import { BUProvider } from '@/contexts/BUContext';

// Envolver retorno com BUProvider
return (
  <BUProvider bu="incorporador" basePath="/crm">
    <div className="h-full flex flex-col">
      {/* ... conteúdo existente ... */}
    </div>
  </BUProvider>
);
```

### Validação

Após a implementação, a agenda em `/crm/agenda` deve mostrar apenas:
- Cristiane Gomes
- Julio  
- Mateus Macedo
- Thayna

E NÃO deve mostrar:
- João Pedro Martins Vieira
- Luis Felipe de Souza Oliveira Ramos
- Thobson
- Victoria Paz
