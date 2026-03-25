

## Expandir Drawer do Controle Diego com Perfil do Lead e Notas

### Problema
O drawer atual mostra apenas dados do contrato, jornada e compras. Faltam: o **perfil do lead** (dados de anamnese como renda, profissão, estado civil, etc.) e as **notas** (do SDR, closer, qualificação).

### Alterações

#### 1. `src/hooks/useContractReport.ts`
- Adicionar `contactId: string | null` ao `ContractReportRow`
- No mapeamento, incluir `contactId: deal?.contact_id || null`

#### 2. `src/components/relatorios/ControleDiegoPanel.tsx`
- Adicionar `contactId` ao `KanbanRow`
- Mapear `contactId: row.contactId` na transformação dos dados
- Passar `contactId` ao drawer

#### 3. `src/components/relatorios/ControleDiegoDrawer.tsx`
Expandir significativamente:

- **Largura**: de `w-[480px]` para `w-[620px]`
- **Adicionar `contactId` nas props** (vindo do `KanbanRow`)
- **Nova seção: Perfil do Lead** — usar `useLeadProfile(contactId)` e reutilizar a mesma lógica do `LeadProfileSection` para exibir dados preenchidos organizados por categoria (Dados Pessoais, Financeiro, Patrimônio, Interesses)
- **Nova seção: Notas do Lead** — usar `useLeadNotes(dealId, attendeeId)` para exibir todas as notas (SDR, closer, qualificação, agendamento, ligação) com tipo, autor e data
- Reorganizar seções na ordem: Dados do Contrato → Contato/WhatsApp → Controle de Vídeo → Perfil do Lead → Notas → Jornada do Lead → Jornada A010 → Histórico de Compras

### Arquivos modificados
- `src/hooks/useContractReport.ts` — adicionar `contactId`
- `src/components/relatorios/ControleDiegoPanel.tsx` — passar `contactId`
- `src/components/relatorios/ControleDiegoDrawer.tsx` — expandir com perfil e notas

