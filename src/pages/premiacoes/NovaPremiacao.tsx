import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Trophy, Save, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { DatePickerCustom } from '@/components/ui/DatePickerCustom';
import { useCreatePremiacao } from '@/hooks/usePremiacoes';
import { PremiacaoFormData, METRICAS_OPTIONS, CARGOS_ELEGIVEIS_OPTIONS, TipoCompeticao, MetricaRanking } from '@/types/premiacoes';
import { BU_OPTIONS, BusinessUnit } from '@/hooks/useMyBU';
import { useActiveBU } from '@/hooks/useActiveBU';

const formSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  descricao: z.string().optional(),
  premio_descricao: z.string().min(1, 'Descrição do prêmio é obrigatória'),
  premio_valor: z.coerce.number().optional(),
  bu: z.string().min(1, 'Selecione uma BU'),
  cargos_elegiveis: z.array(z.string()).min(1, 'Selecione pelo menos um cargo'),
  tipo_competicao: z.enum(['individual', 'equipe', 'ambos']),
  metrica_ranking: z.string().min(1, 'Selecione uma métrica'),
  data_inicio: z.date({ required_error: 'Data de início é obrigatória' }),
  data_fim: z.date({ required_error: 'Data de fim é obrigatória' }),
  qtd_ganhadores: z.coerce.number().min(1, 'Mínimo 1 ganhador').max(100, 'Máximo 100 ganhadores'),
});

type FormData = z.infer<typeof formSchema>;

export default function NovaPremiacao() {
  const navigate = useNavigate();
  const activeBU = useActiveBU();
  const createMutation = useCreatePremiacao();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: '',
      descricao: '',
      premio_descricao: '',
      premio_valor: undefined,
      bu: activeBU || '',
      cargos_elegiveis: [],
      tipo_competicao: 'individual',
      metrica_ranking: 'agendamentos',
      qtd_ganhadores: 3,
    },
  });

  const onSubmit = async (data: FormData) => {
    const formData: PremiacaoFormData = {
      nome: data.nome,
      descricao: data.descricao || '',
      premio_descricao: data.premio_descricao,
      premio_valor: data.premio_valor,
      bu: data.bu as BusinessUnit,
      cargos_elegiveis: data.cargos_elegiveis,
      tipo_competicao: data.tipo_competicao as TipoCompeticao,
      metrica_ranking: data.metrica_ranking as MetricaRanking,
      metrica_config: {},
      data_inicio: data.data_inicio,
      data_fim: data.data_fim,
      qtd_ganhadores: data.qtd_ganhadores,
    };

    createMutation.mutate(formData, {
      onSuccess: (result) => {
        navigate(`/premiacoes/${result.id}`);
      },
    });
  };

  return (
    <div className="container mx-auto py-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/premiacoes">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-yellow-500" />
            Nova Premiação
          </h1>
          <p className="text-muted-foreground">Configure uma nova campanha de premiação</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Nome, descrição e detalhes do prêmio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Premiação</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Desafio Top SDR Janeiro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="descricao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição (opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descreva as regras e objetivos da premiação..." 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="premio_descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição do Prêmio</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Voucher de R$ 500" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="premio_valor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Prêmio (opcional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="500" 
                          {...field}
                          value={field.value ?? ''}
                        />
                      </FormControl>
                      <FormDescription>Em reais (R$)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Participantes */}
          <Card>
            <CardHeader>
              <CardTitle>Participantes</CardTitle>
              <CardDescription>Defina quem pode participar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="bu"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Unit</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a BU" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {BU_OPTIONS.filter(bu => bu.value).map(bu => (
                          <SelectItem key={bu.value} value={bu.value}>
                            {bu.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cargos_elegiveis"
                render={() => (
                  <FormItem>
                    <FormLabel>Cargos Elegíveis</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {CARGOS_ELEGIVEIS_OPTIONS.map((cargo) => (
                        <FormField
                          key={cargo.value}
                          control={form.control}
                          name="cargos_elegiveis"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(cargo.value)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, cargo.value]);
                                    } else {
                                      field.onChange(field.value?.filter((v: string) => v !== cargo.value));
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {cargo.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tipo_competicao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Competição</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="individual" id="individual" />
                          <Label htmlFor="individual">Individual</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="equipe" id="equipe" />
                          <Label htmlFor="equipe">Por Equipe</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ambos" id="ambos" />
                          <Label htmlFor="ambos">Ambos</Label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Período e Métricas */}
          <Card>
            <CardHeader>
              <CardTitle>Período e Métricas</CardTitle>
              <CardDescription>Defina o período e critério de ranking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="data_inicio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Início</FormLabel>
                      <FormControl>
                        <DatePickerCustom
                          selected={field.value}
                          onSelect={field.onChange}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="data_fim"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Fim</FormLabel>
                      <FormControl>
                        <DatePickerCustom
                          selected={field.value}
                          onSelect={field.onChange}
                          placeholder="Selecione a data"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="metrica_ranking"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Métrica de Ranking</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a métrica" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {METRICAS_OPTIONS.map(metrica => (
                          <SelectItem key={metrica.value} value={metrica.value}>
                            <div className="flex flex-col">
                              <span>{metrica.label}</span>
                              <span className="text-xs text-muted-foreground">{metrica.descricao}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="qtd_ganhadores"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantidade de Ganhadores</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={100} 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Quantos participantes serão premiados (Top N)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link to="/premiacoes">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              <Save className="h-4 w-4 mr-2" />
              {createMutation.isPending ? 'Salvando...' : 'Criar Premiação'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
