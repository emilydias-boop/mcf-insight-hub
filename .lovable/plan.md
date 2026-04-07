

# Sistema de Alertas de Cobrança para Consórcio e Billing

## Contexto
Hoje o operador precisa manualmente verificar quais parcelas vencem nos proximos dias e quais boletos precisam ser enviados. Nao existe lembrete automatico, nem forma de registrar que o boleto ja foi enviado ou que o lead respondeu.

## Solucao

Criar um painel de alertas inteligentes na pagina de Pagamentos (consorcio) e na pagina de Cobrancas (billing), com logica baseada em:
- **Vencimento proximo**: parcelas que vencem nos proximos 3-5 dias uteis e ainda nao tiveram boleto enviado
- **Assalariados (5o dia util)**: cards com `dia_vencimento` proximo ao 5o dia util do mes recebem alerta antecipado (ex: "Grupo 7253 - 26 cartas vencem dia 10, assalariados recebem no 5o dia util")
- **Acao pendente**: marcar como "boleto enviado" / "lead respondeu" / "sem retorno" para silenciar o alerta daquela parcela

## Mudancas Tecnicas

### 1. Nova tabela `cobranca_acoes` (migration)
Registra acoes do operador sobre parcelas especificas:
```text
id (uuid PK)
installment_id (uuid FK → consortium_installments)  -- nullable
subscription_id (uuid FK → billing_subscriptions)    -- nullable
tipo_acao: 'boleto_enviado' | 'lead_respondeu' | 'sem_retorno' | 'pago_confirmado'
observacao (text, nullable)
created_by (uuid FK → auth.users)
created_at (timestamptz)
```
RLS: authenticated can insert/select own rows.

### 2. Hook `useCobrancaAlerts.ts`
- Query que busca parcelas com `data_vencimento` entre hoje e hoje+5 dias uteis
- Left join com `consorcio_boletos` (tem boleto?) e `cobranca_acoes` (ja teve acao?)
- Filtra: parcelas sem acao recente = alerta ativo
- Agrupa por `dia_vencimento` e por lead (nome_completo)
- Retorna lista de alertas com prioridade:
  - **Urgente** (vence em 1-2 dias, sem boleto enviado)
  - **Atencao** (vence em 3-5 dias, sem boleto enviado)
  - **OK** (boleto ja enviado ou lead respondeu) — nao aparece

### 3. Hook `useRegistrarAcaoCobranca.ts`
- Mutation para inserir em `cobranca_acoes`
- Invalida cache dos alertas

### 4. Componente `CobrancaAlertPanel.tsx`
Painel que aparece no topo da pagina de Pagamentos e Cobrancas:
- Lista agrupada por dia de vencimento (ex: "Dia 10 — 26 parcelas")
- Dentro de cada grupo, lista de leads com:
  - Nome, grupo/cota, valor
  - Status do boleto (enviado/nao enviado)
  - Botoes de acao: "Boleto Enviado", "Lead Respondeu", "Sem Retorno"
- Ao clicar numa acao, registra em `cobranca_acoes` e o alerta desaparece
- Badge com contagem total de pendentes
- Expansivel/colapsavel como a `CobrancaQueue`

### 5. Overlay global (opcional, similar ao SDR)
- Componente flutuante no `MainLayout` para roles de financeiro/admin
- Mostra contagem de parcelas com vencimento proximo sem acao
- Clique navega para `/consorcio/pagamentos`

### 6. Integracao nas paginas
- `Pagamentos.tsx` (consorcio): renderizar `CobrancaAlertPanel` acima dos KPIs
- `FinanceiroCobrancas.tsx` (billing): renderizar versao equivalente para `billing_installments` com vencimento proximo

## Arquivos

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/xxx_create_cobranca_acoes.sql` | Nova tabela + RLS |
| `src/hooks/useCobrancaAlerts.ts` | Hook de alertas com query inteligente |
| `src/hooks/useRegistrarAcaoCobranca.ts` | Mutation para registrar acoes |
| `src/components/shared/CobrancaAlertPanel.tsx` | Painel de alertas reutilizavel |
| `src/pages/bu-consorcio/Pagamentos.tsx` | Integrar painel |
| `src/components/financeiro/cobranca/FinanceiroCobrancas.tsx` | Integrar painel |
| `src/components/layout/MainLayout.tsx` | Overlay global (se aprovado) |

## Fluxo do Operador
```text
1. Abre pagina de Pagamentos
2. Ve painel: "⚠ 26 parcelas vencem dia 10 (em 3 dias)"
3. Expande grupo dia 10 → ve lista de leads
4. Para cada lead: clica "Boleto Enviado" → alerta some
5. Se lead respondeu: clica "Lead Respondeu"
6. Se nao respondeu: clica "Sem Retorno" (fica registrado, pode filtrar depois)
7. Parcelas pagas automaticamente saem do alerta
```

