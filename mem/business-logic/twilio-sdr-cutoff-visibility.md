---
name: Corte de visibilidade Twilio para SDRs
description: Ligações Twilio (tabela calls) de SDRs com created_at >= 2026-08-14 01:36:04+00 são invisíveis em todo o sistema; closers e histórico anterior intactos
type: feature
---
- Fonte única de verdade: `public.call_is_visible(user_id, created_at)` (SECURITY DEFINER, STABLE).
- Regra: oculta se `created_at >= '2026-08-14 01:36:04+00'` E o usuário tem role `sdr` E NÃO tem `closer`/`closer_sombra`.
- Aplicada na policy SELECT `Users can view their own calls` de `public.calls` (vale para todos os ~18 call sites do frontend) e dentro da RPC security-definer `get_sdr_call_daily_summary`.
- Inserts/updates em `calls` NÃO são filtrados (Twilio continua gravando); edge functions com service_role bypassam RLS.
- Nada da lógica Sonax foi alterado. Novas RPCs security definer que leiam `calls` devem chamar `call_is_visible`.
