

## Melhorar tabela e export de Contratos

### Mudanças

O hook `useContractReport` já retorna `meetingDate` (data da R1), `contractPaidAt`, `sdrName`, `salesChannel`, `contactEmail`, `leadPhone`, `currentStage`, `isRefunded`. Falta buscar `created_at` do deal (data de entrada no sistema).

### 1. `src/hooks/useContractReport.ts`

- Adicionar `created_at` no select de `crm_deals` (linha ~115-138)
- Adicionar `dealCreatedAt: string` na interface `ContractReportRow`
- Mapear `dealCreatedAt: deal?.created_at || ''` na transformação

### 2. `src/components/relatorios/ContractReportPanel.tsx`

**Interface `UnifiedContractRow`** — adicionar campos:
- `meetingDate: string` (data da R1)
- `contractPaidAt: string` (data do contrato)  
- `dealCreatedAt: string` (data de entrada no sistema)
- `contactEmail: string` (email, já existe como `leadEmail`)

**Tabela** — reorganizar colunas para:
1. Fonte (badge)
2. Data Entrada (created_at do deal, formatado dd/MM/yyyy)
3. SDR
4. Data R1 (meetingDate, formatado dd/MM/yyyy)
5. Lead (nome)
6. Telefone
7. Email
8. Canal (badge A010/BIO/LIVE)
9. Estágio (badge)
10. Contrato (contractPaidAt formatado dd/MM/yyyy, ou "—")
11. Valor (netValue formatado R$)
12. Reembolso (badge Sim/Não)
13. Closer

**Excel export** — atualizar para incluir as mesmas colunas na mesma ordem, com nomes claros em português.

### Arquivos alterados
- `src/hooks/useContractReport.ts` (adicionar `created_at` no select + interface)
- `src/components/relatorios/ContractReportPanel.tsx` (tabela + export)

