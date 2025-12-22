import { useState } from 'react';
import { useWhatsAppInstance } from '@/hooks/useWhatsAppInstance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  Wifi, 
  WifiOff, 
  QrCode, 
  RefreshCw, 
  Power,
  Phone,
  CheckCircle2,
  XCircle,
  Loader2
} from 'lucide-react';

export function WhatsAppConfigCard() {
  const { 
    instance, 
    isLoading, 
    isConnecting, 
    qrCode, 
    isConnected,
    checkStatus, 
    getQrCode, 
    disconnect, 
    restart 
  } = useWhatsAppInstance();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <MessageSquare className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-lg">WhatsApp Z-API</CardTitle>
              <CardDescription>
                Integração para atendimento via WhatsApp
              </CardDescription>
            </div>
          </div>
          <Badge variant={isConnected ? 'default' : 'secondary'} className="gap-1">
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                Desconectado
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Número:</span>
            <span className="font-medium">
              {instance?.phone_number || 'Não conectado'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-muted-foreground">Status:</span>
            <span className="font-medium capitalize">
              {instance?.status || 'desconectado'}
            </span>
          </div>
        </div>

        {/* QR Code Display */}
        {qrCode && !isConnected && (
          <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-white">
            <p className="text-sm text-muted-foreground text-center">
              Escaneie o QR Code com seu WhatsApp
            </p>
            <img 
              src={qrCode} 
              alt="QR Code WhatsApp" 
              className="w-48 h-48 border rounded"
            />
            <p className="text-xs text-muted-foreground text-center">
              Aguardando conexão...
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {!isConnected ? (
            <>
              <Button 
                onClick={getQrCode} 
                disabled={isConnecting}
                className="gap-2"
              >
                {isConnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4" />
                )}
                Obter QR Code
              </Button>
              <Button 
                variant="outline" 
                onClick={checkStatus} 
                disabled={isConnecting}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Verificar Status
              </Button>
            </>
          ) : (
            <>
              <Button 
                variant="outline" 
                onClick={checkStatus} 
                disabled={isConnecting}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Atualizar Status
              </Button>
              <Button 
                variant="outline" 
                onClick={restart} 
                disabled={isConnecting}
                className="gap-2"
              >
                <Power className="h-4 w-4" />
                Reiniciar
              </Button>
              <Button 
                variant="destructive" 
                onClick={disconnect} 
                disabled={isConnecting}
                className="gap-2"
              >
                <WifiOff className="h-4 w-4" />
                Desconectar
              </Button>
            </>
          )}
        </div>

        {/* Connection Instructions */}
        {!isConnected && !qrCode && (
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-1">Como conectar:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Clique em "Obter QR Code"</li>
              <li>Abra o WhatsApp no seu celular</li>
              <li>Vá em Configurações → Dispositivos conectados</li>
              <li>Escaneie o QR Code exibido</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
