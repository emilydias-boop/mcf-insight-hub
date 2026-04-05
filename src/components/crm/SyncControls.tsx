// DESATIVADO 05/04/2026 - Clint integração encerrada
// Leads chegam via Hubla webhook direto. Clint estava gerando duplicatas por race condition.

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export const SyncControls = () => {
  const disabledMessage = "Integração Clint encerrada";

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Sincronização com Clint CRM
          <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-normal">
            Desativado
          </span>
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Integração encerrada — leads chegam via Hubla webhook direto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Integração Clint encerrada em 05/04/2026. Todos os leads já chegam via webhook direto da Hubla.
          </AlertDescription>
        </Alert>

        <TooltipProvider>
          <div className="grid grid-cols-2 gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled className="w-full opacity-50">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Importar Contatos
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{disabledMessage}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled className="w-full opacity-50">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Importar Deals
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{disabledMessage}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled variant="secondary" className="w-full opacity-50">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Vincular Contatos
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{disabledMessage}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled variant="outline" className="w-full opacity-50">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync Manual
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{disabledMessage}</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};
