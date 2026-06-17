# Documentação QA — Export PDF, Transcrição IA e Hardening de RLS

## Metadados
- **Data:** 2026-06-17
- **Solicitante:** thobson.motta@minhacasafinanciada.com
- **Módulos:** Admin / Documentação QA, CRM (Ligações), Segurança (RLS)
- **Status:** Entregue (export PDF + transcrição IA); RLS pendente de aprovação
- **Audiência desta doc:** Owner do projeto e todos os usuários com acesso de edição

## Contexto e objetivo
Resguardar em um único ponto (`/admin/documentacao-qa`) a documentação técnica, de qualidade/testes e de regressão de todas as alterações e novos recursos entregues recentemente, de modo que qualquer editor/owner do app consiga auditar, validar e reverter mudanças com segurança.

## Escopo
### In
1. Exportação de PDF da página `/admin/documentacao-qa`.
2. Pipeline automático de transcrição Twilio + resumo IA (Gemini 3 Flash) para chamadas ≥ 60s.
3. Proposta de hardening de RLS (rejeitada — registrada para futura aprovação parcial).

### Out
- Geração de PDF em lote (todos os docs juntos) — pode entrar em iteração futura.
- Backfill de transcrições para ligações antigas.

## Arquivos, rotas e tabelas afetadas

### 1. Export PDF do visualizador QA
- **Rota:** `/admin/documentacao-qa`
- **Arquivo:** `src/pages/admin/QaDocsViewer.tsx`
- **Mecanismo:** Botão "Exportar PDF" abre nova janela com HTML formatado A4 (margens 18mm, tipografia print-friendly) e dispara `window.print()`. Sem dependências novas.

### 2. Transcrição automática + resumo IA
- **Edge functions:**
  - `supabase/functions/twilio-voice-webhook/index.ts` — dispara transcrição via `TWILIO_VOICE_INTELLIGENCE_SERVICE_SID` quando `RecordingDuration >= 60`, usando `call.id` como `CustomerKey`.
  - `supabase/functions/twilio-transcript-callback/index.ts` — recebe `transcript.completed`, busca sentenças na Twilio Intelligence API, chama Lovable AI Gateway (Gemini 3 Flash) com prompt de discovery (renda, profissão, imóvel próprio, etc.), persiste resultados.
- **Persistência (4 destinos):**
  - `calls.ai_summary`
  - `crm_deals.custom_fields.callSummaries` (histórico)
  - `attendee_notes` (`type = 'call_summary'`) para reuniões R1/R2
  - `deal_activities` (`type = 'ai_call_summary'`)
- **UI:** `src/components/crm/DealNotesTab.tsx` renderiza atividade `ai_call_summary` com ícone `Sparkles` e bullets + próximos passos.
- **Config Twilio (manual):**
  - Voice Intelligence > Service: webhook `https://rehcfgqvigfcekiipqkc.supabase.co/functions/v1/twilio-transcript-callback`, evento `transcript.completed` habilitado.
  - Idioma `pt-BR`.

### 3. Hardening de RLS (proposto, não aplicado)
Migration foi rejeitada. Tabelas que precisariam ser revistas (anon/service_role amplos):
`alertas`, `automation_blacklist`, `automation_queue`, `daily_costs`, `deal_stages`, `employees`, `lead_profiles`, `profiles`, `r2_status_options`, `r2_thermometer_options`, `r2_vendas_extras`, `sdr_payout_audit_log`, `user_notifications`, `webhook_events`, `whatsapp_instances`.
Pontos sensíveis: leitura anônima em `profiles` (TV dashboard), inserts "system" usados por jobs com anon key, e leitura aberta de `deal_stages` consumida por componentes públicos.

## Critérios de aceite

### Export PDF
- [x] Botão "Exportar PDF" visível ao selecionar qualquer documento.
- [x] Janela de impressão abre com layout A4 legível.
- [x] Cabeçalho com data e título do documento.
- [x] Tabelas, listas, blocos de código e blockquotes renderizam corretamente.
- [x] Salvar como PDF nativo do navegador gera arquivo coerente com a tela.

### Transcrição IA
- [x] Chamada ≥ 60s dispara transcrição automaticamente.
- [x] Resumo aparece em até alguns minutos no tab "Notas" do lead.
- [x] Atividade `ai_call_summary` listada com ícone Sparkles.
- [x] `calls.ai_summary` populado.

## Roadmap de testes

### Funcionais — Export PDF
1. Selecionar 3 docs diferentes (curto, médio, longo) e exportar.
2. Validar quebras de página, margens e tipografia.
3. Validar render de tabelas markdown e code blocks.
4. Testar em Chrome, Edge e Safari (impressão).

### Funcionais — Transcrição IA
1. Realizar ligação de 30s — não deve gerar transcrição.
2. Realizar ligação de 90s — deve gerar resumo em ≤ 5 min.
3. Conferir as 4 persistências (`calls`, `crm_deals.custom_fields`, `attendee_notes`, `deal_activities`).
4. Verificar formatação no `DealNotesTab`.

### Edge cases
- Documento sem H1 → fallback usa slug.
- Documento com caracteres especiais no título (`<`, `>`) → sanitizados antes do `document.write`.
- Ligação sem `CustomerKey` mapeável → log de warning, sem crash.
- Falha na Twilio Intelligence API → retry/log via Edge Function logs.

### Regressão
- `/admin/documentacao-qa`: lista, seleção e scroll continuam funcionando.
- `DealNotesTab`: atividades existentes (`note`, `meeting`, etc.) seguem renderizando.
- `twilio-voice-webhook`: fluxo de gravação atual não foi alterado para chamadas < 60s.

### Permissões / RLS
- Rota `/admin/documentacao-qa` exige role compatível com `ResourceGuard` (verificar `RoleGuard` no MainLayout).
- Editores não-admin não devem conseguir publicar nem editar `docs/qa/*` em produção (apenas leitura no app).
- Owner mantém acesso total.

### UI/UX
- Botão "Exportar PDF" alinhado à direita do cabeçalho do documento.
- ScrollArea reduzida para `65vh` para acomodar header de ações sem cortar conteúdo.

## Riscos e plano de rollback

| Risco | Mitigação | Rollback |
|------|-----------|----------|
| Janela de impressão bloqueada por pop-up | Avisar usuário; permitir pop-up do domínio | Reverter `QaDocsViewer.tsx` ao commit anterior |
| Custo IA fora do esperado | Threshold 60s + monitorar `daily_costs` | Desabilitar trigger no `twilio-voice-webhook` |
| RLS hardening quebrar TV dashboard / jobs | Split em migrations menores antes de aplicar | Migration pendente, não aplicada |

## Checklist final de validação
- [ ] Owner exportou ao menos 1 PDF com sucesso.
- [ ] Editor não-owner consegue visualizar e exportar.
- [ ] Última ligação ≥ 60s gerou `ai_summary` no lead.
- [ ] Esta doc está visível em `/admin/documentacao-qa`.
- [ ] Memória de QA (`mem://preferences/qa-documentation-thobson`) respeitada.
