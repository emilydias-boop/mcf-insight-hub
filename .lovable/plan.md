

# Permitir closers R1 acessarem a Agenda R2 para agendamento

## Problema

Closers de R1 (role `closer`, mas que NÃO estão cadastrados como closers R2) são bloqueados pelo `R2AccessGuard` ao tentar acessar `/crm/agenda-r2`. Quando marcam R1 como "Realizada", o sistema sugere "Agendar R2 Agora" e navega para a Agenda R2, mas o guard bloqueia o acesso mostrando "Acesso Negado".

O guard atual permite acesso apenas para:
- admin, manager, coordenador (por role)
- Closers que estão na tabela `closers` com `meeting_type = 'r2'`
- Usuários com permissão individual em `user_permissions`

Closers R1 não se encaixam em nenhum desses critérios.

## Solução

Permitir que **qualquer closer** acesse a Agenda R2, não apenas closers R2. A página já tem filtros e restrições visuais adequadas.

| Arquivo | Alteração |
|---|---|
| `src/components/auth/R2AccessGuard.tsx` | Alterar `hasCloserAccess` para incluir qualquer closer, não apenas R2 closers |

### Detalhe

```typescript
// Antes:
const isR2Closer = !!myR2Closer?.id;
const hasCloserAccess = (role === 'closer' || allRoles?.includes('closer')) && isR2Closer;

// Depois:
const hasCloserAccess = role === 'closer' || allRoles?.includes('closer');
```

Com isso, qualquer closer (R1 ou R2) pode acessar a página. O botão "Agendar R2" já aparece para não-R2-closers (`!isR2Closer`), e a busca de leads funciona sem restrição de role. A experiência do closer R2 (ver apenas sua agenda) permanece inalterada pois é controlada por `isR2Closer` dentro de `AgendaR2.tsx`.

Também remover a dependência de `useMyR2Closer` no loading do guard para closers genéricos, evitando delay desnecessário.

