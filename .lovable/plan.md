

## Tornar o agendamento do closer R2 em "Apoio R1" explícito e acessível

### Diagnóstico

A infra de agendamento **já está pronta** (verificado em código):

- `Agenda.tsx` linha 561: `<QuickScheduleModal ... searchAllOwnersInBU={isR1SupportActive} />` → quando o closer R2 tem apoio ativo, o botão "Agendar" no header da Agenda R1 abre o modal em modo SDR e busca leads de qualquer SDR da BU.
- `Agenda.tsx` linha 47: `isCloser = isCloserOnly && !isR1SupportActive` → no dia de apoio, ele deixa de cair na visão restrita "Minha Agenda" e vê grade completa + busca + Agendar.
- `Negocios.tsx` linha 113 e `CRM.tsx`/`BUCRMLayout.tsx` → também liberam pipeline e navegação.

**O que falta é UX/descoberta**: quem libera (admin) e quem é liberado (closer R2) não veem em lugar nenhum *que isso destrava o fluxo de agendar*. A tela `R1SupportDaysConfig` parece servir só para "marcar dias" sem evidenciar o efeito.

### Mudanças propostas

**1. `R1SupportDaysConfig.tsx` — bloco explicativo + atalho de agendamento**

Adicionar no topo do painel direito (acima do header da data) um `Alert` informativo:

> **O que o apoio R1 habilita?**  
> Nos dias liberados, **{closer.name}** poderá:  
> • Acessar a Agenda R1 com grade completa  
> • Buscar leads de qualquer SDR da BU  
> • Agendar reuniões R1 (para si ou para outros closers R1)  
> • Acessar pipeline de Negócios da BU

Logo abaixo da lista "Datas liberadas", adicionar botão **"Abrir Agenda R1 para agendar agora"** (ícone `CalendarPlus`). Visível apenas quando há ao menos 1 data liberada. Ao clicar:
- Fecha o Dialog atual.
- Navega para `/crm/agenda?openSchedule=1&closerId={closer.id}` (Admin/Coordenador podem agendar em nome do closer pré-selecionando a coluna dele).

**2. `Agenda.tsx` — auto-abrir modal e pré-selecionar via querystring**

Adicionar `useSearchParams` e `useEffect`:
```ts
useEffect(() => {
  const openSchedule = searchParams.get('openSchedule');
  const closerIdParam = searchParams.get('closerId');
  if (openSchedule === '1') {
    if (closerIdParam) setPreselectedCloserId(closerIdParam);
    setQuickScheduleOpen(true);
    // limpar params após consumir
    setSearchParams({}, { replace: true });
  }
}, [searchParams]);
```

Isso permite o admin abrir o agendamento diretamente do modal de configuração, já com o closer R2-em-apoio selecionado.

**3. `Agenda.tsx` — Banner "Modo Apoio R1 ativo" para o próprio closer R2**

Quando `isR1SupportActive === true` E `isCloserOnly === true` (closer R2 logado em modo apoio), exibir banner sticky abaixo do header:

```
🛟 Modo Apoio R1 ativo — você pode buscar leads e agendar R1 hoje.
   Próxima liberação: 25/04 (dia inteiro) · 26/04 (14:00–18:00)
   [Buscar lead e agendar →]   ← botão que abre QuickScheduleModal
```

Lista as próximas 3 datas (vindo de `useIsR1SupportActive().supportDays`). Botão = atalho redundante para deixar a ação óbvia.

**4. `R1SupportDaysConfig.tsx` — destaque do botão "Liberar apoio"**

Renomear o CTA principal para **"Liberar dia de apoio R1"** e adicionar tooltip: "O closer poderá agendar e atender reuniões R1 nesta data".

Após sucesso, exibir um pequeno toast secundário: "{closer.name} agora pode agendar R1 em {data}".

### Arquivos afetados

- `src/components/crm/R1SupportDaysConfig.tsx` — Alert explicativo + botão "Abrir Agenda R1 para agendar agora" + textos.
- `src/pages/crm/Agenda.tsx` — leitura de `?openSchedule=1&closerId=` + banner de "Modo Apoio R1 ativo" para closer R2 logado.

Nenhuma alteração de hook, banco ou edge function — apenas UX.

### Validação pós-implementação

1. Admin abre `/crm/configurar-closers` → menu `...` da Jessica R2 → "Apoio R1" → vê o Alert explicando o que o recurso destrava.
2. Libera dia 25/04 → clica em "Abrir Agenda R1 para agendar agora" → vai para `/crm/agenda`, modal de agendamento abre automaticamente já com a Jessica selecionada como closer.
3. Jessica (closer R2) loga → entra em `/crm/agenda` → vê banner verde "Modo Apoio R1 ativo" listando as próximas datas + botão "Buscar lead e agendar".
4. Jessica clica no botão → `QuickScheduleModal` abre, busca lead "João Silva" (atribuído a outro SDR) → encontra normalmente → escolhe horário → reunião criada com `booked_by = Jessica`, `closer_id = Jessica` (ou outro R1 que ela escolher).
5. Em dia sem apoio liberado, Jessica volta à visão "Minha Agenda" restrita; banner desaparece.

