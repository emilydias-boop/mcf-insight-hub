

## Tornar bloqueio de leads já agendados/concluídos mais explícito

### Problema atual

Hoje a sinalização de "lead já agendado / concluído / contrato pago" aparece como um **badge pequeno** dentro da linha do resultado da busca, que é cortado horizontalmente (na captura: "Já agendado p/ 22/04 16:00 c/" — closer truncado). Apesar do clique já estar bloqueado e o toast aparecer, visualmente passa despercebido — e o botão "Agendar Reunião" continua presente, dando impressão de que ainda dá pra burlar.

### Mudanças (R1 e R2)

**1. Card de aviso grande, no lugar do bloco "Notas"**

Quando um lead bloqueado é selecionado/destacado na busca (ou quando o usuário insiste em clicá-lo), substituir o textarea de **Notas** por um **card de status destacado**, ocupando o mesmo espaço:

```text
┌─────────────────────────────────────────────────┐
│  📅  LEAD JÁ AGENDADO                           │
│  ─────────────────────────────────────────────  │
│  Cícero José Monteiro Carvalho                  │
│  Reunião 01 (R1) marcada para                   │
│  22/04/2026 às 16:00                            │
│  Closer: Rafael Barros                          │
│                                                 │
│  Para mudar o horário, use a Agenda e           │
│  reagende a reunião existente.                  │
└─────────────────────────────────────────────────┘
```

Variações por estado:
- `scheduled_future` → fundo amarelo, ícone 📅, título "LEAD JÁ AGENDADO"
- `completed` → fundo azul, ícone ✅, título "R1 JÁ REALIZADA" ("Para R2, use a Agenda R2")
- `contract_paid` / `won` → fundo verde, ícone 💰, título "CONTRATO JÁ PAGO" ("Lead concluído")

O bloco de Notas só aparece para leads em estado `open` ou `no_show` (fluxo normal).

**2. Botão de submit vira "Fechar"**

Quando o estado do lead é bloqueado, o botão fixo no rodapé:
- **Texto**: "Fechar" (em vez de "Agendar Reunião")
- **Variante**: `secondary` (cinza, não verde)
- **Ação**: fechar o modal (`onOpenChange(false)`)
- **Disabled**: `false` (sempre clicável)

Assim não há nem caminho visual nem caminho técnico para enviar o agendamento.

**3. Badge na lista de resultados continua, mas mais visível**

- Badge ocupa **linha inteira abaixo** do nome (em vez de inline cortado)
- Texto completo sempre visível (sem `truncate`)
- Linha bloqueada com `opacity-70` e borda colorida lateral (3px) na cor do estado
- Tooltip extra desnecessário — informação já está expandida abaixo

### Estado / fluxo de seleção

Hoje, em `handleSelectDeal`, leads bloqueados disparam `toast.error` e **não são selecionados** (aborta). Vou mudar para:

- **Selecionar mesmo assim** o lead (visualmente, como "card bloqueado" no lugar do form)
- Form de agendamento (closer, data, hora, notas, etc.) **fica oculto**
- Renderiza o **card de aviso grande** + botão "Fechar"
- `handleSubmit` recebe guard extra: se `selectedDeal.leadState` é bloqueado → retorna sem fazer nada (defesa adicional)

Isso dá feedback claro do que aconteceu sem o usuário se perder ("cliquei e não aconteceu nada").

### Arquivos afetados

- `src/components/crm/QuickScheduleModal.tsx`
  - `handleSelectDeal`: remover early-return; setar `selectedDeal` mesmo se bloqueado
  - Renderizar `<BlockedLeadCard />` no lugar do bloco Notas + ocultar campos de form (closer, data, hora, já constrói, etc.) quando `selectedDeal.leadState` é bloqueado
  - Botão de rodapé: trocar texto/variant/onClick conforme estado
- `src/components/crm/R2QuickScheduleModal.tsx`
  - Mesmas mudanças adaptadas ao R2 (textos: "R2 JÁ AGENDADA", "Para mudar horário, use a Agenda R2")
- Sem mudança em hooks, edge function ou banco — toda a informação (`leadState`, `scheduledInfo`, `blockReason`) já está disponível.

### Validação pós-fix

1. Buscar **Cícero José Monteiro Carvalho** (já agendado p/ 22/04 16:00) → clicar → form some, card amarelo grande aparece com data/horário/closer completos, botão rodapé vira "Fechar".
2. Buscar lead com R1 realizada → card azul "R1 JÁ REALIZADA".
3. Buscar lead com contrato pago → card verde "CONTRATO JÁ PAGO".
4. Buscar lead novo → fluxo normal mantido (form completo, botão "Agendar Reunião").
5. Testar mesmo comportamento no R2QuickScheduleModal.

