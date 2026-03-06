

## Plano: Menu de 3 pontos + opção "Reconhecer Parceiro" no painel Pendentes R2

### Resumo
Substituir os dois botões (Reembolso, Agendar R2) por um menu dropdown de 3 pontos (`MoreVertical`) com 3 opções:
1. **Agendar R2** (ícone Calendar, roxo)
2. **Reembolso** (ícone RotateCcw, laranja)
3. **Reconhecer Parceiro** (ícone UserCheck, azul) — novo

### Alterações

**`src/components/crm/R2PendingLeadsPanel.tsx`**

1. **Imports**: Adicionar `MoreVertical`, `UserCheck` do lucide-react; importar `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` de `@/components/ui/dropdown-menu`

2. **Novo estado e handler**: Adicionar estado `partnerLead` e `partnerDialogOpen`. Criar `handleRecognizePartner` que:
   - Insere registro em `partner_returns` com dados do lead (contact_id, email, nome, produto "Reconhecido manualmente")
   - Atualiza o `meeting_slot_attendees.is_partner = true` e `status = 'partner_recognized'`
   - Move o deal para estágio "Perdido" (se houver deal)
   - Invalida caches (`r2-pending-leads`, `partner-returns`)
   - Toast de sucesso

3. **Substituir botões por menu**: No lugar da div com 2 botões, renderizar:
   ```
   <DropdownMenu>
     <DropdownMenuTrigger asChild>
       <Button size="icon" variant="ghost">
         <MoreVertical />
       </Button>
     </DropdownMenuTrigger>
     <DropdownMenuContent>
       <DropdownMenuItem> Agendar R2 </DropdownMenuItem>
       <DropdownMenuItem> Reembolso </DropdownMenuItem>
       <DropdownMenuItem> Reconhecer Parceiro </DropdownMenuItem>
     </DropdownMenuContent>
   </DropdownMenu>
   ```

4. **Confirmação**: Adicionar um `AlertDialog` para confirmar "Reconhecer Parceiro" antes de executar, pois é uma ação destrutiva (remove o lead da lista).

**`src/hooks/useRecognizePartner.ts`** (novo)

Hook de mutação que:
- Insere em `partner_returns` (contact_id, contact_email, contact_name, partner_product: "Reconhecido manualmente - Pendentes R2", return_source: "manual_recognition", blocked: true)
- Atualiza `meeting_slot_attendees` com `is_partner = true`
- Move deal para estágio Perdido se existir
- Registra atividade em `deal_activities`
- Invalida queries relevantes

