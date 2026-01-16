-- Tabela de produtos de consórcio Embracon
CREATE TABLE public.consorcio_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  faixa_credito_min NUMERIC(15,2) NOT NULL,
  faixa_credito_max NUMERIC(15,2) NOT NULL,
  taxa_antecipada_percentual NUMERIC(5,2) NOT NULL,
  taxa_antecipada_tipo VARCHAR(20) NOT NULL CHECK (taxa_antecipada_tipo IN ('primeira_parcela', 'dividida_12')),
  prazos_disponiveis INTEGER[] NOT NULL,
  taxa_adm_200 NUMERIC(5,2),
  taxa_adm_220 NUMERIC(5,2),
  taxa_adm_240 NUMERIC(5,2),
  fundo_reserva NUMERIC(5,2) DEFAULT 2.0,
  seguro_vida_percentual NUMERIC(6,4) DEFAULT 0.0610,
  grupo_padrao VARCHAR(20),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de créditos disponíveis por produto
CREATE TABLE public.consorcio_creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.consorcio_produtos(id) ON DELETE CASCADE,
  codigo_credito VARCHAR(20) NOT NULL,
  valor_credito NUMERIC(15,2) NOT NULL,
  
  -- Parcelas para prazo 240 meses
  parcela_1a_12a_conv_240 NUMERIC(15,2),
  parcela_demais_conv_240 NUMERIC(15,2),
  parcela_1a_12a_50_240 NUMERIC(15,2),
  parcela_demais_50_240 NUMERIC(15,2),
  parcela_1a_12a_25_240 NUMERIC(15,2),
  parcela_demais_25_240 NUMERIC(15,2),
  
  -- Parcelas para prazo 220 meses
  parcela_1a_12a_conv_220 NUMERIC(15,2),
  parcela_demais_conv_220 NUMERIC(15,2),
  parcela_1a_12a_50_220 NUMERIC(15,2),
  parcela_demais_50_220 NUMERIC(15,2),
  parcela_1a_12a_25_220 NUMERIC(15,2),
  parcela_demais_25_220 NUMERIC(15,2),
  
  -- Parcelas para prazo 200 meses
  parcela_1a_12a_conv_200 NUMERIC(15,2),
  parcela_demais_conv_200 NUMERIC(15,2),
  parcela_1a_12a_50_200 NUMERIC(15,2),
  parcela_demais_50_200 NUMERIC(15,2),
  parcela_1a_12a_25_200 NUMERIC(15,2),
  parcela_demais_25_200 NUMERIC(15,2),
  
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(produto_id, codigo_credito)
);

-- Enable RLS
ALTER TABLE public.consorcio_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consorcio_creditos ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura para todos os usuários autenticados
CREATE POLICY "Usuários autenticados podem ler produtos" 
ON public.consorcio_produtos FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem ler créditos" 
ON public.consorcio_creditos FOR SELECT 
TO authenticated 
USING (true);

-- Inserir produtos Embracon
INSERT INTO public.consorcio_produtos (codigo, nome, descricao, faixa_credito_min, faixa_credito_max, taxa_antecipada_percentual, taxa_antecipada_tipo, prazos_disponiveis, taxa_adm_200, taxa_adm_220, taxa_adm_240, fundo_reserva, seguro_vida_percentual, grupo_padrao) VALUES
('TP', 'Tabela Parcelinha', 'Imóvel Estendido - Taxa dividida em 12 parcelas', 120000.00, 600000.00, 1.20, 'dividida_12', ARRAY[200, 220, 240], 20.00, 22.00, 25.00, 2.0, 0.0610, NULL),
('EI1', 'Estendido 1%', 'Imóvel Estendido - Taxa na 1ª parcela', 120000.00, 600000.00, 1.00, 'primeira_parcela', ARRAY[200, 220, 240], 20.00, 22.00, 25.00, 2.0, 0.0610, NULL),
('TEP', 'Tabela Estendido Prime', 'Imóvel 600K a 1.2M - Taxa dividida em 12', 600000.00, 1200000.00, 1.20, 'dividida_12', ARRAY[200, 220, 240], 20.00, 22.00, 25.00, 2.0, 0.0610, NULL),
('TEP_ALTO', 'TEP Alto Valor', 'Imóvel 1M a 2M - Taxa dividida em 12', 1000000.00, 2000000.00, 1.20, 'dividida_12', ARRAY[200, 220, 240], 20.00, 22.00, 25.00, 2.0, 0.0610, NULL),
('PSE', 'Plano Select Estendido', 'Imóvel Select - Taxa 2% na 1ª parcela', 120000.00, 600000.00, 2.00, 'primeira_parcela', ARRAY[200, 220, 240], 20.00, 22.00, 25.00, 2.0, 0.0610, NULL),
('SEP', 'Select Estendido Prime', 'Imóvel Select 600K a 1.2M - Taxa 2% na 1ª', 600000.00, 1200000.00, 2.00, 'primeira_parcela', ARRAY[200, 220, 240], 20.00, 22.00, 25.00, 2.0, 0.0610, NULL),
('SEP_ALTO', 'SEP Alto Valor', 'Imóvel Select 1M a 2M - Taxa 2% na 1ª', 1000000.00, 2000000.00, 2.00, 'primeira_parcela', ARRAY[200, 220, 240], 20.00, 22.00, 25.00, 2.0, 0.0610, NULL);

-- Trigger para updated_at
CREATE TRIGGER update_consorcio_produtos_updated_at
BEFORE UPDATE ON public.consorcio_produtos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();