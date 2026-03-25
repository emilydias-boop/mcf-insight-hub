

## Resultado da varredura — últimos itens encontrados

Após verificar todos os 200+ hooks e 90+ edge functions, o sistema está **quase totalmente limpo**. Encontrei apenas **3 edge functions órfãs** restantes:

### Edge Functions sem nenhum consumidor (nem frontend, nem outras functions)

| Função | Linhas | Situação |
|--------|--------|----------|
| `supabase/functions/detect-duplicate-activities/` | ~190 | Script manual de detecção de atividades duplicadas. Zero referências no frontend ou em outras edge functions |
| `supabase/functions/repair-activity-owners/` | ~170 | Script manual para corrigir owners de atividades. Zero referências no frontend ou em outras edge functions |
| `supabase/functions/reprocess-missing-activities/` | ~150 | Script manual para reprocessar atividades faltantes. Zero referências no frontend ou em outras edge functions |

Todos são scripts utilitários de manutenção pontual (tipo backfill), sem nenhuma chamada automatizada ou via UI.

### Ações

1. Deletar as 3 pastas de edge functions
2. Remover as 3 entradas correspondentes do `supabase/config.toml`

### Conclusão

Fora esses 3 itens, **o sistema está 100% limpo**. Todos os hooks, componentes, páginas e demais edge functions têm consumidores ativos e estão conectados.

