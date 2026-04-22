

## Tela de configuração "Apoio R1" para closers R2

### Objetivo

Criar UI dentro de `/crm/configurar-closers-r2` para Admin/Manager/Coordenador liberarem dias específicos em que um closer R2 pode atender R1 (CRUD completo sobre `closer_r1_support_days`), com calendário visual, validações e janelas de horário opcionais.

### Componentes novos

**1. `src/hooks/useR1SupportDays.ts`** — CRUD com React Query (espelha `useR2DailySlots`):
- `useR1SupportDaysForCloser(closerId)` → lista todas as entradas do closer (ordem por data).
- `useR1SupportDaysWithSlots(closerId, month)` → array de `Date` para destacar no calendário.
- `useCreateR1SupportDay()` → insert `{ closer_id, support_date, start_time?, end_time?, notes?, created_by: auth.uid() }`.
- `useUpdateR1SupportDay()` → update parcial (notas, janela de horário).
- `useDeleteR1SupportDay()`.
- Toasts de sucesso/erro via `sonner`. Invalida queries `r1-support-days` + `r1-support-active` (para o gating de UI atualizar).

**2. `src/components/crm/R1SupportDaysConfig.tsx`** — modal/painel reutilizável:

Layout 2 colunas (igual `R2DailySlotConfig`):
- **Esquerda**: `Calendar` em pt-BR; dias liberados marcados com a cor do closer (modifiers); `disabled={d => d < hoje}` (não permite liberar passado).
- **Direita**: ao selecionar um dia
  - Header: data formatada + badge do dia da semana.
  - Toggle **"Dia inteiro"** (default ON) ↔ **"Janela específica"** (mostra dois `Input type="time" step={900}`).
  - Input "Observação (opcional)" — ex.: "Cobrindo falta do João".
  - Botão **"Liberar apoio"** (cria entrada).
  - Lista de **datas já liberadas** (ScrollArea), cada item com data, badge "Dia inteiro" ou janela `HH:MM–HH:MM`, observação, botão remover.

**Validações**:
- Bloquear datas no passado (calendário disabled).
- Se "Janela específica": exigir `start_time < end_time`, ambos em intervalos de 15 min, dentro de 06:00–22:00.
- UNIQUE `(closer_id, support_date)` já existe no DB → tratar erro de duplicidade com toast amigável ("Esta data já está liberada para este closer").
- Botão "Liberar" desabilitado enquanto `mutation.isPending`.

### Integração com `ConfigurarClosersR2.tsx`

Adicionar **um botão "Apoio R1"** na linha de cada closer ativo na tabela (ao lado de Editar/Remover, ícone `LifeBuoy` ou `HandHelping`). Ao clicar, abre um `Dialog` controlado contendo `<R1SupportDaysConfig closer={closer} />`.

Estado novo na página:
```ts
const [supportConfigOpen, setSupportConfigOpen] = useState(false);
const [supportCloser, setSupportCloser] = useState<R2Closer | null>(null);
```

Header do Dialog: "Apoio R1 — {closer.name}" + descrição curta explicando que o closer poderá atender e agendar R1 nos dias liberados.

### Permissões

A rota `/crm/configurar-closers-r2` já é protegida por `RoleGuard allowedRoles={['admin','manager','coordenador']}` (visto em `App.tsx` linha 261). As RLS policies da tabela já filtram coordenador por squad — se o INSERT falhar por RLS, o toast mostra "Sem permissão para liberar apoio para este closer".

### Arquivos afetados

- **Novos**:
  - `src/hooks/useR1SupportDays.ts`
  - `src/components/crm/R1SupportDaysConfig.tsx`
- **Editado**:
  - `src/pages/crm/ConfigurarClosersR2.tsx` — botão "Apoio R1" por linha + Dialog.

### Validação pós-implementação

1. Admin abre `/crm/configurar-closers-r2` → clica "Apoio R1" no Rafael → modal abre com calendário.
2. Seleciona dia 25/04, mantém "Dia inteiro" → "Liberar apoio" → entrada aparece na lista, dia 25 fica destacado no calendário.
3. Tenta liberar 25/04 de novo → toast "Esta data já está liberada".
4. Seleciona 26/04, ativa "Janela específica" 14:00–18:00 → salva → lista mostra "26/04 · 14:00–18:00".
5. Tenta janela 18:00–14:00 → toast de validação.
6. Remove entrada do 25/04 → some da lista e do calendário.
7. Rafael loga → `useIsR1SupportActive` retorna `isActive: true` (já implementado) e a Agenda R1 libera o fluxo SDR conforme plano anterior.
8. Coordenador tenta liberar para closer fora do squad → INSERT bloqueado por RLS, toast amigável.

