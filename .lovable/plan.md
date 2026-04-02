

## Upload de Boletos com OCR + Matching + Envio WhatsApp

### Visão geral

Criar um fluxo completo onde o operador sobe uma pasta de boletos em PDF, o sistema usa IA (Lovable AI / Gemini) para extrair dados de cada boleto (nome, grupo, cota, linha digitável, valor, vencimento), faz o matching automático com as cartas cadastradas (`consortium_cards`), e permite enviar o boleto + mensagem pronta via WhatsApp (wa.me ou Twilio).

### Arquitetura

```text
┌──────────────┐     ┌─────────────────────┐     ┌───────────────────┐
│  Upload PDFs │────▶│ Edge Fn: parse-boleto│────▶│ Tabela:           │
│  (múltiplos) │     │ - Lê PDF c/ Gemini  │     │ consorcio_boletos │
│              │     │ - Extrai dados      │     │ (card_id, parcela,│
└──────────────┘     │ - Match por nome/   │     │  linha_digitavel, │
                     │   grupo/cota        │     │  storage_path...) │
                     └─────────────────────┘     └───────────────────┘
                                                        │
                                   ┌────────────────────┘
                                   ▼
                     ┌─────────────────────┐
                     │ UI: Badge "Boleto"  │
                     │ na linha da parcela  │
                     │ + Drawer expandido   │
                     │ + Copiar linha dig.  │
                     │ + Enviar WhatsApp    │
                     └─────────────────────┘
```

### Componentes

#### 1. Migration SQL — Tabela `consorcio_boletos` + Bucket Storage

Nova tabela para armazenar os dados extraídos de cada boleto e o link ao PDF:

| Coluna | Tipo | Descrição |
|---|---|---|
| id | UUID PK | |
| card_id | UUID FK → consortium_cards | Carta vinculada |
| installment_id | UUID FK → consortium_installments (nullable) | Parcela vinculada |
| nome_extraido | TEXT | Nome lido do boleto pela IA |
| grupo_extraido | TEXT | Grupo lido |
| cota_extraida | TEXT | Cota lida |
| valor_extraido | NUMERIC | Valor lido |
| vencimento_extraido | DATE | Vencimento lido |
| linha_digitavel | TEXT | Código de barras digitável |
| codigo_barras | TEXT | Código de barras numérico |
| storage_path | TEXT | Path no bucket Supabase |
| match_confidence | TEXT | 'exact', 'partial', 'manual' |
| status | TEXT | 'matched', 'pending_review', 'sent' |
| sent_at | TIMESTAMPTZ | Quando foi enviado por WhatsApp |
| created_at / uploaded_by | Audit fields |

Bucket: `consorcio-boletos` (privado)

#### 2. Edge Function `parse-boleto`

- Recebe o PDF do Storage (base64 ou URL assinada)
- Envia para Lovable AI (Gemini 2.5 Flash) com prompt para extrair: nome, grupo, cota, linha digitável, valor, vencimento
- Faz matching: busca em `consortium_cards` por nome_completo/razao_social + grupo + cota
- Se match exato → vincula ao card_id e à installment correspondente (por vencimento)
- Se parcial → marca como `pending_review`
- Salva na tabela `consorcio_boletos`

#### 3. Edge Function `send-boleto-whatsapp`

- Recebe: boleto_id, modo ('twilio' | 'wame')
- Busca dados do boleto + card (telefone)
- Monta mensagem com saudação automática (Bom dia/tarde/noite baseado na hora)
- Se Twilio: envia mensagem + media URL (PDF público temporário)
- Se wa.me: retorna URL formatada para abrir WhatsApp Web

#### 4. Frontend — `BoletoUploadDialog.tsx`

Botão "📎 Subir Boletos" no header da página de Pagamentos. Dialog com:
- Dropzone para múltiplos PDFs
- Progress bar por arquivo (upload → OCR → matching)
- Lista de resultados: ✅ matched / ⚠️ revisar / ❌ sem match
- Ação para revisar/corrigir matches manuais

#### 5. Frontend — Indicador na tabela + Drawer expandido

- Na `PagamentosTable`: coluna/ícone indicando se aquela parcela tem boleto vinculado
- No `PagamentoDetailDrawer`: seção "Boleto" em cada parcela que tem boleto:
  - Dados extraídos (valor, vencimento, linha digitável)
  - Botão "Copiar Linha Digitável"
  - Botão "Enviar por WhatsApp" (abre menu: wa.me / Twilio)
  - Botão "Ver PDF" (abre em nova aba)

#### 6. Mensagem WhatsApp pronta

```
Bom dia/Boa tarde/Boa noite {nome}, tudo bem?

Segue o seu boleto referente à parcela {numero_parcela} do mês de {mes_referencia}, com vencimento em {data_vencimento}.

Linha digitável: {linha_digitavel}

Qualquer dúvida estou à disposição! 😊
```

### Arquivos afetados

1. **Migration SQL** — Tabela `consorcio_boletos`, bucket `consorcio-boletos`, RLS
2. **`supabase/functions/parse-boleto/index.ts`** — Edge function OCR com Lovable AI
3. **`supabase/functions/send-boleto-whatsapp/index.ts`** — Edge function envio WhatsApp
4. **`src/components/consorcio/pagamentos/BoletoUploadDialog.tsx`** — Dialog de upload
5. **`src/components/consorcio/pagamentos/BoletoSection.tsx`** — Seção de boleto no drawer
6. **`src/hooks/useConsorcioBoletos.ts`** — Hooks para CRUD de boletos
7. **`src/components/consorcio/pagamentos/PagamentoDetailDrawer.tsx`** — Adicionar seção de boleto
8. **`src/components/consorcio/pagamentos/PagamentosTable.tsx`** — Indicador de boleto na linha
9. **`src/pages/bu-consorcio/Pagamentos.tsx`** — Botão de upload no header

