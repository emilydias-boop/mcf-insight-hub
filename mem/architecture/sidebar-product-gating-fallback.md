---
name: Sidebar Product Gating Fallback
description: Sidebar gates BU menus by employee_products; fallback derives products from sdr.squad when missing.
type: feature
---
A visibilidade dos menus de BU no sidebar é controlada por `requiredProducts` (ex: `["consorcio"]`, `["incorporador"]`), comparado contra `myProducts` retornado por `useMyProducts`.

Como `employee_products` raramente está populado para SDRs/Closers operacionais, o hook `useMyProducts` aplica fallback derivando do `sdr.squad`:
- `squad = 'consorcio'` → `['consorcio']`
- `squad = 'credito'` → `['consorcio']` (Crédito é parte do funil Consórcio)
- `squad = 'incorporador'` → `['incorporador']`

Este fallback evita que SDRs/Closers fiquem sem acesso aos menus de BU quando `employee_products` ainda não foi cadastrado.

Adicionalmente, a "BU - Incorporador MCF" inclui `sdr` e `closer` em `requiredRoles` para que SDRs/Closers vejam Painel Comercial, CRM, Vendas etc.
