
-- Fix Julio March comp plan: restore N2 values and add cargo_catalogo_id
UPDATE sdr_comp_plan SET 
  fixo_valor = 5600, variavel_total = 2400, ote_total = 8000,
  cargo_catalogo_id = 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563'
WHERE id = '9ce71a7d-4fad-4181-8a5b-bc71bd5213d7';

-- Fix Julio April comp plan: add cargo_catalogo_id for N1
UPDATE sdr_comp_plan SET 
  cargo_catalogo_id = 'c2909e20-3bfc-4a9f-853f-97f065af099a'
WHERE id = 'b3d2cc8b-a2ca-49d1-bba0-a10920f7c1a9';

-- Fix Thayna March comp plan: add cargo_catalogo_id for N3
UPDATE sdr_comp_plan SET 
  cargo_catalogo_id = 'd7bdc06e-d63a-49b8-9ccc-c9c8f06aa037'
WHERE id = '433d78b9-5c8f-4700-bbdb-91e6b592a907';

-- Fix Thayna April comp plan: add cargo_catalogo_id for N2
UPDATE sdr_comp_plan SET 
  cargo_catalogo_id = 'fd8d5a86-4687-4e89-b00d-84e7e5bcd563'
WHERE id = 'c9761f11-27a0-4cbb-a327-77675aa46bc3';
