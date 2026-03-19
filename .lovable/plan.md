

## Plano: Restringir ações de SDR nos drawers de R1 e R2

### Regra de negócio
- **SDR**: pode apenas marcar **No-Show** e **Mover** (transferir lead). Todas as outras ações ficam ocultas.
- **Closer/Coordenador/Manager/Admin**: acesso total a todas as ações.

### Alterações

| Arquivo | Ação |
|---------|------|
| `src/components/crm/AgendaMeetingDrawer.tsx` | Criar `const isSdr = role === 'sdr'`. Ocultar botões "Voltar p/ Agendada", "Realizada" e "Vincular Contrato" com `{!isSdr && ...}`. Manter "No-Show" e "Mover" sem restrição. |
| `src/components/crm/R2MeetingDetailDrawer.tsx` | Criar `const isSdr = role === 'sdr'`. Ocultar botões "Realizada", "Reembolso" e "Desfazer Cancelamento" com `{!isSdr && ...}`. Manter "No-show". Ajustar layout do grid quando SDR (1 coluna em vez de 2). |

### Detalhes

**AgendaMeetingDrawer (R1)** — seção de botões (~linhas 966-1055):
- Linha 969 "Voltar p/ Agendada": adicionar `&& !isSdr`
- Linha 1007 "Realizada": adicionar `&& !isSdr`
- Linha 1034 "Mover": **mantém** sem restrição (SDR pode mover)
- Linha 1045 "Vincular Contrato": adicionar `&& !isSdr`
- Linha 988 "No-Show": **mantém** sem restrição

**R2MeetingDetailDrawer (R2)** — footer (~linhas 489-550):
- Linha 492 "Realizada": envolver com `{!isSdr && ...}`
- Linha 500 "No-show": **mantém**
- Linha 510 "Reembolso": envolver com `{!isSdr && ...}`
- Linha 519 "Desfazer Cancelamento": envolver com `{!isSdr && ...}`
- Grid: mudar de `grid-cols-2` para dinâmico `isSdr ? 'grid-cols-1' : 'grid-cols-2'`

Ambos os arquivos já importam `useAuth` e têm `role` disponível.

