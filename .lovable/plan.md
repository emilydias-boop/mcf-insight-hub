
# Adicionar Formulario de Qualificacao no DealDetailsDrawer

## Objetivo
Permitir abrir o formulario de qualificacao (o mesmo que aparece durante a ligacao) diretamente do drawer do lead, sem precisar estar em uma ligacao ativa.

## Como funciona hoje
- O formulario (`QualificationAndScheduleModal`) so abre em 2 situacoes:
  1. Durante uma ligacao Twilio (quando o lead atende)
  2. Ao arrastar um deal para "Sem Interesse" no Kanban
- Nao ha como preencher a qualificacao manualmente pelo drawer do lead

## Solucao

### Adicionar botao "Qualificar" no QuickActionsBlock ou diretamente no DealDetailsDrawer

**Arquivo: `src/components/crm/DealDetailsDrawer.tsx`**

1. Adicionar state para controlar a abertura do modal de qualificacao
2. Adicionar o componente `QualificationAndScheduleModal` no drawer
3. Adicionar um botao/acao que abre o modal -- posicionado proximo as acoes rapidas existentes (Ligar, WhatsApp, Agendar)

**Alteracoes especificas:**

- Importar `QualificationAndScheduleModal`
- Novo state: `const [showQualification, setShowQualification] = useState(false)`
- Adicionar botao com icone `ClipboardList` no bloco de acoes rapidas (apos "Agendar")
- Renderizar `<QualificationAndScheduleModal>` com `open={showQualification}`, passando `dealId` e `contactName`
- Ao fechar o modal, chamar `refetchDeal()` para atualizar os dados exibidos

**Arquivo: `src/components/crm/QuickActionsBlock.tsx`** (se o botao ficar nesse componente)

- Adicionar prop `onQualify` callback
- Renderizar botao "Qualificar" com icone de formulario

O formulario reutiliza 100% do componente existente `QualificationAndScheduleModal`, que ja carrega dados salvos anteriormente e permite editar/salvar novamente.

## Sobre os dados salvos

Confirmando: **sim, todos os dados sao salvos para o lead**. Ao preencher e clicar "Salvar":
- Os campos (profissao, renda, estado, etc.) sao salvos em `crm_deals.custom_fields`
- O resumo e registrado em `deal_activities` como `qualification_note`
- Esses dados aparecem na timeline e no card de qualificacao do drawer
