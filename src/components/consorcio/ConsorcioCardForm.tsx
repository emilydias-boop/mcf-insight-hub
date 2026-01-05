import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { buscarCep } from '@/lib/cepUtils';
import { useCreateConsorcioCard } from '@/hooks/useConsorcio';
import { useEmployees } from '@/hooks/useEmployees';
import {
  ESTADO_CIVIL_OPTIONS,
  TIPO_SERVIDOR_OPTIONS,
  ORIGEM_OPTIONS,
  CreateConsorcioCardInput,
} from '@/types/consorcio';

const formSchema = z.object({
  tipo_pessoa: z.enum(['pf', 'pj']),
  
  // Cota
  grupo: z.string().min(1, 'Grupo é obrigatório'),
  cota: z.string().min(1, 'Cota é obrigatória'),
  valor_credito: z.number().min(1, 'Valor do crédito é obrigatório'),
  prazo_meses: z.number().min(1, 'Prazo é obrigatório'),
  tipo_produto: z.enum(['select', 'parcelinha']),
  tipo_contrato: z.enum(['normal', 'intercalado']),
  parcelas_pagas_empresa: z.number().min(0),
  data_contratacao: z.date(),
  dia_vencimento: z.number().min(1).max(31),
  origem: z.enum(['socio', 'gr', 'indicacao', 'outros']),
  origem_detalhe: z.string().optional(),
  vendedor_id: z.string().optional(),
  vendedor_name: z.string().optional(),
  
  // PF
  nome_completo: z.string().optional(),
  data_nascimento: z.date().optional().nullable(),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  estado_civil: z.enum(['solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel']).optional().nullable(),
  cpf_conjuge: z.string().optional(),
  endereco_cep: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_numero: z.string().optional(),
  endereco_complemento: z.string().optional(),
  endereco_bairro: z.string().optional(),
  endereco_cidade: z.string().optional(),
  endereco_estado: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  profissao: z.string().optional(),
  tipo_servidor: z.enum(['estadual', 'federal', 'municipal']).optional().nullable(),
  renda: z.number().optional().nullable(),
  patrimonio: z.number().optional().nullable(),
  pix: z.string().optional(),
  
  // PJ
  razao_social: z.string().optional(),
  cnpj: z.string().optional(),
  natureza_juridica: z.string().optional(),
  inscricao_estadual: z.string().optional(),
  data_fundacao: z.date().optional().nullable(),
  endereco_comercial_cep: z.string().optional(),
  endereco_comercial_rua: z.string().optional(),
  endereco_comercial_numero: z.string().optional(),
  endereco_comercial_complemento: z.string().optional(),
  endereco_comercial_bairro: z.string().optional(),
  endereco_comercial_cidade: z.string().optional(),
  endereco_comercial_estado: z.string().optional(),
  telefone_comercial: z.string().optional(),
  email_comercial: z.string().email().optional().or(z.literal('')),
  faturamento_mensal: z.number().optional().nullable(),
  num_funcionarios: z.number().optional().nullable(),
  
  // Partners
  partners: z.array(z.object({
    nome: z.string(),
    cpf: z.string(),
    renda: z.number().optional(),
  })).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ConsorcioCardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConsorcioCardForm({ open, onOpenChange }: ConsorcioCardFormProps) {
  const [activeTab, setActiveTab] = useState('cota');
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingCepComercial, setLoadingCepComercial] = useState(false);
  
  const { data: employees } = useEmployees();
  const createCard = useCreateConsorcioCard();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      tipo_pessoa: 'pf',
      tipo_produto: 'select',
      tipo_contrato: 'normal',
      parcelas_pagas_empresa: 0,
      dia_vencimento: 10,
      origem: 'socio',
      partners: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'partners',
  });

  const tipoPessoa = form.watch('tipo_pessoa');
  const estadoCivil = form.watch('estado_civil');
  const profissao = form.watch('profissao');

  // Handle CEP lookup for PF
  const handleCepBlur = async (cep: string) => {
    if (cep.replace(/\D/g, '').length !== 8) return;
    
    setLoadingCep(true);
    const endereco = await buscarCep(cep);
    setLoadingCep(false);
    
    if (endereco) {
      form.setValue('endereco_rua', endereco.rua);
      form.setValue('endereco_bairro', endereco.bairro);
      form.setValue('endereco_cidade', endereco.cidade);
      form.setValue('endereco_estado', endereco.estado);
    }
  };

  // Handle CEP lookup for PJ
  const handleCepComercialBlur = async (cep: string) => {
    if (cep.replace(/\D/g, '').length !== 8) return;
    
    setLoadingCepComercial(true);
    const endereco = await buscarCep(cep);
    setLoadingCepComercial(false);
    
    if (endereco) {
      form.setValue('endereco_comercial_rua', endereco.rua);
      form.setValue('endereco_comercial_bairro', endereco.bairro);
      form.setValue('endereco_comercial_cidade', endereco.cidade);
      form.setValue('endereco_comercial_estado', endereco.estado);
    }
  };

  const onSubmit = async (data: FormData) => {
    const input: CreateConsorcioCardInput = {
      tipo_pessoa: data.tipo_pessoa,
      grupo: data.grupo,
      cota: data.cota,
      valor_credito: data.valor_credito,
      prazo_meses: data.prazo_meses,
      tipo_produto: data.tipo_produto,
      tipo_contrato: data.tipo_contrato,
      parcelas_pagas_empresa: data.parcelas_pagas_empresa,
      data_contratacao: format(data.data_contratacao, 'yyyy-MM-dd'),
      dia_vencimento: data.dia_vencimento,
      origem: data.origem,
      origem_detalhe: data.origem_detalhe,
      vendedor_id: data.vendedor_id,
      vendedor_name: data.vendedor_name,
      nome_completo: data.nome_completo,
      data_nascimento: data.data_nascimento ? format(data.data_nascimento, 'yyyy-MM-dd') : undefined,
      cpf: data.cpf,
      rg: data.rg,
      estado_civil: data.estado_civil || undefined,
      cpf_conjuge: data.cpf_conjuge,
      endereco_cep: data.endereco_cep,
      endereco_rua: data.endereco_rua,
      endereco_numero: data.endereco_numero,
      endereco_complemento: data.endereco_complemento,
      endereco_bairro: data.endereco_bairro,
      endereco_cidade: data.endereco_cidade,
      endereco_estado: data.endereco_estado,
      telefone: data.telefone,
      email: data.email,
      profissao: data.profissao,
      tipo_servidor: data.tipo_servidor || undefined,
      renda: data.renda || undefined,
      patrimonio: data.patrimonio || undefined,
      pix: data.pix,
      razao_social: data.razao_social,
      cnpj: data.cnpj,
      natureza_juridica: data.natureza_juridica,
      inscricao_estadual: data.inscricao_estadual,
      data_fundacao: data.data_fundacao ? format(data.data_fundacao, 'yyyy-MM-dd') : undefined,
      endereco_comercial_cep: data.endereco_comercial_cep,
      endereco_comercial_rua: data.endereco_comercial_rua,
      endereco_comercial_numero: data.endereco_comercial_numero,
      endereco_comercial_complemento: data.endereco_comercial_complemento,
      endereco_comercial_bairro: data.endereco_comercial_bairro,
      endereco_comercial_cidade: data.endereco_comercial_cidade,
      endereco_comercial_estado: data.endereco_comercial_estado,
      telefone_comercial: data.telefone_comercial,
      email_comercial: data.email_comercial,
      faturamento_mensal: data.faturamento_mensal || undefined,
      num_funcionarios: data.num_funcionarios || undefined,
      partners: (data.partners || []).filter(p => p.nome && p.cpf) as Array<{ nome: string; cpf: string; renda?: number }>,
    };

    await createCard.mutateAsync(input);
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Carta de Consórcio</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Tipo de Pessoa */}
            <FormField
              control={form.control}
              name="tipo_pessoa"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Pessoa</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Física</SelectItem>
                      <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="cota">Dados da Cota</TabsTrigger>
                <TabsTrigger value="dados">
                  {tipoPessoa === 'pf' ? 'Dados Pessoais' : 'Dados da Empresa'}
                </TabsTrigger>
                {tipoPessoa === 'pj' && (
                  <TabsTrigger value="socios">Sócios</TabsTrigger>
                )}
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
              </TabsList>

              {/* Tab: Dados da Cota */}
              <TabsContent value="cota" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="grupo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grupo *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: A" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cota"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cota *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ex: 101" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="valor_credito"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Valor do Crédito *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            placeholder="50000"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="prazo_meses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prazo (meses) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            placeholder="120"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tipo_produto"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Produto *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="select">Select</SelectItem>
                            <SelectItem value="parcelinha">Parcelinha</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tipo_contrato"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Contrato *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="intercalado">Intercalado</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="parcelas_pagas_empresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Parcelas pagas pela empresa</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                            placeholder="0"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="dia_vencimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dia de Vencimento *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            {...field}
                            onChange={e => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_contratacao"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data de Contratação *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                ) : (
                                  <span>Selecione</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              locale={ptBR}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="origem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Origem *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {ORIGEM_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="origem_detalhe"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Detalhe da Origem</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Nome do sócio, campanha, etc." />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vendedor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendedor Responsável</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          const emp = employees?.find(e => e.id === value);
                          form.setValue('vendedor_name', emp?.nome_completo || '');
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees?.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.nome_completo}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </TabsContent>

              {/* Tab: Dados Pessoais (PF) */}
              {tipoPessoa === 'pf' && (
                <TabsContent value="dados" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="nome_completo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cpf"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="000.000.000-00" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rg"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>RG</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="data_nascimento"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de Nascimento</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                  ) : (
                                    <span>Selecione</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="estado_civil"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado Civil</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {ESTADO_CIVIL_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>

                  {estadoCivil === 'casado' && (
                    <FormField
                      control={form.control}
                      name="cpf_conjuge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF do Cônjuge</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="000.000.000-00" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="telefone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(11) 99999-9999" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="profissao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Profissão</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Ex: Servidor Público" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {profissao?.toLowerCase().includes('servidor') && (
                      <FormField
                        control={form.control}
                        name="tipo_servidor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Servidor</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {TIPO_SERVIDOR_OPTIONS.map(opt => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="renda"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Renda</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="patrimonio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Patrimônio</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="pix"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Chave PIX</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              )}

              {/* Tab: Dados da Empresa (PJ) */}
              {tipoPessoa === 'pj' && (
                <TabsContent value="dados" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="razao_social"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Razão Social *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CNPJ *</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="00.000.000/0000-00" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="inscricao_estadual"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inscrição Estadual</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="natureza_juridica"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Natureza Jurídica</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="data_fundacao"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Data de Fundação</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    'w-full pl-3 text-left font-normal',
                                    !field.value && 'text-muted-foreground'
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, 'dd/MM/yyyy', { locale: ptBR })
                                  ) : (
                                    <span>Selecione</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value || undefined}
                                onSelect={field.onChange}
                                locale={ptBR}
                              />
                            </PopoverContent>
                          </Popover>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="telefone_comercial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone Comercial</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="(11) 3333-3333" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email_comercial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Comercial</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="faturamento_mensal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Faturamento Mensal</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="num_funcionarios"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número de Funcionários</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              value={field.value ?? ''}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              )}

              {/* Tab: Sócios (PJ only) */}
              {tipoPessoa === 'pj' && (
                <TabsContent value="socios" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Sócios</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ nome: '', cpf: '', renda: undefined })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar Sócio
                    </Button>
                  </div>

                  {fields.map((field, index) => (
                    <div key={field.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Sócio {index + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <FormField
                          control={form.control}
                          name={`partners.${index}.nome`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome *</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partners.${index}.cpf`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPF *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="000.000.000-00" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`partners.${index}.renda`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Renda</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  ))}

                  {fields.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhum sócio adicionado. Clique em "Adicionar Sócio" para incluir.
                    </p>
                  )}
                </TabsContent>
              )}

              {/* Tab: Endereço */}
              <TabsContent value="endereco" className="space-y-4">
                {tipoPessoa === 'pf' ? (
                  <>
                    <FormField
                      control={form.control}
                      name="endereco_cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="00000-000"
                                onBlur={(e) => {
                                  field.onBlur();
                                  handleCepBlur(e.target.value);
                                }}
                              />
                            </FormControl>
                            {loadingCep && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_rua"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_complemento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_estado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Input {...field} maxLength={2} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="font-medium">Endereço Comercial</h3>
                    <FormField
                      control={form.control}
                      name="endereco_comercial_cep"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="00000-000"
                                onBlur={(e) => {
                                  field.onBlur();
                                  handleCepComercialBlur(e.target.value);
                                }}
                              />
                            </FormControl>
                            {loadingCepComercial && <Loader2 className="h-4 w-4 animate-spin" />}
                          </div>
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_comercial_rua"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Rua</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_comercial_numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_comercial_complemento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_comercial_bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="endereco_comercial_cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco_comercial_estado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Input {...field} maxLength={2} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-4 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createCard.isPending}>
                {createCard.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Cadastrar Carta
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
