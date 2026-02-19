

# Deletar Registro Duplicado do Make - Julio Cesar del Nero

## Acao
Deletar permanentemente o registro com ID `1cdcdf3e-4773-4764-a47d-4a6b3778f134` da tabela `hubla_transactions`.

## Registro a ser deletado

| Campo | Valor |
|-------|-------|
| ID | 1cdcdf3e-4773-4764-a47d-4a6b3778f134 |
| Cliente | Julio Cesar del Nero |
| Produto (errado) | A009 - MCF INCORPORADOR COMPLETO + THE CLUB |
| Bruto | R$ 19.500 |
| Liquido | R$ 16.245 |
| Source | make |
| Hubla ID | make_parceria_1770931038984_juliodelne |

## Motivo
O webhook Make mapeou incorretamente a compra como A009 (R$ 19.500), quando o cliente adquiriu apenas A001 (R$ 14.500) + order bumps. Os registros corretos ja existem via Hubla.

## Implementacao Tecnica
Executar um `DELETE` direto na tabela `hubla_transactions` usando o ID do registro.

```text
DELETE FROM hubla_transactions WHERE id = '1cdcdf3e-4773-4764-a47d-4a6b3778f134';
```

## Impacto
- Remove R$ 19.500 de bruto e R$ 16.245 de liquido dos totais
- Os registros corretos da Hubla (A001 + bumps) permanecem intactos

