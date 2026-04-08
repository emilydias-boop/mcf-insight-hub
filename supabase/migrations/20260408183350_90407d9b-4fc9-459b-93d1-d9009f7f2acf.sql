-- Corrigir comp plan de março do Antony Elias para N1
UPDATE sdr_comp_plan 
SET fixo_valor = 2800, 
    variavel_total = 1200, 
    ote_total = 4000, 
    cargo_catalogo_id = 'd035345f-8fe3-41b4-8bba-28d0596c5bed'
WHERE id = 'a8336c61-4b9e-462b-9ca3-0dab0d8ca999';