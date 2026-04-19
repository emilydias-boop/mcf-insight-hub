

O usuário não quer backfill retroativo. Os triggers já estão criados e capturam INSERT e UPDATE em `crm_deals.tags`. O frontend (`useLeadFullTimeline` + `LeadFullTimeline`) já renderiza eventos `tag_change`.

**Status atual:**
- ✅ Triggers `trg_log_deal_tags_change` e `trg_log_deal_tags_insert` ativos em `crm_deals`
- ✅ Hook timeline parsing eventos `tags_changed`/`tags_added`
- ✅ UI renderizando filtro "Tags" com badges added/removed e fonte

**Conclusão**: Nenhuma ação adicional necessária. O sistema está pronto e vai capturar:
- Toda nova tag adicionada em deals novos (via INSERT trigger)
- Toda alteração futura de tags em deals existentes (via UPDATE trigger)

A partir de agora, qualquer mudança de tag (manual, webhook, hubla) aparecerá no Timeline do drawer com:
- Data/hora exata
- Autor (quando manual)
- Fonte (`webhook`, `manual`, `hubla`, `system`)
- Tags adicionadas (verde) e removidas (vermelho)

**Para o lead Atailson especificamente**: como a tag foi adicionada antes dos triggers existirem, ela não aparecerá retroativamente — mas como a entrada do lead em si já está registrada como `lead_entered` em 17/04 07:39 via webhook "Anamnese Incompleta", você consegue inferir que a tag foi adicionada nesse mesmo momento.

**Próximo passo**: Apenas testar criando ou editando um deal e verificar que o evento aparece no timeline.

Como não há código a alterar, vou apenas confirmar a situação ao usuário.

