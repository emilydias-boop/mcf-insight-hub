

## Plano: Email completo de NFSe com detalhamento do fechamento

### Problema atual

Os emails de NFSe enviados ao financeiro e supervisor contem apenas: nome, mes, numero e valor. Faltam informacoes criticas para o financeiro validar:
- Link para download da nota fiscal (PDF)
- Data de envio
- Quem aprovou o fechamento e quando
- Detalhamento dos indicadores que geraram o valor (para quem tem OTE)

### Solucao

Enriquecer a funcao `sendNfseEmails` em ambos os modais para buscar dados adicionais do payout e montar um email completo.

### Alteracoes

**1. `src/components/sdr-fechamento/EnviarNfseFechamentoModal.tsx`**

Expandir `sendNfseEmails` para:
- Receber `payoutId` e `storagePath` como parametros
- Buscar dados do payout: `aprovado_por`, `aprovado_em`, `valor_fixo`, `valor_variavel_total`, KPIs (pct e mult de cada indicador)
- Buscar nome de quem aprovou via `profiles` ou `employees`
- Gerar signed URL do PDF via `supabase.storage`
- Montar email HTML com tabela estruturada:

```text
+-------------------------------------------+
| NFSe Fechamento — [Nome] — [Mes/Ano]      |
+-------------------------------------------+
| Data de envio: 13/04/2026                  |
| Numero NFSe: 12345                         |
| Valor: R$ 4.500,00                         |
| [Botao: Baixar NFSe PDF]                   |
+-------------------------------------------+
| APROVACAO                                  |
| Aprovado por: Fulano                       |
| Data aprovacao: 10/04/2026                 |
+-------------------------------------------+
| COMPOSICAO DO VALOR (se payout existe)     |
| Fixo: R$ 2.000,00                          |
| Variavel: R$ 2.500,00                      |
|   - Reunioes Agendadas: 120% → R$ 800     |
|   - Reunioes Realizadas: 95% → R$ 700     |
|   - Tentativas: 110% → R$ 600             |
|   - Organizacao: 100% → R$ 400            |
| iFood: R$ 0,00                             |
| Total Conta: R$ 4.500,00                   |
+-------------------------------------------+
```

**2. `src/components/meu-rh/EnviarNfseModal.tsx`**

Expandir `sendNfseEmails` para:
- Receber `storagePath`
- Gerar signed URL do PDF
- Incluir link de download e data de envio no email
- Sem detalhamento de OTE (nao se aplica a esse fluxo)

**3. `src/lib/notifyDocumentAction.ts`**

Criar funcao auxiliar `buildNfseDetailedEmailHtml` para gerar o template HTML rico com tabelas e botao de download, reutilizavel por ambos os modais.

### Dados disponiveis

Do `sdr_month_payout`:
- `aprovado_por` (user_id), `aprovado_em` (timestamp)
- `valor_fixo`, `valor_variavel_total`, `total_conta`
- `pct_reunioes_agendadas/realizadas/tentativas/organizacao` + respectivos `valor_*`
- `ifood_mensal`, `ifood_ultrameta`, `total_ifood`

O signed URL tem validade limitada (usaremos 7 dias para o financeiro ter tempo de baixar).

### Resultado

O financeiro recebe um email completo e auto-suficiente para validar e processar o pagamento, com link direto para a nota e toda a composicao do valor.

