
# Correção: Premiações não aparecem na listagem

## Problema Identificado

As 2 premiações criadas estão no banco de dados:

| Nome | Status | Período | Problema |
|------|--------|---------|----------|
| Carro!! | rascunho | 01/01 - 31/01/2026 | Data já passou (hoje é 01/02/2026) |
| Carro!! | rascunho | 01/01 - 31/01/2026 | Data já passou (hoje é 01/02/2026) |

A lógica de categorização atual não inclui **rascunhos cujo período já terminou**:

```text
┌─────────────────────────────────────────────────────────────┐
│                    LÓGICA ATUAL                             │
├─────────────────┬───────────────────────────────────────────┤
│ Ativas          │ status='ativa' AND dentro do período     │
│ Próximas        │ (ativa OR rascunho) AND data futura      │
│ Encerradas      │ status='encerrada' OR (ativa + expirada) │
└─────────────────┴───────────────────────────────────────────┘
         ⚠️ Rascunhos com data passada ficam ÓRFÃOS
```

---

## Solução Proposta

Adicionar uma nova aba **"Rascunhos"** para mostrar todas as premiações em rascunho, independente da data. Alternativamente, corrigir a lógica para incluir rascunhos expirados em uma categoria visível.

### Opção Escolhida: Adicionar aba "Rascunhos"

Isso dará visibilidade clara a todas as premiações não publicadas.

---

## Alterações no Index.tsx

### 1. Adicionar categoria `rascunhos` na função `categorizePremiacoes`

```typescript
return {
  ativas: items.filter(p => 
    p.status === 'ativa' && 
    isWithinInterval(now, { start: parseISO(p.data_inicio), end: parseISO(p.data_fim) })
  ),
  proximas: items.filter(p => 
    p.status === 'ativa' && isFuture(parseISO(p.data_inicio))
  ),
  rascunhos: items.filter(p => 
    p.status === 'rascunho'
  ),
  encerradas: items.filter(p => 
    p.status === 'encerrada' || 
    (p.status === 'ativa' && isPast(parseISO(p.data_fim)))
  ),
};
```

### 2. Adicionar nova aba no JSX

```typescript
<TabsTrigger value="rascunhos" className="gap-2">
  Rascunhos
  {categorized.rascunhos.length > 0 && (
    <Badge variant="secondary">{categorized.rascunhos.length}</Badge>
  )}
</TabsTrigger>

<TabsContent value="rascunhos">
  {categorized.rascunhos.length === 0 ? (
    <EmptyState message="Nenhum rascunho" />
  ) : (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {categorized.rascunhos.map(premiacao => (
        <PremiacaoCard key={premiacao.id} premiacao={premiacao} />
      ))}
    </div>
  )}
</TabsContent>
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/premiacoes/Index.tsx` | Adicionar categoria "rascunhos" e nova aba no TabsList |

---

## Resultado Esperado

Após a correção:

```text
┌─────────────────────────────────────────────────────────────┐
│  Em Andamento  │  Próximas  │  Rascunhos (2)  │  Encerradas │
└─────────────────────────────────────────────────────────────┘
                              ↑
                    Suas 2 premiações aparecerão aqui
```

---

## Fluxo Corrigido

```text
Premiação criada → Status: rascunho → Aparece em "Rascunhos"
                          ↓
                   Ativar premiação
                          ↓
                   Status: ativa → Aparece em "Em Andamento" ou "Próximas"
                          ↓
                   Período termina
                          ↓
                   Aparece em "Encerradas"
```
