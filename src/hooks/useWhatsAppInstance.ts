import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppInstance {
  id: string;
  instance_id: string;
  token: string;
  client_token: string | null;
  name: string;
  status: string;
  phone_number: string | null;
  connected_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useWhatsAppInstance() {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch instance
  const fetchInstance = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setInstance(data);
    } catch (error) {
      console.error('Error fetching instance:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check status
  const checkStatus = useCallback(async () => {
    try {
      setIsConnecting(true);
      console.log('[WhatsApp] Checking status...');
      
      const { data, error } = await supabase.functions.invoke('zapi-status', {
        body: { action: 'status' },
      });

      console.log('[WhatsApp] Status response:', data, error);

      if (error) throw error;

      // IMPORTANTE: Priorizar connected: true sobre qualquer error
      // Z-API retorna error: "You are already connected" mesmo quando conectado!
      if (data?.connected) {
        toast.success('WhatsApp conectado!');
        fetchInstance();
        return data;
      }

      // Só mostrar erro se realmente não conectado
      if (data?.error) {
        toast.error(`Erro Z-API: ${data.error}`);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[WhatsApp] Error checking status:', error);
      toast.error('Erro ao verificar status');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [fetchInstance]);

  // Get QR Code
  const getQrCode = useCallback(async () => {
    try {
      setIsConnecting(true);
      toast.loading('Obtendo QR Code...', { id: 'qrcode-loading' });
      console.log('[WhatsApp] Getting QR Code...');
      
      const { data, error } = await supabase.functions.invoke('zapi-status', {
        body: { action: 'qrcode' },
      });

      console.log('[WhatsApp] QR Code response:', data, error);
      toast.dismiss('qrcode-loading');

      if (error) throw error;

      // IMPORTANTE: Se já conectado, tratar como sucesso
      if (data?.connected || data?.alreadyConnected) {
        toast.success('WhatsApp já está conectado!');
        setQrCode(null);
        fetchInstance();
        return data;
      }

      // Só mostrar erro se não tiver QR Code disponível
      if (data?.error && !data?.imageUrl && !data?.value) {
        toast.error(`Erro Z-API: ${data.error}`);
        return null;
      }

      if (data?.imageUrl) {
        setQrCode(data.imageUrl);
        toast.success('QR Code obtido!');
      } else if (data?.base64 || data?.qrcode || data?.value) {
        const base64Value = data.value || data.base64 || data.qrcode;
        setQrCode(`data:image/png;base64,${base64Value}`);
        toast.success('QR Code obtido!');
      } else {
        toast.error('QR Code não disponível. Verifique se a instância está desconectada.');
      }

      return data;
    } catch (error) {
      console.error('[WhatsApp] Error getting QR code:', error);
      toast.dismiss('qrcode-loading');
      toast.error('Erro ao obter QR Code');
      return null;
    } finally {
      setIsConnecting(false);
    }
  }, [fetchInstance]);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      setIsConnecting(true);
      toast.loading('Desconectando...', { id: 'disconnect-loading' });
      console.log('[WhatsApp] Disconnecting...');
      
      const { data, error } = await supabase.functions.invoke('zapi-status', {
        body: { action: 'disconnect' },
      });

      console.log('[WhatsApp] Disconnect response:', data, error);
      toast.dismiss('disconnect-loading');

      if (error) throw error;

      toast.success('WhatsApp desconectado');
      setInstance(prev => prev ? { ...prev, status: 'disconnected', connected_at: null } : null);
      setQrCode(null);
    } catch (error) {
      console.error('[WhatsApp] Error disconnecting:', error);
      toast.dismiss('disconnect-loading');
      toast.error('Erro ao desconectar');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Restart
  const restart = useCallback(async () => {
    try {
      setIsConnecting(true);
      toast.loading('Reiniciando instância...', { id: 'restart-loading' });
      console.log('[WhatsApp] Restarting...');
      
      const { data, error } = await supabase.functions.invoke('zapi-status', {
        body: { action: 'restart' },
      });

      console.log('[WhatsApp] Restart response:', data, error);
      toast.dismiss('restart-loading');

      if (error) throw error;

      toast.success('Instância reiniciada');
      setTimeout(checkStatus, 3000);
    } catch (error) {
      console.error('[WhatsApp] Error restarting:', error);
      toast.dismiss('restart-loading');
      toast.error('Erro ao reiniciar');
    } finally {
      setIsConnecting(false);
    }
  }, [checkStatus]);

  // Initial fetch
  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  // Auto-check status periodically when connecting
  useEffect(() => {
    if (!qrCode) return;

    const interval = setInterval(async () => {
      const status = await checkStatus();
      if (status?.connected) {
        setQrCode(null);
        clearInterval(interval);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [qrCode, checkStatus]);

  return {
    instance,
    isLoading,
    isConnecting,
    qrCode,
    isConnected: instance?.status === 'connected',
    checkStatus,
    getQrCode,
    disconnect,
    restart,
    refetch: fetchInstance,
  };
}
