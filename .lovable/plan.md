
# Corrigir Acesso de Usuário com Múltiplas Roles (SDR + Closer)

## Contexto do Problema

A usuária **Jessica Martins** possui duas roles no sistema: `sdr` e `closer`. Devido ao sistema de prioridade de roles, o sistema a trata apenas como `closer` (prioridade 4), ignorando suas funções de SDR (prioridade 8).

### Dados do Usuário
- **User ID:** `b0ea004d-ca72-4190-ab69-a9685b34bd06`
- **Email:** jessica.martins@minhacasafinanciada.com
- **Roles:** closer (prioridade 4), sdr (prioridade 8)
- **Cadastro em closers:** meeting_type = 'r2' (R2 apenas)
- **Deals como owner:** 361 no PIPELINE INSIDE SALES
- **BU:** incorporador

---

## Problemas Identificados

### 1. Agenda R1 Vazia
O sistema detecta `role === 'closer'`, então mostra "Minha Agenda" para closers. Porém:
- O hook `useMyCloser` encontra Jessica na tabela `closers`
- Mas ela está cadastrada com `meeting_type = 'r2'`
- A Agenda R1 filtra `meeting_type = 'r1'`
- **Resultado:** Nenhuma reunião aparece

### 2. Negócios Não Mostram Deals
- A função `isSdrRole(role)` retorna `false` porque `role === 'closer'`
- Isso faz com que a lógica de pré-seleção de origem para SDRs não funcione
- O filtro de deals usa `isRestrictedRole` que inclui closers, mas não usa a lógica específica de SDR

### 3. Agenda R2 Sem Visão Personalizada
- A Agenda R2 mostra todos os closers R2 sem filtro "Minha Agenda"
- Jessica deveria ver apenas suas próprias reuniões R2

---

## Solução Proposta

### Parte 1: Corrigir Verificação de SDR para Multi-Roles

**Arquivo:** `src/components/auth/NegociosAccessGuard.tsx`

Modificar a função `isSdrRole` para aceitar o array `allRoles` e verificar se o usuário tem role SDR:

```text
// ANTES: Verifica apenas o role principal
export const isSdrRole = (role: AppRole | null): boolean => {
  return role === 'sdr';
};

// DEPOIS: Verifica se tem SDR em qualquer role
export const isSdrRole = (role: AppRole | null, allRoles?: AppRole[]): boolean => {
  if (role === 'sdr') return true;
  // Se tem allRoles, verificar se SDR está presente
  if (allRoles && allRoles.includes('sdr')) return true;
  return false;
};
```

### Parte 2: Passar `allRoles` para Verificação em Negocios.tsx

**Arquivo:** `src/pages/crm/Negocios.tsx`

Modificar para usar `allRoles` do AuthContext:

```text
// ANTES
const { role, user } = useAuth();
const isSdr = isSdrRole(role);

// DEPOIS
const { role, user, allRoles } = useAuth();
const isSdr = isSdrRole(role, allRoles);
```

### Parte 3: Ajustar Agenda R1 para Usuários Multi-Role

**Arquivo:** `src/pages/crm/Agenda.tsx`

Modificar a lógica para verificar se o usuário é "apenas closer" ou "também SDR":

```text
// ANTES
const isCloser = role === 'closer';

// DEPOIS
const { role, allRoles } = useAuth();
// Usuário é closer PURO se tem role closer mas NÃO tem SDR
const isCloserOnly = role === 'closer' && !allRoles.includes('sdr');
// Para filtering de reuniões e UI "Minha Agenda"
const isCloser = role === 'closer';
```

Se o usuário tem SDR também, mostrar a agenda normal (não "Minha Agenda") para que possa agendar para outros closers.

### Parte 4: Adicionar Visão "Minha Agenda" na Agenda R2

**Arquivo:** `src/pages/crm/AgendaR2.tsx`

Adicionar lógica similar à Agenda R1 para closers R2:

```text
// Adicionar hook para identificar closer R2 do usuário
const { data: myR2Closer } = useMyR2Closer();
const isR2Closer = !!myR2Closer?.id;

// Filtrar reuniões se é closer R2
const filteredMeetings = useMemo(() => {
  let filtered = meetings;
  
  // Se é closer R2, mostrar apenas suas reuniões
  if (isR2Closer && myR2Closer?.id) {
    filtered = filtered.filter(m => m.closer?.id === myR2Closer.id);
  }
  
  // ... resto dos filtros
}, [meetings, isR2Closer, myR2Closer?.id, closerFilter, statusFilter]);
```

### Parte 5: Criar Hook `useMyR2Closer`

**Arquivo:** `src/hooks/useMyR2Closer.ts` (novo arquivo)

```text
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useMyR2Closer() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-r2-closer', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Buscar email do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profile?.email) return null;

      // Buscar closer R2 pelo email
      const { data: closer, error } = await supabase
        .from('closers')
        .select('id, name, email, is_active')
        .ilike('email', profile.email)
        .eq('meeting_type', 'r2')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return closer;
    },
    enabled: !!user?.id,
  });
}
```

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/components/auth/NegociosAccessGuard.tsx` | Modificar `isSdrRole` para aceitar `allRoles` |
| `src/pages/crm/Negocios.tsx` | Passar `allRoles` para `isSdrRole` |
| `src/pages/crm/Agenda.tsx` | Usar `allRoles` para determinar comportamento |
| `src/pages/crm/AgendaR2.tsx` | Adicionar visão "Minha Agenda" para closers R2 |
| `src/hooks/useMyR2Closer.ts` | Criar hook para identificar closer R2 |

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Jessica na Agenda R1 | Vazia (closer R2) | Mostra como SDR (pode agendar) |
| Jessica nos Negócios | Não mostra deals | Mostra 361 deals como owner |
| Jessica na Agenda R2 | Vê todos os closers | Vê apenas suas reuniões R2 |

---

## Observações Técnicas

- A mudança é retrocompatível: usuários com apenas uma role continuarão funcionando normalmente
- A prioridade de roles continua existindo para UI/redirecionamento
- A verificação `allRoles.includes('sdr')` garante que usuários multi-role tenham acesso correto
- O hook `useMyR2Closer` é separado do `useMyCloser` para evitar conflitos de `meeting_type`
