---
name: Documentos do Consórcio (termo + comprovante)
description: Termo de Adesão e Comprovante de Cadastro na Embracon compartilham consorcio_termos/modelos, rota pública /termo/:token e edge function termo-assinatura
type: feature
---
Os dois documentos do cliente do Consórcio usam a MESMA infraestrutura, diferenciados pela coluna `tipo` ('adesao' | 'comprovante_cadastro'):

- `consorcio_termo_modelos.tipo` — índice único garante 1 modelo ativo por tipo; salvar cria nova versão e desativa só as do mesmo tipo.
- `consorcio_termos.tipo` — adesão vincula por `pending_registration_id`; comprovante por `card_id`.
- Rota pública única `/termo/:token` + edge function `termo-assinatura`. Comprovante NÃO é assinável (POST retorna `not_signable`), não expira (expires_at +10 anos) e grava `visualizado_em`/`visualizado_ip` na primeira abertura.
- Comprovante exige `consortium_cards.contrato_embracon`, grupo, cota e as 12 primeiras parcelas geradas.
- Valor de parcela do cronograma vem SEMPRE do card (`parcela_1a_12a` / `parcela_demais`), nunca de `consortium_installments.valor_parcela` (que é crédito ÷ prazo). `tipo='empresa'` = MCF paga.
- Emissão: lista de Cotas (ícone FileBadge) e drawer da cota. Modelo editável em Configurações do CRM → Documentos.

Desenho: os três documentos (termo, comprovante e Relatório do Lead) usam o papel institucional de `src/lib/documentoPapel.ts` (`PAPEL_CSS`, `papelBrandHtml`, `abrirParaImpressao`, `EMPRESA_RAZAO_SOCIAL`/`EMPRESA_CNPJ`). `conteudo_renderizado` continua sendo **markdown** (é ele que está no `conteudo_hash` — nunca converter para HTML). PDF sai pela impressão do navegador (`imprimirDocumento`), não por jsPDF. Sem marca-texto amarelo nos documentos emitidos.
