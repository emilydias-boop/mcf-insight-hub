

# Plano: Correção do Modal de Agendamento R1 do Consórcio

## Problemas Identificados

O modal "Agendar Reunião" no CRM do Consórcio está exibindo informações incorretas em três áreas:

| Problema | O que aparece | O que deveria aparecer |
|----------|---------------|------------------------|
| SDRs | Juliana Rodrigues, Julia Caroline, etc (Incorporador) | Cleiton, Ithaline, Ygor (Consórcio) |
| "Já constrói?" | Campo específico de construção civil | "Conhece consórcio?" |
| Leads da Semana | No-shows de todos os closers | Apenas no-shows dos closers do Consórcio |

---

## Análise Técnica

### 1. Lista de SDRs (SDR_LIST)

**Problema**: O modal usa uma constante hardcoded `SDR_LIST` do arquivo `src/constants/team.ts` que contém apenas SDRs do Incorporador.

**Solução**: Criar um hook `useSdrsByBU` que busca SDRs da tabela `sdr` filtrando por `squad` (a BU).

**Dados confirmados no banco:**
- Cleiton Lima: squad = consorcio ✓
- Ithaline e Ygor: Existem em `profiles` com squad = consorcio, mas NÃO estão na tabela `sdr`

**Pré-requisito**: Os SDRs Ithaline Clara e Ygor Ferreira precisam ser cadastrados na tabela `sdr` com `squad = 'consorcio'` via interface de configuração do fechamento.

### 2. Campo "Já constrói?"

**Problema**: O campo `already_builds` (boolean) é específico para o contexto de construção civil do Incorporador.

**Solução**: Reutilizar o mesmo campo `already_builds`, mas mudar o label dinamicamente baseado na BU:
- **Incorporador**: "Já constrói?" com opções "Sim, já constrói" / "Não constrói"
- **Consórcio**: "Conhece consórcio?" com opções "Sim, já conhece" / "Não conhece"

### 3. Leads da Semana (No-Shows)

**Problema**: O hook `useSearchWeeklyMeetingLeads` busca todos os attendees com status `no_show` da semana, sem filtrar por BU.

**Solução**: Adicionar filtro por `closer.bu` no hook, usando os IDs dos closers da BU ativa.

---

## Alterações Necessárias

### Arquivo 1: `src/hooks/useSdrFechamento.ts`
**Novo hook**: Adicionar `useSdrsByBU(bu: string)` para buscar SDRs filtrados por squad

```typescript
export const useSdrsByBU = (bu: string | null) => {
  return useQuery({
    queryKey: ['sdrs-by-bu', bu],
    queryFn: async () => {
      if (!bu) return [];
      const { data, error } = await supabase
        .from('sdr')
        .select('*')
        .eq('active', true)
        .eq('squad', bu)
        .order('name');
      if (error) throw error;
      return data as Sdr[];
    },
    enabled: !!bu,
  });
};
```

### Arquivo 2: `src/hooks/useAgendaData.ts`
**Modificar**: Atualizar `useSearchWeeklyMeetingLeads` para aceitar `closerIds` como parâmetro

```typescript
export function useSearchWeeklyMeetingLeads(
  statusFilter?: string,
  closerIds?: string[]  // Novo parâmetro
) {
  // ... busca existente ...
  // Adicionar filtro: .in('meeting_slots.closer_id', closerIds)
}
```

### Arquivo 3: `src/components/crm/QuickScheduleModal.tsx`
**Modificações**:

1. **Importar** o novo hook `useSdrsByBU` e usar ao invés de `SDR_LIST`
2. **Passar closerIds** para `useSearchWeeklyMeetingLeads` 
3. **Renderização condicional do campo "Já constrói?"**:
   - Se BU = 'consorcio': mostrar "Conhece consórcio?"
   - Senão: mostrar "Já constrói?"

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────┐
│  QuickScheduleModal (Consórcio)                                     │
│  ↓                                                                  │
│  useActiveBU() → "consorcio"                                        │
│  ↓                                                                  │
│  useSdrsByBU("consorcio") → [Cleiton, Ithaline, Ygor]              │
│  ↓                                                                  │
│  useSearchWeeklyMeetingLeads("no_show", consorcioCloserIds)        │
│    → Apenas no-shows de João Pedro e Victoria Paz                   │
│  ↓                                                                  │
│  Campo dinâmico: "Conhece consórcio?" (ao invés de "Já constrói?") │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Pré-Requisito (Ação do Usuário)

Para que a lista de SDRs do Consórcio funcione corretamente, os seguintes SDRs precisam ser cadastrados na tabela `sdr` via a interface de configuração:

| SDR | Email | Squad |
|-----|-------|-------|
| Ithaline Clara | ithaline.clara@minhacasafinanciada.com | consorcio |
| Ygor Ferreira | ygor.ferreira@minhacasafinanciada.com | consorcio |

Acesso: `/consorcio/fechamento/configuracoes` → Aba "Equipe SDR"

---

## Resumo das Mudanças

1. **Novo hook** `useSdrsByBU` em `useSdrFechamento.ts`
2. **Modificação** de `useSearchWeeklyMeetingLeads` para filtrar por closerIds
3. **Modificação** de `QuickScheduleModal.tsx` para:
   - Usar SDRs dinâmicos por BU
   - Passar closerIds para filtrar no-shows
   - Alterar label do campo de qualificação baseado na BU

