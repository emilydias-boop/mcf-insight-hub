
# Adicionar Filtro de Busca por Nome/Email/Telefone na Agenda R2

## Objetivo
Permitir que os usuários encontrem leads específicos na Agenda R2 digitando nome, email ou telefone em um campo de busca.

## Solução

### Componente a Modificar
**`src/pages/crm/AgendaR2.tsx`**

### Alterações

#### 1. Adicionar Estado para o Termo de Busca
Novo estado `searchTerm` para armazenar o texto digitado pelo usuário.

#### 2. Adicionar Campo de Input na Barra de Filtros
Um input com ícone de busca posicionado na área de filtros (linha ~466), junto aos seletores de Closer, Status e R1 Closer.

```text
┌──────────────────────────────────────────────────────────────────────┐
│  [◄] [Data: 06/02/2026 ▼] [►] [Hoje]   |  [Dia][Semana][Mês]        │
│                                                                      │
│  🔍 [Buscar lead...________]  [Closer ▼]  [Status ▼]  [Closer R1 ▼] │
└──────────────────────────────────────────────────────────────────────┘
```

#### 3. Lógica de Filtro no `useMemo` de `filteredMeetings`
Adicionar filtro que busca em:
- `attendee.name` (nome do attendee)
- `attendee.phone` (telefone do attendee)
- `attendee.deal?.contact?.email` (email do contato)
- `attendee.deal?.contact?.phone` (telefone do contato)
- `attendee.deal?.name` (nome do deal/lead)

A busca será:
- Case-insensitive para texto
- Apenas dígitos para telefone (remove caracteres especiais)
- Mínimo de 2 caracteres para ativar o filtro

## Detalhes Técnicos

### Código do Input de Busca
```tsx
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Na área de filtros (linha ~530)
<div className="relative w-[220px]">
  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Buscar lead..."
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    className="pl-9 h-9"
  />
</div>
```

### Lógica de Filtro
```tsx
// Dentro do useMemo de filteredMeetings
if (searchTerm.length >= 2) {
  const search = searchTerm.toLowerCase();
  const searchDigits = searchTerm.replace(/\D/g, '');
  
  filtered = filtered.filter((m) => 
    m.attendees?.some(att => {
      const name = (att.name || att.deal?.contact?.name || att.deal?.name || '').toLowerCase();
      const phone = (att.phone || att.deal?.contact?.phone || '').replace(/\D/g, '');
      const email = (att.deal?.contact?.email || '').toLowerCase();
      
      return name.includes(search) || 
             email.includes(search) ||
             (searchDigits.length > 0 && phone.includes(searchDigits));
    })
  );
}
```

### Dependências do useMemo
Adicionar `searchTerm` no array de dependências:
```tsx
}, [meetings, closerFilter, statusFilter, r1CloserFilter, isR2Closer, myR2Closer?.id, searchTerm]);
```

## Comportamento
- O filtro é aplicado em tempo real conforme o usuário digita
- Funciona em conjunto com os outros filtros (Closer, Status, R1 Closer)
- Busca em todas as tabs (Lista, Calendário, Por Sócio)
- Visível para todos os tipos de usuário (admin, closer R2)

## Resultado Esperado
- Campo de busca visível na barra de filtros
- Ao digitar "Maria", mostra apenas reuniões com participantes que contenham "Maria" no nome
- Ao digitar "11999", mostra reuniões com telefones que contenham esses dígitos
- Ao digitar "email@", mostra reuniões com emails que contenham esse texto
