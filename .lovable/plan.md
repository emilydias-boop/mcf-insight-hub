

# Corrigir navegacao para detalhe de SDR no Painel Comercial

## Problema

A rota para a pagina de detalhe do SDR nao esta registrada no `App.tsx`. O componente `SdrMeetingsDetailPage` esta importado mas nunca usado em uma `<Route>`.

Quando voce clica em qualquer SDR na tabela (ex: Juliana Rodrigues), o sistema tenta navegar para `/crm/reunioes-equipe/juliana.rodrigues@...`, mas essa URL nao tem rota — resultando em pagina em branco.

## Dados

Os dados estao todos corretos no banco. A RPC `get_sdr_metrics_from_agenda` retorna normalmente para fevereiro/2026:
- Juliana Rodrigues: 24 agendamentos, 12 R1 realizadas, 2 contratos pagos
- Todos os 10 SDRs ativos do squad `incorporador` aparecem

## Solucao

Adicionar a rota faltante no `App.tsx`:

### Arquivo: `src/App.tsx`

Adicionar entre a rota do `reunioes-equipe` (linha 325) e a do `closer/:closerId` (linha 326):

```
<Route path="crm/reunioes-equipe/:sdrEmail" element={
  <RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}>
    <SdrMeetingsDetailPage />
  </RoleGuard>
} />
```

Isso registra a rota com o parametro `:sdrEmail` que o `SdrMeetingsDetailPage` ja espera receber via `useParams()`.

## Resultado

- Clicar em qualquer SDR na tabela abrira a pagina de detalhe com os leads e metricas individuais
- Acesso restrito a admin, manager e coordenador (mesma regra do closer)
- Nenhuma alteracao de componente necessaria — apenas o registro da rota

### Arquivo modificado
- `src/App.tsx` — adicionar 1 rota

