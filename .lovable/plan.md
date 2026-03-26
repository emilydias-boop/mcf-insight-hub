

## Fase 1: Layout com abas + Quick Actions no Meu RH

### Visão geral

Transformar a tela de ficha linear em um portal com abas, mantendo todo o conteúdo existente reorganizado.

### Layout proposto

```text
┌─────────────────────────────────────────────────────────┐
│ [Avatar] Nome · Status Badge · Cargo                    │
│ PJ · Entrada: 04/05/2025 · Gestor: Fulano              │
├─────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌──────────┐ ┌───────────┐ ┌────────────┐  │
│ │ Status  │ │ Vínculo  │ │ Jornada   │ │ Local      │  │
│ │ Ativo   │ │ PJ       │ │ 44h sem.  │ │ Remoto     │  │
│ └─────────┘ └──────────┘ └───────────┘ └────────────┘  │
├─────────────────────────────────────────────────────────┤
│ [Enviar NFSe] [Abrir Solicitação] [Ver Docs] [Ver PDI] │
├─────────────────────────────────────────────────────────┤
│ [Meu Perfil] [Documentos] [Políticas] [Fale c/ RH]     │
│              [Avaliações] [PDI] [Comunicados]           │
├─────────────────────────────────────────────────────────┤
│ Conteúdo da aba ativa                                   │
└─────────────────────────────────────────────────────────┘
```

### Mudanças

**Arquivo 1: `src/pages/MeuRH.tsx`** — Reestruturar completamente:
- Manter header existente (`MeuRHHeader`)
- Substituir `MeuRHVinculoSection` por **4 cards compactos** inline (status, vínculo, jornada, local)
- Adicionar **barra de ações rápidas** com 4 botões (Enviar NFSe, Abrir Solicitação, Ver Documentos, Ver PDI) — botões que abrem modais ou trocam de aba
- Adicionar **`Tabs`** com as seguintes abas:
  - **Meu Perfil** — conteúdo atual: `MeuRHDadosPessoaisSection`, `MeuRHRemuneracaoSection`, `MeuRHNfseSection`
  - **Documentos** — conteúdo atual: `MeuRHDocumentosSection`
  - **Políticas MCF** — placeholder com mensagem "Em breve"
  - **Fale com o RH** — placeholder com mensagem "Em breve"
  - **Avaliações** — conteúdo atual: `MeuRHAvaliacoesSection`
  - **PDI** — placeholder com mensagem "Em breve"
  - **Comunicados** — placeholder com mensagem "Em breve"
  - **Histórico** — conteúdo atual: `MeuRHHistoricoSection`

**Arquivo 2: `src/components/meu-rh/MeuRHQuickActions.tsx`** — Novo componente:
- 4 botões com ícones: "Enviar NFSe" (só PJ), "Abrir Solicitação", "Ver Documentos", "Ver PDI"
- Cada botão dispara callback para trocar aba ou abrir modal

**Arquivo 3: `src/components/meu-rh/MeuRHQuickCards.tsx`** — Novo componente:
- Grid de 4 mini-cards substituindo `MeuRHVinculoSection`
- Cards: Status (com badge colorido), Tipo de contrato, Jornada, Local de atuação
- Adicionar indicador de pendências (ex: NFSe pendente em vermelho)

**Arquivo 4: `src/components/meu-rh/MeuRHVinculoSection.tsx`** — Remover (substituído por QuickCards)

### O que NÃO muda
- `MeuRHHeader`, `MeuRHDadosPessoaisSection`, `MeuRHRemuneracaoSection`, `MeuRHNfseSection`, `MeuRHDocumentosSection`, `MeuRHAvaliacoesSection`, `MeuRHHistoricoSection` — todos mantidos como estão, apenas reorganizados dentro das abas
- Nenhuma mudança no banco de dados nesta fase
- Abas "Políticas", "Fale com RH", "PDI" e "Comunicados" ficam como placeholder para Fase 2

