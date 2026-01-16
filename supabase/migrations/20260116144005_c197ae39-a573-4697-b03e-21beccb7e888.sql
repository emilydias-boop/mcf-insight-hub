-- Inserir valores tabelados oficiais da Embracon - Tabela Parcelinha (TP)
-- Valores exatos conforme tabelas oficiais do PDF

-- IE500 - R$ 500.000,00
INSERT INTO consorcio_creditos (
  produto_id, codigo_credito, valor_credito, ativo,
  parcela_1a_12a_conv_240, parcela_demais_conv_240,
  parcela_1a_12a_50_240, parcela_demais_50_240,
  parcela_1a_12a_25_240, parcela_demais_25_240,
  parcela_1a_12a_conv_220, parcela_demais_conv_220,
  parcela_1a_12a_50_220, parcela_demais_50_220,
  parcela_1a_12a_25_220, parcela_demais_25_220,
  parcela_1a_12a_conv_200, parcela_demais_conv_200,
  parcela_1a_12a_50_200, parcela_demais_50_200,
  parcela_1a_12a_25_200, parcela_demais_25_200
) 
SELECT 
  id, 'IE500', 500000.00, true,
  3183.33, 2683.33,  2120.83, 1620.83,  2652.08, 2152.08,
  3477.27, 2977.27,  2315.91, 1815.91,  2896.59, 2396.59,
  3750.00, 3250.00,  2500.00, 2000.00,  3125.00, 2625.00
FROM consorcio_produtos WHERE codigo = 'TP';

-- IE520 - R$ 520.000,00
INSERT INTO consorcio_creditos (
  produto_id, codigo_credito, valor_credito, ativo,
  parcela_1a_12a_conv_240, parcela_demais_conv_240,
  parcela_1a_12a_50_240, parcela_demais_50_240,
  parcela_1a_12a_25_240, parcela_demais_25_240,
  parcela_1a_12a_conv_220, parcela_demais_conv_220,
  parcela_1a_12a_50_220, parcela_demais_50_220,
  parcela_1a_12a_25_220, parcela_demais_25_220,
  parcela_1a_12a_conv_200, parcela_demais_conv_200,
  parcela_1a_12a_50_200, parcela_demais_50_200,
  parcela_1a_12a_25_200, parcela_demais_25_200
) 
SELECT 
  id, 'IE520', 520000.00, true,
  3310.67, 2790.67,  2205.67, 1685.67,  2758.17, 2238.17,
  3616.36, 3096.36,  2408.55, 1888.55,  3012.45, 2492.45,
  3900.00, 3380.00,  2600.00, 2080.00,  3250.00, 2730.00
FROM consorcio_produtos WHERE codigo = 'TP';

-- IE530 - R$ 530.000,00
INSERT INTO consorcio_creditos (
  produto_id, codigo_credito, valor_credito, ativo,
  parcela_1a_12a_conv_240, parcela_demais_conv_240,
  parcela_1a_12a_50_240, parcela_demais_50_240,
  parcela_1a_12a_25_240, parcela_demais_25_240,
  parcela_1a_12a_conv_220, parcela_demais_conv_220,
  parcela_1a_12a_50_220, parcela_demais_50_220,
  parcela_1a_12a_25_220, parcela_demais_25_220,
  parcela_1a_12a_conv_200, parcela_demais_conv_200,
  parcela_1a_12a_50_200, parcela_demais_50_200,
  parcela_1a_12a_25_200, parcela_demais_25_200
) 
SELECT 
  id, 'IE530', 530000.00, true,
  3374.33, 2844.33,  2248.08, 1718.08,  2811.21, 2281.21,
  3686.36, 3156.36,  2455.09, 1925.09,  3070.73, 2540.73,
  3975.00, 3445.00,  2650.00, 2120.00,  3312.50, 2782.50
FROM consorcio_produtos WHERE codigo = 'TP';

-- IE550 - R$ 550.000,00
INSERT INTO consorcio_creditos (
  produto_id, codigo_credito, valor_credito, ativo,
  parcela_1a_12a_conv_240, parcela_demais_conv_240,
  parcela_1a_12a_50_240, parcela_demais_50_240,
  parcela_1a_12a_25_240, parcela_demais_25_240,
  parcela_1a_12a_conv_220, parcela_demais_conv_220,
  parcela_1a_12a_50_220, parcela_demais_50_220,
  parcela_1a_12a_25_220, parcela_demais_25_220,
  parcela_1a_12a_conv_200, parcela_demais_conv_200,
  parcela_1a_12a_50_200, parcela_demais_50_200,
  parcela_1a_12a_25_200, parcela_demais_25_200
) 
SELECT 
  id, 'IE550', 550000.00, true,
  3501.67, 2951.67,  2332.92, 1782.92,  2917.29, 2367.29,
  3825.00, 3275.00,  2547.73, 1997.73,  3186.36, 2636.36,
  4125.00, 3575.00,  2750.00, 2200.00,  3437.50, 2887.50
FROM consorcio_produtos WHERE codigo = 'TP';

-- IE580 - R$ 580.000,00
INSERT INTO consorcio_creditos (
  produto_id, codigo_credito, valor_credito, ativo,
  parcela_1a_12a_conv_240, parcela_demais_conv_240,
  parcela_1a_12a_50_240, parcela_demais_50_240,
  parcela_1a_12a_25_240, parcela_demais_25_240,
  parcela_1a_12a_conv_220, parcela_demais_conv_220,
  parcela_1a_12a_50_220, parcela_demais_50_220,
  parcela_1a_12a_25_220, parcela_demais_25_220,
  parcela_1a_12a_conv_200, parcela_demais_conv_200,
  parcela_1a_12a_50_200, parcela_demais_50_200,
  parcela_1a_12a_25_200, parcela_demais_25_200
) 
SELECT 
  id, 'IE580', 580000.00, true,
  3692.67, 3112.67,  2460.17, 1880.17,  3076.42, 2496.42,
  4033.64, 3453.64,  2686.36, 2106.36,  3360.00, 2780.00,
  4350.00, 3770.00,  2900.00, 2320.00,  3625.00, 3045.00
FROM consorcio_produtos WHERE codigo = 'TP';

-- IE600 - R$ 600.000,00
INSERT INTO consorcio_creditos (
  produto_id, codigo_credito, valor_credito, ativo,
  parcela_1a_12a_conv_240, parcela_demais_conv_240,
  parcela_1a_12a_50_240, parcela_demais_50_240,
  parcela_1a_12a_25_240, parcela_demais_25_240,
  parcela_1a_12a_conv_220, parcela_demais_conv_220,
  parcela_1a_12a_50_220, parcela_demais_50_220,
  parcela_1a_12a_25_220, parcela_demais_25_220,
  parcela_1a_12a_conv_200, parcela_demais_conv_200,
  parcela_1a_12a_50_200, parcela_demais_50_200,
  parcela_1a_12a_25_200, parcela_demais_25_200
) 
SELECT 
  id, 'IE600', 600000.00, true,
  3820.00, 3220.00,  2545.00, 1945.00,  3182.50, 2582.50,
  4172.73, 3572.73,  2779.09, 2179.09,  3475.91, 2875.91,
  4500.00, 3900.00,  3000.00, 2400.00,  3750.00, 3150.00
FROM consorcio_produtos WHERE codigo = 'TP';