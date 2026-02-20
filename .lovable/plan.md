

# Evolucao Completa do Modulo de Patrimonio

Este plano cobre todas as melhorias solicitadas, divididas em fases para garantir entregas incrementais e estaveis.

---

## Fase 1: Numero de Patrimonio Automatico + Novos Campos no Banco

### Migracao de Banco de Dados

Adicionar colunas na tabela `assets`:

```text
- garantia_inicio (date, nullable)
- garantia_fim (date, nullable)
- localizacao (text, nullable)
- centro_custo (text, nullable)
```

Criar uma sequence e funcao para gerar o numero automaticamente:

```text
- Sequence: asset_patrimonio_seq
- Funcao: generate_patrimonio_number(tipo asset_type) RETURNS text
  - Mapeia tipo para sigla: notebook=NB, desktop=DT, monitor=MN, celular=CL, tablet=TB, impressora=IM, outro=OT
  - Busca proximo valor da sequence
  - Retorna formato TI-{SIGLA}-{SEQ com 6 digitos} (ex: TI-NB-000001)
- Trigger: BEFORE INSERT no assets, preenche numero_patrimonio automaticamente
- Constraint UNIQUE ja existe em numero_patrimonio
```

Adicionar constraint de validacao para serial unico (se nao nulo):

```text
- CREATE UNIQUE INDEX idx_assets_numero_serie_unique 
  ON assets(numero_serie) WHERE numero_serie IS NOT NULL
```

Regra de baixa (nao permitir baixar se em uso):

```text
- Trigger BEFORE UPDATE: se status muda para 'baixado' e status anterior e 'em_uso', rejeitar
```

### Alteracoes no Formulario (AssetFormDialog.tsx)

- Remover campo `numero_patrimonio` no modo criacao (sera gerado automaticamente)
- Mostrar campo `numero_patrimonio` como read-only no modo edicao (somente admin pode editar)
- Adicionar campos: Garantia Inicio, Garantia Fim, Localizacao, Centro de Custo
- Atualizar schema zod removendo obrigatoriedade do numero_patrimonio na criacao

### Alteracoes no Hook (useAssets.ts)

- Remover `numero_patrimonio` do input de criacao (nao enviar no insert, o trigger gera)
- Ou: deixar opcional e o trigger sobrescreve

### Alteracoes nos Tipos (patrimonio.ts)

- Atualizar interface `Asset` com novos campos
- Atualizar `CreateAssetInput` removendo `numero_patrimonio` como obrigatorio
- Adicionar campos de garantia e localizacao

### Alteracoes no Card de Info (AssetInfoCard.tsx)

- Exibir garantia (inicio/fim) com alerta visual se vencida ou proxima de vencer (30 dias)
- Exibir localizacao e centro de custo

---

## Fase 2: Termo com Versao e Audit Trail

### Migracao de Banco de Dados

Adicionar colunas na tabela `asset_terms`:

```text
- versao (integer, default 1)
- user_agent (text, nullable)
```

A tabela ja possui: `ip_aceite`, `data_aceite`, `assinatura_digital`, `bloqueado`, `storage_path`.

### Alteracoes no Aceite do Termo (useAssetTerms.ts)

- No `acceptTerm`, capturar IP via API publica (ex: api.ipify.org) e user_agent do navegador
- Registrar versao incrementalmente
- Salvar no `ip_aceite` e gravar `user_agent`

### Geracao de PDF do Termo

- Criar edge function `generate-term-pdf` que recebe o conteudo do termo e gera um PDF
- Salvar PDF no bucket `asset-invoices` (ou criar bucket `asset-terms`)
- Atualizar `storage_path` no registro do termo
- Exibir link para download do PDF na pagina de detalhes e em Meus Equipamentos

---

## Fase 3: QR Code do Patrimonio

### Implementacao

- Instalar dependencia `qrcode.react` para gerar QR codes no frontend
- Na pagina de detalhes do equipamento (`AssetDetailsPage.tsx`), adicionar botao "QR Code"
- O QR Code contera a URL do equipamento: `{APP_URL}/patrimonio/{asset.id}`
- Dialog com QR Code renderizado e botao para imprimir/download como imagem
- Na lista de equipamentos, adicionar coluna opcional com icone de QR Code

### Novo Componente

- `src/components/patrimonio/AssetQRCode.tsx`: dialog com QR code + botao de impressao

---

## Fase 4: Relatorios por Colaborador/Setor/Status

### Novo Componente

- `src/pages/patrimonio/PatrimonioRelatorios.tsx`: pagina de relatorios
- Filtros: por colaborador, por setor, por status, por tipo, por periodo
- Cards de resumo: total por status, tempo medio em manutencao, equipamentos com garantia vencida
- Tabela exportavel (CSV/Excel usando xlsx ja instalado)
- Adicionar rota `/patrimonio/relatorios` e link no sidebar

### Hook de Relatorios

- `src/hooks/useAssetReports.ts`: queries agregadas para relatorios
- Equipamentos por colaborador (join com assignments ativos)
- Equipamentos por setor
- Tempo em manutencao (diferenca entre entrada e saida de manutencao via historico)
- Garantias proximas de vencer

---

## Resumo de Arquivos

| Arquivo | Acao | Fase |
|---------|------|------|
| Migracao SQL | Criar (novos campos + trigger numero auto) | 1 |
| `src/types/patrimonio.ts` | Editar (novos campos Asset, ajustar CreateAssetInput) | 1 |
| `src/components/patrimonio/AssetFormDialog.tsx` | Editar (remover campo numero, adicionar garantia/localizacao) | 1 |
| `src/hooks/useAssets.ts` | Editar (ajustar createAsset) | 1 |
| `src/components/patrimonio/AssetInfoCard.tsx` | Editar (exibir garantia, localizacao, centro custo) | 1 |
| `src/hooks/useAssetTerms.ts` | Editar (capturar IP, user_agent, versao) | 2 |
| `supabase/functions/generate-term-pdf/index.ts` | Criar (edge function para PDF) | 2 |
| Migracao SQL (versao + user_agent) | Criar | 2 |
| `src/components/patrimonio/AssetQRCode.tsx` | Criar (dialog QR code) | 3 |
| `src/pages/patrimonio/AssetDetailsPage.tsx` | Editar (botao QR code) | 3 |
| `src/pages/patrimonio/PatrimonioRelatorios.tsx` | Criar (pagina de relatorios) | 4 |
| `src/hooks/useAssetReports.ts` | Criar (queries de relatorios) | 4 |
| Sidebar + Rotas | Editar (adicionar link Relatorios) | 4 |

---

## O que ja funciona e nao precisa ser reimplementado

- Fluxo de devolucao com conferencia de itens (AssetReturnDialog)
- Transferencia de responsavel com historico preservado (AssetTransferDialog)
- Itens entregues salvos estruturadamente (asset_assignment_items)
- Termo de responsabilidade com geracao e aceite
- Timeline com eventos detalhados e autor
- Historico de responsaveis anteriores
- Logs de auditoria via asset_history

