export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      a010_link_mappings: {
        Row: {
          channel: string
          created_at: string
          id: string
          is_active: boolean
          match_source: string | null
          match_utm_campaign: string | null
          match_utm_medium: string | null
          match_utm_source: string | null
          name: string
          offer: string
          origin: string
          priority: number
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_source?: string | null
          match_utm_campaign?: string | null
          match_utm_medium?: string | null
          match_utm_source?: string | null
          name: string
          offer: string
          origin: string
          priority?: number
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_source?: string | null
          match_utm_campaign?: string | null
          match_utm_medium?: string | null
          match_utm_source?: string | null
          name?: string
          offer?: string
          origin?: string
          priority?: number
        }
        Relationships: []
      }
      a010_sales: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          net_value: number
          sale_date: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          net_value?: number
          sale_date: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          net_value?: number
          sale_date?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      activity_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          default_due_days: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number
          origin_id: string | null
          script_body: string | null
          script_title: string | null
          sla_offset_minutes: number | null
          stage_id: string | null
          type: Database["public"]["Enums"]["activity_task_type"]
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          default_due_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number
          origin_id?: string | null
          script_body?: string | null
          script_title?: string | null
          sla_offset_minutes?: number | null
          stage_id?: string | null
          type?: Database["public"]["Enums"]["activity_task_type"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          default_due_days?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number
          origin_id?: string | null
          script_body?: string | null
          script_title?: string | null
          sla_offset_minutes?: number | null
          stage_id?: string | null
          type?: Database["public"]["Enums"]["activity_task_type"]
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_templates_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_templates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          alert_level: Database["public"]["Enums"]["alert_level"]
          condition: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          alert_level: Database["public"]["Enums"]["alert_level"]
          condition: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          alert_level?: Database["public"]["Enums"]["alert_level"]
          condition?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      alertas: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          lido: boolean
          metadata: Json | null
          resolvido: boolean
          tipo: string
          titulo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          lido?: boolean
          metadata?: Json | null
          resolvido?: boolean
          tipo: string
          titulo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          lido?: boolean
          metadata?: Json | null
          resolvido?: boolean
          tipo?: string
          titulo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          created_at: string | null
          description: string
          id: string
          is_resolved: boolean | null
          level: Database["public"]["Enums"]["alert_level"]
          resolved_at: string | null
          resolved_by: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description: string
          id?: string
          is_resolved?: boolean | null
          level: Database["public"]["Enums"]["alert_level"]
          resolved_at?: string | null
          resolved_by?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string
          id?: string
          is_resolved?: boolean | null
          level?: Database["public"]["Enums"]["alert_level"]
          resolved_at?: string | null
          resolved_by?: string | null
          title?: string
        }
        Relationships: []
      }
      areas_catalogo: {
        Row: {
          ativo: boolean | null
          codigo: string | null
          created_at: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      asset_assignment_items: {
        Row: {
          assignment_id: string
          conferido_devolucao: boolean | null
          descricao: string | null
          id: string
          item_tipo: string
          observacao_devolucao: string | null
        }
        Insert: {
          assignment_id: string
          conferido_devolucao?: boolean | null
          descricao?: string | null
          id?: string
          item_tipo: string
          observacao_devolucao?: string | null
        }
        Update: {
          assignment_id?: string
          conferido_devolucao?: boolean | null
          descricao?: string | null
          id?: string
          item_tipo?: string
          observacao_devolucao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignment_items_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "asset_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_assignments: {
        Row: {
          asset_id: string
          cargo: string | null
          created_at: string
          created_by: string | null
          data_devolucao_real: string | null
          data_liberacao: string
          data_prevista_devolucao: string | null
          employee_id: string
          id: string
          setor: string | null
          status: Database["public"]["Enums"]["assignment_status"]
          termo_id: string | null
        }
        Insert: {
          asset_id: string
          cargo?: string | null
          created_at?: string
          created_by?: string | null
          data_devolucao_real?: string | null
          data_liberacao?: string
          data_prevista_devolucao?: string | null
          employee_id: string
          id?: string
          setor?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          termo_id?: string | null
        }
        Update: {
          asset_id?: string
          cargo?: string | null
          created_at?: string
          created_by?: string | null
          data_devolucao_real?: string | null
          data_liberacao?: string
          data_prevista_devolucao?: string | null
          employee_id?: string
          id?: string
          setor?: string | null
          status?: Database["public"]["Enums"]["assignment_status"]
          termo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_assignments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_assignments_termo_id_fkey"
            columns: ["termo_id"]
            isOneToOne: false
            referencedRelation: "asset_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_history: {
        Row: {
          asset_id: string
          created_at: string
          created_by: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          tipo_evento: Database["public"]["Enums"]["asset_event_type"]
        }
        Insert: {
          asset_id: string
          created_at?: string
          created_by?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          tipo_evento: Database["public"]["Enums"]["asset_event_type"]
        }
        Update: {
          asset_id?: string
          created_at?: string
          created_by?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          tipo_evento?: Database["public"]["Enums"]["asset_event_type"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_terms: {
        Row: {
          aceito: boolean | null
          asset_id: string
          assignment_id: string | null
          assinatura_digital: string | null
          bloqueado: boolean | null
          created_at: string
          data_aceite: string | null
          employee_id: string
          id: string
          ip_aceite: string | null
          storage_path: string | null
          termo_conteudo: string
          user_agent: string | null
          versao: number | null
        }
        Insert: {
          aceito?: boolean | null
          asset_id: string
          assignment_id?: string | null
          assinatura_digital?: string | null
          bloqueado?: boolean | null
          created_at?: string
          data_aceite?: string | null
          employee_id: string
          id?: string
          ip_aceite?: string | null
          storage_path?: string | null
          termo_conteudo: string
          user_agent?: string | null
          versao?: number | null
        }
        Update: {
          aceito?: boolean | null
          asset_id?: string
          assignment_id?: string | null
          assinatura_digital?: string | null
          bloqueado?: boolean | null
          created_at?: string
          data_aceite?: string | null
          employee_id?: string
          id?: string
          ip_aceite?: string | null
          storage_path?: string | null
          termo_conteudo?: string
          user_agent?: string | null
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_terms_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_terms_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "asset_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_terms_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          centro_custo: string | null
          created_at: string
          created_by: string | null
          data_compra: string | null
          fornecedor: string | null
          garantia_fim: string | null
          garantia_inicio: string | null
          id: string
          localizacao: string | null
          marca: string | null
          modelo: string | null
          nota_fiscal_path: string | null
          nota_fiscal_url: string | null
          numero_patrimonio: string
          numero_serie: string | null
          observacoes: string | null
          sistema_operacional: string | null
          status: Database["public"]["Enums"]["asset_status"]
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at: string
        }
        Insert: {
          centro_custo?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string | null
          fornecedor?: string | null
          garantia_fim?: string | null
          garantia_inicio?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          modelo?: string | null
          nota_fiscal_path?: string | null
          nota_fiscal_url?: string | null
          numero_patrimonio: string
          numero_serie?: string | null
          observacoes?: string | null
          sistema_operacional?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Update: {
          centro_custo?: string | null
          created_at?: string
          created_by?: string | null
          data_compra?: string | null
          fornecedor?: string | null
          garantia_fim?: string | null
          garantia_inicio?: string | null
          id?: string
          localizacao?: string | null
          marca?: string | null
          modelo?: string | null
          nota_fiscal_path?: string | null
          nota_fiscal_url?: string | null
          numero_patrimonio?: string
          numero_serie?: string | null
          observacoes?: string | null
          sistema_operacional?: string | null
          status?: Database["public"]["Enums"]["asset_status"]
          tipo?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
        }
        Relationships: []
      }
      attendee_movement_logs: {
        Row: {
          attendee_id: string
          created_at: string | null
          from_closer_id: string | null
          from_closer_name: string | null
          from_scheduled_at: string | null
          from_slot_id: string | null
          id: string
          moved_by: string | null
          moved_by_name: string | null
          moved_by_role: string | null
          movement_type: string
          previous_status: string | null
          reason: string | null
          to_closer_id: string | null
          to_closer_name: string | null
          to_scheduled_at: string
          to_slot_id: string
        }
        Insert: {
          attendee_id: string
          created_at?: string | null
          from_closer_id?: string | null
          from_closer_name?: string | null
          from_scheduled_at?: string | null
          from_slot_id?: string | null
          id?: string
          moved_by?: string | null
          moved_by_name?: string | null
          moved_by_role?: string | null
          movement_type: string
          previous_status?: string | null
          reason?: string | null
          to_closer_id?: string | null
          to_closer_name?: string | null
          to_scheduled_at: string
          to_slot_id: string
        }
        Update: {
          attendee_id?: string
          created_at?: string | null
          from_closer_id?: string | null
          from_closer_name?: string | null
          from_scheduled_at?: string | null
          from_slot_id?: string | null
          id?: string
          moved_by?: string | null
          moved_by_name?: string | null
          moved_by_role?: string | null
          movement_type?: string
          previous_status?: string | null
          reason?: string | null
          to_closer_id?: string | null
          to_closer_name?: string | null
          to_scheduled_at?: string
          to_slot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendee_movement_logs_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "meeting_slot_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_movement_logs_from_slot_id_fkey"
            columns: ["from_slot_id"]
            isOneToOne: false
            referencedRelation: "meeting_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_movement_logs_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendee_movement_logs_moved_by_fkey"
            columns: ["moved_by"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "attendee_movement_logs_to_slot_id_fkey"
            columns: ["to_slot_id"]
            isOneToOne: false
            referencedRelation: "meeting_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      attendee_notes: {
        Row: {
          attendee_id: string
          created_at: string | null
          created_by: string | null
          id: string
          note: string
          note_type: string | null
        }
        Insert: {
          attendee_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note: string
          note_type?: string | null
        }
        Update: {
          attendee_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string
          note_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendee_notes_attendee_id_fkey"
            columns: ["attendee_id"]
            isOneToOne: false
            referencedRelation: "meeting_slot_attendees"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_bids: {
        Row: {
          auction_id: string
          bid_amount: number
          bidder_name: string
          created_at: string | null
          id: string
        }
        Insert: {
          auction_id: string
          bid_amount: number
          bidder_name: string
          created_at?: string | null
          id?: string
        }
        Update: {
          auction_id?: string
          bid_amount?: number
          bidder_name?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          address: string
          created_at: string | null
          created_by: string | null
          current_bid: number | null
          end_date: string
          id: string
          image_url: string | null
          initial_value: number
          property_name: string
          start_date: string
          status: Database["public"]["Enums"]["auction_status"] | null
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          created_by?: string | null
          current_bid?: number | null
          end_date: string
          id?: string
          image_url?: string | null
          initial_value: number
          property_name: string
          start_date: string
          status?: Database["public"]["Enums"]["auction_status"] | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          created_by?: string | null
          current_bid?: number | null
          end_date?: string
          id?: string
          image_url?: string | null
          initial_value?: number
          property_name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["auction_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auditoria_fechamento: {
        Row: {
          acao: string
          antes_json: Json | null
          created_at: string
          depois_json: Json | null
          entidade: string
          entidade_id: string
          id: string
          motivo: string | null
          usuario_id: string | null
        }
        Insert: {
          acao: string
          antes_json?: Json | null
          created_at?: string
          depois_json?: Json | null
          entidade: string
          entidade_id: string
          id?: string
          motivo?: string | null
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          antes_json?: Json | null
          created_at?: string
          depois_json?: Json | null
          entidade?: string
          entidade_id?: string
          id?: string
          motivo?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      automation_blacklist: {
        Row: {
          channel: Database["public"]["Enums"]["automation_channel"] | null
          contact_id: string | null
          created_at: string | null
          email: string | null
          id: string
          phone: string | null
          reason: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["automation_channel"] | null
          contact_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["automation_channel"] | null
          contact_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_blacklist_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_flows: {
        Row: {
          business_hours_end: string | null
          business_hours_start: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          exclude_weekends: boolean | null
          id: string
          is_active: boolean | null
          name: string
          origin_id: string | null
          respect_business_hours: boolean | null
          stage_id: string | null
          trigger_on: Database["public"]["Enums"]["automation_trigger"] | null
          updated_at: string | null
        }
        Insert: {
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exclude_weekends?: boolean | null
          id?: string
          is_active?: boolean | null
          name: string
          origin_id?: string | null
          respect_business_hours?: boolean | null
          stage_id?: string | null
          trigger_on?: Database["public"]["Enums"]["automation_trigger"] | null
          updated_at?: string | null
        }
        Update: {
          business_hours_end?: string | null
          business_hours_start?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          exclude_weekends?: boolean | null
          id?: string
          is_active?: boolean | null
          name?: string
          origin_id?: string | null
          respect_business_hours?: boolean | null
          stage_id?: string | null
          trigger_on?: Database["public"]["Enums"]["automation_trigger"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_flows_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_flows_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          channel: Database["public"]["Enums"]["automation_channel"]
          contact_id: string | null
          content_sent: string | null
          created_at: string | null
          deal_id: string | null
          delivered_at: string | null
          error_message: string | null
          external_id: string | null
          external_status: string | null
          flow_id: string | null
          id: string
          metadata: Json | null
          read_at: string | null
          recipient: string
          replied_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["automation_status"]
          step_id: string | null
          template_id: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["automation_channel"]
          contact_id?: string | null
          content_sent?: string | null
          created_at?: string | null
          deal_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          external_status?: string | null
          flow_id?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          recipient: string
          replied_at?: string | null
          sent_at?: string | null
          status: Database["public"]["Enums"]["automation_status"]
          step_id?: string | null
          template_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["automation_channel"]
          contact_id?: string | null
          content_sent?: string | null
          created_at?: string | null
          deal_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_id?: string | null
          external_status?: string | null
          flow_id?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          recipient?: string
          replied_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["automation_status"]
          step_id?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "automation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_queue: {
        Row: {
          attempts: number | null
          contact_id: string | null
          created_at: string | null
          deal_id: string
          error_message: string | null
          flow_id: string
          id: string
          last_attempt_at: string | null
          processed_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["automation_status"] | null
          step_id: string
        }
        Insert: {
          attempts?: number | null
          contact_id?: string | null
          created_at?: string | null
          deal_id: string
          error_message?: string | null
          flow_id: string
          id?: string
          last_attempt_at?: string | null
          processed_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["automation_status"] | null
          step_id: string
        }
        Update: {
          attempts?: number | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string
          error_message?: string | null
          flow_id?: string
          id?: string
          last_attempt_at?: string | null
          processed_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["automation_status"] | null
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "automation_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      automation_steps: {
        Row: {
          channel: Database["public"]["Enums"]["automation_channel"]
          conditions: Json | null
          created_at: string | null
          delay_days: number | null
          delay_hours: number | null
          delay_minutes: number | null
          flow_id: string
          id: string
          is_active: boolean | null
          order_index: number | null
          template_id: string
          updated_at: string | null
        }
        Insert: {
          channel: Database["public"]["Enums"]["automation_channel"]
          conditions?: Json | null
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          delay_minutes?: number | null
          flow_id: string
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          template_id: string
          updated_at?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["automation_channel"]
          conditions?: Json | null
          created_at?: string | null
          delay_days?: number | null
          delay_hours?: number | null
          delay_minutes?: number | null
          flow_id?: string
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          template_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_steps_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "automation_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "automation_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_templates: {
        Row: {
          activecampaign_template_id: string | null
          channel: Database["public"]["Enums"]["automation_channel"]
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string | null
          twilio_template_sid: string | null
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          activecampaign_template_id?: string | null
          channel: Database["public"]["Enums"]["automation_channel"]
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject?: string | null
          twilio_template_sid?: string | null
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          activecampaign_template_id?: string | null
          channel?: Database["public"]["Enums"]["automation_channel"]
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string | null
          twilio_template_sid?: string | null
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
      bu_origin_mapping: {
        Row: {
          bu: string
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          is_default: boolean | null
          updated_at: string | null
        }
        Insert: {
          bu: string
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          is_default?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bu?: string
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          is_default?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bu_strategic_documents: {
        Row: {
          ano: number
          bu: string
          created_at: string
          id: string
          mes: number
          nome_arquivo: string
          semana: number
          storage_path: string
          uploaded_by: string | null
          uploaded_by_name: string | null
          uploaded_by_role: string | null
        }
        Insert: {
          ano: number
          bu: string
          created_at?: string
          id?: string
          mes: number
          nome_arquivo: string
          semana: number
          storage_path: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          uploaded_by_role?: string | null
        }
        Update: {
          ano?: number
          bu?: string
          created_at?: string
          id?: string
          mes?: number
          nome_arquivo?: string
          semana?: number
          storage_path?: string
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          uploaded_by_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bu_strategic_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bu_strategic_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bu_webhook_logs: {
        Row: {
          bu_type: string
          created_at: string | null
          error_message: string | null
          event_type: string | null
          id: string
          payload: Json
          processed_at: string | null
          record_id: string | null
          status: string | null
        }
        Insert: {
          bu_type: string
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          record_id?: string | null
          status?: string | null
        }
        Update: {
          bu_type?: string
          created_at?: string | null
          error_message?: string | null
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          record_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      calls: {
        Row: {
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          direction: string | null
          duration_seconds: number | null
          ended_at: string | null
          from_number: string | null
          id: string
          notes: string | null
          origin_id: string | null
          outcome: string | null
          recording_url: string | null
          started_at: string | null
          status: string | null
          to_number: string
          twilio_call_sid: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          direction?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          notes?: string | null
          origin_id?: string | null
          outcome?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          to_number: string
          twilio_call_sid?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          direction?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          from_number?: string | null
          id?: string
          notes?: string | null
          origin_id?: string | null
          outcome?: string | null
          recording_url?: string | null
          started_at?: string | null
          status?: string | null
          to_number?: string
          twilio_call_sid?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_metricas_config: {
        Row: {
          ativo: boolean | null
          cargo_catalogo_id: string
          created_at: string | null
          fonte_dados: string | null
          id: string
          label_exibicao: string
          meta_padrao: number | null
          nome_metrica: string
          ordem: number | null
          peso_percentual: number | null
          squad: string | null
          tipo_calculo: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo_catalogo_id: string
          created_at?: string | null
          fonte_dados?: string | null
          id?: string
          label_exibicao: string
          meta_padrao?: number | null
          nome_metrica: string
          ordem?: number | null
          peso_percentual?: number | null
          squad?: string | null
          tipo_calculo?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo_catalogo_id?: string
          created_at?: string | null
          fonte_dados?: string | null
          id?: string
          label_exibicao?: string
          meta_padrao?: number | null
          nome_metrica?: string
          ordem?: number | null
          peso_percentual?: number | null
          squad?: string | null
          tipo_calculo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_metricas_config_cargo_catalogo_id_fkey"
            columns: ["cargo_catalogo_id"]
            isOneToOne: false
            referencedRelation: "cargos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_metricas_padrao: {
        Row: {
          ativo: boolean | null
          cargo_catalogo_id: string
          created_at: string | null
          id: string
          label_exibicao: string
          meta_percentual: number | null
          nome_metrica: string
          peso_percentual: number
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo_catalogo_id: string
          created_at?: string | null
          id?: string
          label_exibicao: string
          meta_percentual?: number | null
          nome_metrica: string
          peso_percentual?: number
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo_catalogo_id?: string
          created_at?: string | null
          id?: string
          label_exibicao?: string
          meta_percentual?: number | null
          nome_metrica?: string
          peso_percentual?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_metricas_padrao_cargo_catalogo_id_fkey"
            columns: ["cargo_catalogo_id"]
            isOneToOne: false
            referencedRelation: "cargos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos_catalogo: {
        Row: {
          area: string
          ativo: boolean
          cargo_base: string
          created_at: string
          fixo_valor: number
          id: string
          modelo_variavel: string
          nivel: number | null
          nome_exibicao: string
          ote_total: number
          role_sistema: string | null
          updated_at: string
          variavel_valor: number
        }
        Insert: {
          area: string
          ativo?: boolean
          cargo_base: string
          created_at?: string
          fixo_valor?: number
          id?: string
          modelo_variavel?: string
          nivel?: number | null
          nome_exibicao: string
          ote_total?: number
          role_sistema?: string | null
          updated_at?: string
          variavel_valor?: number
        }
        Update: {
          area?: string
          ativo?: boolean
          cargo_base?: string
          created_at?: string
          fixo_valor?: number
          id?: string
          modelo_variavel?: string
          nivel?: number | null
          nome_exibicao?: string
          ote_total?: number
          role_sistema?: string | null
          updated_at?: string
          variavel_valor?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          type: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          type?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      channels: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      closer_availability: {
        Row: {
          closer_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean | null
          lead_type: string | null
          max_slots_per_hour: number | null
          slot_duration_minutes: number | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          closer_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean | null
          lead_type?: string | null
          max_slots_per_hour?: number | null
          slot_duration_minutes?: number | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          closer_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean | null
          lead_type?: string | null
          max_slots_per_hour?: number | null
          slot_duration_minutes?: number | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closer_availability_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_blocked_dates: {
        Row: {
          blocked_date: string
          blocked_end_time: string | null
          blocked_start_time: string | null
          closer_id: string
          created_at: string | null
          created_by: string | null
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          blocked_end_time?: string | null
          blocked_start_time?: string | null
          closer_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          blocked_end_time?: string | null
          blocked_start_time?: string | null
          closer_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closer_blocked_dates_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
        ]
      }
      closer_commissions: {
        Row: {
          closer_name: string
          commission_rate: number
          created_at: string | null
          fixed_salary: number | null
          id: string
          lead_type: string
          level: number
          quantity_leads: number | null
          updated_at: string | null
        }
        Insert: {
          closer_name: string
          commission_rate: number
          created_at?: string | null
          fixed_salary?: number | null
          id?: string
          lead_type: string
          level: number
          quantity_leads?: number | null
          updated_at?: string | null
        }
        Update: {
          closer_name?: string
          commission_rate?: number
          created_at?: string | null
          fixed_salary?: number | null
          id?: string
          lead_type?: string
          level?: number
          quantity_leads?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      closer_meeting_links: {
        Row: {
          closer_id: string
          created_at: string | null
          day_of_week: number
          google_meet_link: string | null
          id: string
          start_time: string
        }
        Insert: {
          closer_id: string
          created_at?: string | null
          day_of_week: number
          google_meet_link?: string | null
          id?: string
          start_time: string
        }
        Update: {
          closer_id?: string
          created_at?: string | null
          day_of_week?: number
          google_meet_link?: string | null
          id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "closer_meeting_links_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
        ]
      }
      closers: {
        Row: {
          bu: string | null
          calendly_default_link: string | null
          calendly_event_type_uri: string | null
          color: string | null
          created_at: string | null
          email: string
          employee_id: string | null
          google_calendar_enabled: boolean | null
          google_calendar_id: string | null
          id: string
          is_active: boolean | null
          max_leads_per_slot: number | null
          meeting_duration_minutes: number | null
          meeting_type: string | null
          name: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          bu?: string | null
          calendly_default_link?: string | null
          calendly_event_type_uri?: string | null
          color?: string | null
          created_at?: string | null
          email: string
          employee_id?: string | null
          google_calendar_enabled?: boolean | null
          google_calendar_id?: string | null
          id?: string
          is_active?: boolean | null
          max_leads_per_slot?: number | null
          meeting_duration_minutes?: number | null
          meeting_type?: string | null
          name: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          bu?: string | null
          calendly_default_link?: string | null
          calendly_event_type_uri?: string | null
          color?: string | null
          created_at?: string | null
          email?: string
          employee_id?: string | null
          google_calendar_enabled?: boolean | null
          google_calendar_id?: string | null
          id?: string
          is_active?: boolean | null
          max_leads_per_slot?: number | null
          meeting_duration_minutes?: number | null
          meeting_type?: string | null
          name?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "closers_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcio_categoria_options: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          label: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      consorcio_closer_payout: {
        Row: {
          ajustes_json: Json | null
          ano_mes: string
          aprovado_em: string | null
          aprovado_por: string | null
          bonus_autorizado: boolean | null
          bonus_extra: number | null
          closer_id: string
          comissao_consorcio: number | null
          comissao_holding: number | null
          created_at: string | null
          dias_uteis_mes: number | null
          fixo_valor: number | null
          id: string
          meta_comissao_consorcio: number | null
          meta_comissao_holding: number | null
          meta_organizacao: number | null
          mult_comissao_consorcio: number | null
          mult_comissao_holding: number | null
          mult_organizacao: number | null
          nfse_id: string | null
          ote_total: number | null
          pct_comissao_consorcio: number | null
          pct_comissao_holding: number | null
          pct_organizacao: number | null
          score_organizacao: number | null
          status: string | null
          total_conta: number | null
          updated_at: string | null
          valor_comissao_consorcio: number | null
          valor_comissao_holding: number | null
          valor_organizacao: number | null
          valor_variavel_final: number | null
          variavel_total: number | null
        }
        Insert: {
          ajustes_json?: Json | null
          ano_mes: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          bonus_autorizado?: boolean | null
          bonus_extra?: number | null
          closer_id: string
          comissao_consorcio?: number | null
          comissao_holding?: number | null
          created_at?: string | null
          dias_uteis_mes?: number | null
          fixo_valor?: number | null
          id?: string
          meta_comissao_consorcio?: number | null
          meta_comissao_holding?: number | null
          meta_organizacao?: number | null
          mult_comissao_consorcio?: number | null
          mult_comissao_holding?: number | null
          mult_organizacao?: number | null
          nfse_id?: string | null
          ote_total?: number | null
          pct_comissao_consorcio?: number | null
          pct_comissao_holding?: number | null
          pct_organizacao?: number | null
          score_organizacao?: number | null
          status?: string | null
          total_conta?: number | null
          updated_at?: string | null
          valor_comissao_consorcio?: number | null
          valor_comissao_holding?: number | null
          valor_organizacao?: number | null
          valor_variavel_final?: number | null
          variavel_total?: number | null
        }
        Update: {
          ajustes_json?: Json | null
          ano_mes?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          bonus_autorizado?: boolean | null
          bonus_extra?: number | null
          closer_id?: string
          comissao_consorcio?: number | null
          comissao_holding?: number | null
          created_at?: string | null
          dias_uteis_mes?: number | null
          fixo_valor?: number | null
          id?: string
          meta_comissao_consorcio?: number | null
          meta_comissao_holding?: number | null
          meta_organizacao?: number | null
          mult_comissao_consorcio?: number | null
          mult_comissao_holding?: number | null
          mult_organizacao?: number | null
          nfse_id?: string | null
          ote_total?: number | null
          pct_comissao_consorcio?: number | null
          pct_comissao_holding?: number | null
          pct_organizacao?: number | null
          score_organizacao?: number | null
          status?: string | null
          total_conta?: number | null
          updated_at?: string | null
          valor_comissao_consorcio?: number | null
          valor_comissao_holding?: number | null
          valor_organizacao?: number | null
          valor_variavel_final?: number | null
          variavel_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_closer_payout_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcio_creditos: {
        Row: {
          ativo: boolean | null
          codigo_credito: string
          created_at: string | null
          id: string
          parcela_1a_12a_25_200: number | null
          parcela_1a_12a_25_220: number | null
          parcela_1a_12a_25_240: number | null
          parcela_1a_12a_50_200: number | null
          parcela_1a_12a_50_220: number | null
          parcela_1a_12a_50_240: number | null
          parcela_1a_12a_conv_200: number | null
          parcela_1a_12a_conv_220: number | null
          parcela_1a_12a_conv_240: number | null
          parcela_demais_25_200: number | null
          parcela_demais_25_220: number | null
          parcela_demais_25_240: number | null
          parcela_demais_50_200: number | null
          parcela_demais_50_220: number | null
          parcela_demais_50_240: number | null
          parcela_demais_conv_200: number | null
          parcela_demais_conv_220: number | null
          parcela_demais_conv_240: number | null
          produto_id: string | null
          valor_credito: number
        }
        Insert: {
          ativo?: boolean | null
          codigo_credito: string
          created_at?: string | null
          id?: string
          parcela_1a_12a_25_200?: number | null
          parcela_1a_12a_25_220?: number | null
          parcela_1a_12a_25_240?: number | null
          parcela_1a_12a_50_200?: number | null
          parcela_1a_12a_50_220?: number | null
          parcela_1a_12a_50_240?: number | null
          parcela_1a_12a_conv_200?: number | null
          parcela_1a_12a_conv_220?: number | null
          parcela_1a_12a_conv_240?: number | null
          parcela_demais_25_200?: number | null
          parcela_demais_25_220?: number | null
          parcela_demais_25_240?: number | null
          parcela_demais_50_200?: number | null
          parcela_demais_50_220?: number | null
          parcela_demais_50_240?: number | null
          parcela_demais_conv_200?: number | null
          parcela_demais_conv_220?: number | null
          parcela_demais_conv_240?: number | null
          produto_id?: string | null
          valor_credito: number
        }
        Update: {
          ativo?: boolean | null
          codigo_credito?: string
          created_at?: string | null
          id?: string
          parcela_1a_12a_25_200?: number | null
          parcela_1a_12a_25_220?: number | null
          parcela_1a_12a_25_240?: number | null
          parcela_1a_12a_50_200?: number | null
          parcela_1a_12a_50_220?: number | null
          parcela_1a_12a_50_240?: number | null
          parcela_1a_12a_conv_200?: number | null
          parcela_1a_12a_conv_220?: number | null
          parcela_1a_12a_conv_240?: number | null
          parcela_demais_25_200?: number | null
          parcela_demais_25_220?: number | null
          parcela_demais_25_240?: number | null
          parcela_demais_50_200?: number | null
          parcela_demais_50_220?: number | null
          parcela_demais_50_240?: number | null
          parcela_demais_conv_200?: number | null
          parcela_demais_conv_220?: number | null
          parcela_demais_conv_240?: number | null
          produto_id?: string | null
          valor_credito?: number
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_creditos_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "consorcio_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcio_lance_history: {
        Row: {
          card_id: string
          chance_classificacao: string
          created_at: string
          created_by: string | null
          id: string
          observacao: string | null
          percentual_lance: number
          posicao_estimada: number | null
          salvo: boolean
          valor_lance: number
        }
        Insert: {
          card_id: string
          chance_classificacao?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          percentual_lance: number
          posicao_estimada?: number | null
          salvo?: boolean
          valor_lance: number
        }
        Update: {
          card_id?: string
          chance_classificacao?: string
          created_at?: string
          created_by?: string | null
          id?: string
          observacao?: string | null
          percentual_lance?: number
          posicao_estimada?: number | null
          salvo?: boolean
          valor_lance?: number
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_lance_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "consortium_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcio_origem_options: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          label: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      consorcio_pending_registrations: {
        Row: {
          aceite_date: string | null
          categoria: string | null
          cnpj: string | null
          condicao_pagamento: string | null
          consortium_card_id: string | null
          cota: string | null
          cpf: string | null
          cpf_conjuge: string | null
          created_at: string
          created_by: string | null
          data_contratacao: string | null
          data_fundacao: string | null
          deal_id: string | null
          dia_vencimento: number | null
          e_transferencia: boolean | null
          email: string | null
          email_comercial: string | null
          empresa_paga_parcelas: string | null
          endereco_cep: string | null
          endereco_comercial: string | null
          endereco_comercial_cep: string | null
          endereco_completo: string | null
          faturamento_mensal: number | null
          grupo: string | null
          id: string
          inclui_seguro: boolean | null
          inicio_segunda_parcela: string | null
          inscricao_estadual: string | null
          natureza_juridica: string | null
          nome_completo: string | null
          num_funcionarios: number | null
          observacoes: string | null
          origem: string | null
          origem_detalhe: string | null
          parcelas_pagas_empresa: number | null
          patrimonio: number | null
          pix: string | null
          prazo_meses: number | null
          produto_codigo: string | null
          profissao: string | null
          proposal_id: string | null
          razao_social: string | null
          renda: number | null
          rg: string | null
          socios: Json | null
          status: string
          telefone: string | null
          telefone_comercial: string | null
          tipo_contrato: string | null
          tipo_pessoa: string
          tipo_produto: string | null
          transferido_de: string | null
          updated_at: string
          valor_comissao: number | null
          valor_credito: number | null
          vendedor_id: string | null
          vendedor_name: string | null
          vendedor_name_cota: string | null
        }
        Insert: {
          aceite_date?: string | null
          categoria?: string | null
          cnpj?: string | null
          condicao_pagamento?: string | null
          consortium_card_id?: string | null
          cota?: string | null
          cpf?: string | null
          cpf_conjuge?: string | null
          created_at?: string
          created_by?: string | null
          data_contratacao?: string | null
          data_fundacao?: string | null
          deal_id?: string | null
          dia_vencimento?: number | null
          e_transferencia?: boolean | null
          email?: string | null
          email_comercial?: string | null
          empresa_paga_parcelas?: string | null
          endereco_cep?: string | null
          endereco_comercial?: string | null
          endereco_comercial_cep?: string | null
          endereco_completo?: string | null
          faturamento_mensal?: number | null
          grupo?: string | null
          id?: string
          inclui_seguro?: boolean | null
          inicio_segunda_parcela?: string | null
          inscricao_estadual?: string | null
          natureza_juridica?: string | null
          nome_completo?: string | null
          num_funcionarios?: number | null
          observacoes?: string | null
          origem?: string | null
          origem_detalhe?: string | null
          parcelas_pagas_empresa?: number | null
          patrimonio?: number | null
          pix?: string | null
          prazo_meses?: number | null
          produto_codigo?: string | null
          profissao?: string | null
          proposal_id?: string | null
          razao_social?: string | null
          renda?: number | null
          rg?: string | null
          socios?: Json | null
          status?: string
          telefone?: string | null
          telefone_comercial?: string | null
          tipo_contrato?: string | null
          tipo_pessoa: string
          tipo_produto?: string | null
          transferido_de?: string | null
          updated_at?: string
          valor_comissao?: number | null
          valor_credito?: number | null
          vendedor_id?: string | null
          vendedor_name?: string | null
          vendedor_name_cota?: string | null
        }
        Update: {
          aceite_date?: string | null
          categoria?: string | null
          cnpj?: string | null
          condicao_pagamento?: string | null
          consortium_card_id?: string | null
          cota?: string | null
          cpf?: string | null
          cpf_conjuge?: string | null
          created_at?: string
          created_by?: string | null
          data_contratacao?: string | null
          data_fundacao?: string | null
          deal_id?: string | null
          dia_vencimento?: number | null
          e_transferencia?: boolean | null
          email?: string | null
          email_comercial?: string | null
          empresa_paga_parcelas?: string | null
          endereco_cep?: string | null
          endereco_comercial?: string | null
          endereco_comercial_cep?: string | null
          endereco_completo?: string | null
          faturamento_mensal?: number | null
          grupo?: string | null
          id?: string
          inclui_seguro?: boolean | null
          inicio_segunda_parcela?: string | null
          inscricao_estadual?: string | null
          natureza_juridica?: string | null
          nome_completo?: string | null
          num_funcionarios?: number | null
          observacoes?: string | null
          origem?: string | null
          origem_detalhe?: string | null
          parcelas_pagas_empresa?: number | null
          patrimonio?: number | null
          pix?: string | null
          prazo_meses?: number | null
          produto_codigo?: string | null
          profissao?: string | null
          proposal_id?: string | null
          razao_social?: string | null
          renda?: number | null
          rg?: string | null
          socios?: Json | null
          status?: string
          telefone?: string | null
          telefone_comercial?: string | null
          tipo_contrato?: string | null
          tipo_pessoa?: string
          tipo_produto?: string | null
          transferido_de?: string | null
          updated_at?: string
          valor_comissao?: number | null
          valor_credito?: number | null
          vendedor_id?: string | null
          vendedor_name?: string | null
          vendedor_name_cota?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_pending_registrations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcio_pending_registrations_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "consorcio_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcio_produto_adquirido_options: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          label: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      consorcio_produtos: {
        Row: {
          ativo: boolean | null
          codigo: string
          created_at: string | null
          descricao: string | null
          faixa_credito_max: number
          faixa_credito_min: number
          fundo_reserva: number | null
          grupo_padrao: string | null
          id: string
          nome: string
          prazos_disponiveis: number[]
          seguro_vida_percentual: number | null
          taxa_adm_200: number | null
          taxa_adm_220: number | null
          taxa_adm_240: number | null
          taxa_antecipada_percentual: number
          taxa_antecipada_tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          faixa_credito_max: number
          faixa_credito_min: number
          fundo_reserva?: number | null
          grupo_padrao?: string | null
          id?: string
          nome: string
          prazos_disponiveis: number[]
          seguro_vida_percentual?: number | null
          taxa_adm_200?: number | null
          taxa_adm_220?: number | null
          taxa_adm_240?: number | null
          taxa_antecipada_percentual: number
          taxa_antecipada_tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          faixa_credito_max?: number
          faixa_credito_min?: number
          fundo_reserva?: number | null
          grupo_padrao?: string | null
          id?: string
          nome?: string
          prazos_disponiveis?: number[]
          seguro_vida_percentual?: number | null
          taxa_adm_200?: number | null
          taxa_adm_220?: number | null
          taxa_adm_240?: number | null
          taxa_antecipada_percentual?: number
          taxa_antecipada_tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      consorcio_proposals: {
        Row: {
          aceite_date: string | null
          consortium_card_id: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string | null
          id: string
          motivo_recusa: string | null
          prazo_meses: number | null
          proposal_date: string | null
          proposal_details: string | null
          status: string | null
          tipo_produto: string | null
          updated_at: string | null
          valor_credito: number | null
        }
        Insert: {
          aceite_date?: string | null
          consortium_card_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          id?: string
          motivo_recusa?: string | null
          prazo_meses?: number | null
          proposal_date?: string | null
          proposal_details?: string | null
          status?: string | null
          tipo_produto?: string | null
          updated_at?: string | null
          valor_credito?: number | null
        }
        Update: {
          aceite_date?: string | null
          consortium_card_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string | null
          id?: string
          motivo_recusa?: string | null
          prazo_meses?: number | null
          proposal_date?: string | null
          proposal_details?: string | null
          status?: string | null
          tipo_produto?: string | null
          updated_at?: string | null
          valor_credito?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_proposals_consortium_card_id_fkey"
            columns: ["consortium_card_id"]
            isOneToOne: false
            referencedRelation: "consortium_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcio_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consorcio_proposals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "consorcio_proposals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcio_sorteio_history: {
        Row: {
          card_id: string
          contemplado: boolean
          created_at: string
          created_by: string | null
          data_assembleia: string
          distancia: number
          id: string
          numero_sorteado: string
          observacao: string | null
        }
        Insert: {
          card_id: string
          contemplado?: boolean
          created_at?: string
          created_by?: string | null
          data_assembleia: string
          distancia?: number
          id?: string
          numero_sorteado: string
          observacao?: string | null
        }
        Update: {
          card_id?: string
          contemplado?: boolean
          created_at?: string
          created_by?: string | null
          data_assembleia?: string
          distancia?: number
          id?: string
          numero_sorteado?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_sorteio_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "consortium_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcio_tipo_produto_options: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          label: string
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label: string
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          label?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      consorcio_venda_holding: {
        Row: {
          ano_mes: string
          closer_id: string
          created_at: string | null
          created_by: string | null
          data_venda: string | null
          descricao: string | null
          id: string
          valor_comissao: number
          valor_venda: number
        }
        Insert: {
          ano_mes: string
          closer_id: string
          created_at?: string | null
          created_by?: string | null
          data_venda?: string | null
          descricao?: string | null
          id?: string
          valor_comissao: number
          valor_venda: number
        }
        Update: {
          ano_mes?: string
          closer_id?: string
          created_at?: string | null
          created_by?: string | null
          data_venda?: string | null
          descricao?: string | null
          id?: string
          valor_comissao?: number
          valor_venda?: number
        }
        Relationships: [
          {
            foreignKeyName: "consorcio_venda_holding_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
        ]
      }
      consorcio_vendedor_options: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      consortium_cards: {
        Row: {
          categoria: string
          cnpj: string | null
          condicao_pagamento: string | null
          cota: string
          cpf: string | null
          cpf_conjuge: string | null
          created_at: string
          data_contemplacao: string | null
          data_contratacao: string
          data_fundacao: string | null
          data_nascimento: string | null
          dia_vencimento: number
          e_transferencia: boolean | null
          email: string | null
          email_comercial: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_comercial_bairro: string | null
          endereco_comercial_cep: string | null
          endereco_comercial_cidade: string | null
          endereco_comercial_complemento: string | null
          endereco_comercial_estado: string | null
          endereco_comercial_numero: string | null
          endereco_comercial_rua: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          estado_civil: string | null
          faturamento_mensal: number | null
          grupo: string
          id: string
          inclui_seguro_vida: boolean | null
          inscricao_estadual: string | null
          motivo_contemplacao: string | null
          natureza_juridica: string | null
          nome_completo: string | null
          num_funcionarios: number | null
          numero_contemplacao: string | null
          observacoes: string | null
          origem: string
          origem_detalhe: string | null
          parcela_1a_12a: number | null
          parcela_demais: number | null
          parcelas_pagas_empresa: number
          patrimonio: number | null
          percentual_lance: number | null
          pix: string | null
          prazo_meses: number
          produto_embracon: string | null
          profissao: string | null
          razao_social: string | null
          renda: number | null
          rg: string | null
          status: string
          telefone: string | null
          telefone_comercial: string | null
          tipo_contrato: string
          tipo_pessoa: string
          tipo_produto: string
          tipo_servidor: string | null
          transferido_de: string | null
          updated_at: string
          valor_comissao: number | null
          valor_credito: number
          valor_lance: number | null
          vendedor_id: string | null
          vendedor_name: string | null
        }
        Insert: {
          categoria?: string
          cnpj?: string | null
          condicao_pagamento?: string | null
          cota: string
          cpf?: string | null
          cpf_conjuge?: string | null
          created_at?: string
          data_contemplacao?: string | null
          data_contratacao: string
          data_fundacao?: string | null
          data_nascimento?: string | null
          dia_vencimento: number
          e_transferencia?: boolean | null
          email?: string | null
          email_comercial?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_comercial_bairro?: string | null
          endereco_comercial_cep?: string | null
          endereco_comercial_cidade?: string | null
          endereco_comercial_complemento?: string | null
          endereco_comercial_estado?: string | null
          endereco_comercial_numero?: string | null
          endereco_comercial_rua?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          estado_civil?: string | null
          faturamento_mensal?: number | null
          grupo: string
          id?: string
          inclui_seguro_vida?: boolean | null
          inscricao_estadual?: string | null
          motivo_contemplacao?: string | null
          natureza_juridica?: string | null
          nome_completo?: string | null
          num_funcionarios?: number | null
          numero_contemplacao?: string | null
          observacoes?: string | null
          origem: string
          origem_detalhe?: string | null
          parcela_1a_12a?: number | null
          parcela_demais?: number | null
          parcelas_pagas_empresa?: number
          patrimonio?: number | null
          percentual_lance?: number | null
          pix?: string | null
          prazo_meses: number
          produto_embracon?: string | null
          profissao?: string | null
          razao_social?: string | null
          renda?: number | null
          rg?: string | null
          status?: string
          telefone?: string | null
          telefone_comercial?: string | null
          tipo_contrato?: string
          tipo_pessoa: string
          tipo_produto: string
          tipo_servidor?: string | null
          transferido_de?: string | null
          updated_at?: string
          valor_comissao?: number | null
          valor_credito: number
          valor_lance?: number | null
          vendedor_id?: string | null
          vendedor_name?: string | null
        }
        Update: {
          categoria?: string
          cnpj?: string | null
          condicao_pagamento?: string | null
          cota?: string
          cpf?: string | null
          cpf_conjuge?: string | null
          created_at?: string
          data_contemplacao?: string | null
          data_contratacao?: string
          data_fundacao?: string | null
          data_nascimento?: string | null
          dia_vencimento?: number
          e_transferencia?: boolean | null
          email?: string | null
          email_comercial?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_comercial_bairro?: string | null
          endereco_comercial_cep?: string | null
          endereco_comercial_cidade?: string | null
          endereco_comercial_complemento?: string | null
          endereco_comercial_estado?: string | null
          endereco_comercial_numero?: string | null
          endereco_comercial_rua?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          estado_civil?: string | null
          faturamento_mensal?: number | null
          grupo?: string
          id?: string
          inclui_seguro_vida?: boolean | null
          inscricao_estadual?: string | null
          motivo_contemplacao?: string | null
          natureza_juridica?: string | null
          nome_completo?: string | null
          num_funcionarios?: number | null
          numero_contemplacao?: string | null
          observacoes?: string | null
          origem?: string
          origem_detalhe?: string | null
          parcela_1a_12a?: number | null
          parcela_demais?: number | null
          parcelas_pagas_empresa?: number
          patrimonio?: number | null
          percentual_lance?: number | null
          pix?: string | null
          prazo_meses?: number
          produto_embracon?: string | null
          profissao?: string | null
          razao_social?: string | null
          renda?: number | null
          rg?: string | null
          status?: string
          telefone?: string | null
          telefone_comercial?: string | null
          tipo_contrato?: string
          tipo_pessoa?: string
          tipo_produto?: string
          tipo_servidor?: string | null
          transferido_de?: string | null
          updated_at?: string
          valor_comissao?: number | null
          valor_credito?: number
          valor_lance?: number | null
          vendedor_id?: string | null
          vendedor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consortium_cards_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "consorcio_vendedor_options"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_documents: {
        Row: {
          card_id: string | null
          id: string
          nome_arquivo: string
          pending_registration_id: string | null
          storage_path: string | null
          storage_url: string | null
          tipo: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          card_id?: string | null
          id?: string
          nome_arquivo: string
          pending_registration_id?: string | null
          storage_path?: string | null
          storage_url?: string | null
          tipo: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          card_id?: string | null
          id?: string
          nome_arquivo?: string
          pending_registration_id?: string | null
          storage_path?: string | null
          storage_url?: string | null
          tipo?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consortium_documents_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "consortium_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consortium_documents_pending_registration_id_fkey"
            columns: ["pending_registration_id"]
            isOneToOne: false
            referencedRelation: "consorcio_pending_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_installments: {
        Row: {
          card_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          observacao: string | null
          status: string
          tipo: string
          updated_at: string
          valor_comissao: number
          valor_parcela: number
        }
        Insert: {
          card_id: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          observacao?: string | null
          status?: string
          tipo: string
          updated_at?: string
          valor_comissao?: number
          valor_parcela: number
        }
        Update: {
          card_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          observacao?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          valor_comissao?: number
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "consortium_installments_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "consortium_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_payments: {
        Row: {
          consorciado: string
          contrato: string | null
          created_at: string | null
          data_interface: string | null
          id: string
          parcela: number | null
          status: string | null
          updated_at: string | null
          valor_comissao: number | null
          vendedor_id: string | null
          vendedor_name: string | null
        }
        Insert: {
          consorciado: string
          contrato?: string | null
          created_at?: string | null
          data_interface?: string | null
          id?: string
          parcela?: number | null
          status?: string | null
          updated_at?: string | null
          valor_comissao?: number | null
          vendedor_id?: string | null
          vendedor_name?: string | null
        }
        Update: {
          consorciado?: string
          contrato?: string | null
          created_at?: string | null
          data_interface?: string | null
          id?: string
          parcela?: number | null
          status?: string | null
          updated_at?: string | null
          valor_comissao?: number | null
          vendedor_id?: string | null
          vendedor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consortium_payments_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      consortium_pj_partners: {
        Row: {
          card_id: string
          cpf: string
          created_at: string
          id: string
          nome: string
          renda: number | null
        }
        Insert: {
          card_id: string
          cpf: string
          created_at?: string
          id?: string
          nome: string
          renda?: number | null
        }
        Update: {
          card_id?: string
          cpf?: string
          created_at?: string
          id?: string
          nome?: string
          renda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consortium_pj_partners_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "consortium_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_clients: {
        Row: {
          cpf: string
          created_at: string | null
          credit_score: number | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          status: string | null
          total_credit: number | null
          total_debt: number | null
          updated_at: string | null
        }
        Insert: {
          cpf: string
          created_at?: string | null
          credit_score?: number | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          status?: string | null
          total_credit?: number | null
          total_debt?: number | null
          updated_at?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string | null
          credit_score?: number | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          status?: string | null
          total_credit?: number | null
          total_debt?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_deal_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          deal_id: string
          description: string | null
          from_stage_id: string | null
          id: string
          metadata: Json | null
          to_stage_id: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          deal_id: string
          description?: string | null
          from_stage_id?: string | null
          id?: string
          metadata?: Json | null
          to_stage_id?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          deal_id?: string
          description?: string | null
          from_stage_id?: string | null
          id?: string
          metadata?: Json | null
          to_stage_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_deal_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "credit_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_deal_activities_from_stage_id_fkey"
            columns: ["from_stage_id"]
            isOneToOne: false
            referencedRelation: "credit_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_deal_activities_to_stage_id_fkey"
            columns: ["to_stage_id"]
            isOneToOne: false
            referencedRelation: "credit_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_deals: {
        Row: {
          client_id: string | null
          created_at: string | null
          custom_fields: Json | null
          data_aprovacao: string | null
          data_liberacao: string | null
          data_quitacao: string | null
          data_solicitacao: string | null
          garantia: string | null
          id: string
          observacoes: string | null
          owner_id: string | null
          partner_id: string | null
          prazo_meses: number | null
          product_id: string
          stage_id: string
          taxa_juros: number | null
          titulo: string
          updated_at: string | null
          valor_aprovado: number | null
          valor_solicitado: number | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          data_aprovacao?: string | null
          data_liberacao?: string | null
          data_quitacao?: string | null
          data_solicitacao?: string | null
          garantia?: string | null
          id?: string
          observacoes?: string | null
          owner_id?: string | null
          partner_id?: string | null
          prazo_meses?: number | null
          product_id: string
          stage_id: string
          taxa_juros?: number | null
          titulo: string
          updated_at?: string | null
          valor_aprovado?: number | null
          valor_solicitado?: number | null
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          data_aprovacao?: string | null
          data_liberacao?: string | null
          data_quitacao?: string | null
          data_solicitacao?: string | null
          garantia?: string | null
          id?: string
          observacoes?: string | null
          owner_id?: string | null
          partner_id?: string | null
          prazo_meses?: number | null
          product_id?: string
          stage_id?: string
          taxa_juros?: number | null
          titulo?: string
          updated_at?: string | null
          valor_aprovado?: number | null
          valor_solicitado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_deals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "credit_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_deals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "credit_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "credit_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "credit_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_history: {
        Row: {
          amount: number
          client_id: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          type: string | null
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          type?: string | null
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "credit_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_partner_deals: {
        Row: {
          comissao_pct: number | null
          created_at: string | null
          deal_id: string
          id: string
          partner_id: string
          valor_comissao: number | null
        }
        Insert: {
          comissao_pct?: number | null
          created_at?: string | null
          deal_id: string
          id?: string
          partner_id: string
          valor_comissao?: number | null
        }
        Update: {
          comissao_pct?: number | null
          created_at?: string | null
          deal_id?: string
          id?: string
          partner_id?: string
          valor_comissao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_partner_deals_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "credit_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_partner_deals_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "credit_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_partners: {
        Row: {
          consorcio_card_id: string | null
          cpf_cnpj: string
          created_at: string | null
          data_entrada: string | null
          email: string | null
          full_name: string
          id: string
          observacoes: string | null
          phone: string | null
          status: string | null
          tipo: string
          updated_at: string | null
          valor_aportado: number | null
        }
        Insert: {
          consorcio_card_id?: string | null
          cpf_cnpj: string
          created_at?: string | null
          data_entrada?: string | null
          email?: string | null
          full_name: string
          id?: string
          observacoes?: string | null
          phone?: string | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          valor_aportado?: number | null
        }
        Update: {
          consorcio_card_id?: string | null
          cpf_cnpj?: string
          created_at?: string | null
          data_entrada?: string | null
          email?: string | null
          full_name?: string
          id?: string
          observacoes?: string | null
          phone?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          valor_aportado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_partners_consorcio_card_id_fkey"
            columns: ["consorcio_card_id"]
            isOneToOne: false
            referencedRelation: "consortium_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_products: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_stages: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_final: boolean | null
          is_won: boolean | null
          name: string
          product_id: string
          stage_order: number
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_final?: boolean | null
          is_won?: boolean | null
          name: string
          product_id: string
          stage_order?: number
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_final?: boolean | null
          is_won?: boolean | null
          name?: string
          product_id?: string
          stage_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_stages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "credit_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          clint_id: string
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_name: string | null
          origin_id: string | null
          phone: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          clint_id: string
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_name?: string | null
          origin_id?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          clint_id?: string
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_name?: string | null
          origin_id?: string | null
          phone?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          clint_id: string
          contact_id: string | null
          created_at: string | null
          custom_fields: Json | null
          data_source: string | null
          expected_close_date: string | null
          id: string
          last_worked_at: string | null
          name: string
          next_action_date: string | null
          next_action_note: string | null
          next_action_type: string | null
          origin_id: string | null
          original_sdr_email: string | null
          owner_id: string | null
          owner_profile_id: string | null
          probability: number | null
          product_name: string | null
          r1_closer_email: string | null
          r2_closer_email: string | null
          replicated_at: string | null
          replicated_from_deal_id: string | null
          stage_id: string | null
          stage_moved_at: string | null
          tags: string[] | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          clint_id: string
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          data_source?: string | null
          expected_close_date?: string | null
          id?: string
          last_worked_at?: string | null
          name: string
          next_action_date?: string | null
          next_action_note?: string | null
          next_action_type?: string | null
          origin_id?: string | null
          original_sdr_email?: string | null
          owner_id?: string | null
          owner_profile_id?: string | null
          probability?: number | null
          product_name?: string | null
          r1_closer_email?: string | null
          r2_closer_email?: string | null
          replicated_at?: string | null
          replicated_from_deal_id?: string | null
          stage_id?: string | null
          stage_moved_at?: string | null
          tags?: string[] | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          clint_id?: string
          contact_id?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          data_source?: string | null
          expected_close_date?: string | null
          id?: string
          last_worked_at?: string | null
          name?: string
          next_action_date?: string | null
          next_action_note?: string | null
          next_action_type?: string | null
          origin_id?: string | null
          original_sdr_email?: string | null
          owner_id?: string | null
          owner_profile_id?: string | null
          probability?: number | null
          product_name?: string | null
          r1_closer_email?: string | null
          r2_closer_email?: string | null
          replicated_at?: string | null
          replicated_from_deal_id?: string | null
          stage_id?: string | null
          stage_moved_at?: string | null
          tags?: string[] | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_owner_profile_id_fkey"
            columns: ["owner_profile_id"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "crm_deals_replicated_from_deal_id_fkey"
            columns: ["replicated_from_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_groups: {
        Row: {
          clint_id: string
          created_at: string | null
          description: string | null
          display_name: string | null
          id: string
          is_archived: boolean | null
          is_favorite: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          clint_id: string
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          clint_id?: string
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_origins: {
        Row: {
          clint_id: string
          contact_count: number | null
          created_at: string | null
          description: string | null
          display_name: string | null
          group_id: string | null
          id: string
          is_archived: boolean | null
          name: string
          parent_id: string | null
          pipeline_type: string | null
          updated_at: string | null
        }
        Insert: {
          clint_id: string
          contact_count?: number | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          group_id?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          parent_id?: string | null
          pipeline_type?: string | null
          updated_at?: string | null
        }
        Update: {
          clint_id?: string
          contact_count?: number | null
          created_at?: string | null
          description?: string | null
          display_name?: string | null
          group_id?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          parent_id?: string | null
          pipeline_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_origins_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "crm_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_origins_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          clint_id: string
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          origin_id: string | null
          stage_name: string
          stage_order: number
          updated_at: string | null
        }
        Insert: {
          clint_id: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          origin_id?: string | null
          stage_name: string
          stage_order: number
          updated_at?: string | null
        }
        Update: {
          clint_id?: string
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          origin_id?: string | null
          stage_name?: string
          stage_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_stages_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_costs: {
        Row: {
          amount: number
          campaign_name: string | null
          cost_type: string
          created_at: string | null
          date: string
          id: string
          metadata: Json | null
          source: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number
          campaign_name?: string | null
          cost_type?: string
          created_at?: string | null
          date: string
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          campaign_name?: string | null
          cost_type?: string
          created_at?: string | null
          date?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_preferences: {
        Row: {
          auto_refresh: boolean
          created_at: string
          default_canal: string
          default_period: string
          font_size: string | null
          funnel_stages: string[] | null
          id: string
          refresh_interval: number
          theme: string | null
          updated_at: string
          user_id: string
          visible_widgets: string[]
          widgets_order: string[]
        }
        Insert: {
          auto_refresh?: boolean
          created_at?: string
          default_canal?: string
          default_period?: string
          font_size?: string | null
          funnel_stages?: string[] | null
          id?: string
          refresh_interval?: number
          theme?: string | null
          updated_at?: string
          user_id: string
          visible_widgets?: string[]
          widgets_order?: string[]
        }
        Update: {
          auto_refresh?: boolean
          created_at?: string
          default_canal?: string
          default_period?: string
          font_size?: string | null
          funnel_stages?: string[] | null
          id?: string
          refresh_interval?: number
          theme?: string | null
          updated_at?: string
          user_id?: string
          visible_widgets?: string[]
          widgets_order?: string[]
        }
        Relationships: []
      }
      deal_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          deal_id: string
          description: string | null
          from_stage: string | null
          id: string
          metadata: Json | null
          to_stage: string | null
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          deal_id: string
          description?: string | null
          from_stage?: string | null
          id?: string
          metadata?: Json | null
          to_stage?: string | null
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          deal_id?: string
          description?: string | null
          from_stage?: string | null
          id?: string
          metadata?: Json | null
          to_stage?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      deal_activities_duplicates: {
        Row: {
          created_at: string | null
          deal_id: string
          detected_at: string | null
          duplicate_activity_id: string
          from_stage: string | null
          gap_seconds: number | null
          id: string
          original_activity_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          to_stage: string | null
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          detected_at?: string | null
          duplicate_activity_id: string
          from_stage?: string | null
          gap_seconds?: number | null
          id?: string
          original_activity_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          to_stage?: string | null
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          detected_at?: string | null
          duplicate_activity_id?: string
          from_stage?: string | null
          gap_seconds?: number | null
          id?: string
          original_activity_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          to_stage?: string | null
        }
        Relationships: []
      }
      deal_produtos_adquiridos: {
        Row: {
          created_at: string | null
          deal_id: string
          id: string
          produto_option_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          deal_id: string
          id?: string
          produto_option_id: string
          valor?: number
        }
        Update: {
          created_at?: string | null
          deal_id?: string
          id?: string
          produto_option_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "deal_produtos_adquiridos_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_produtos_adquiridos_produto_option_id_fkey"
            columns: ["produto_option_id"]
            isOneToOne: false
            referencedRelation: "consorcio_produto_adquirido_options"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_replication_logs: {
        Row: {
          error_message: string | null
          executed_at: string
          id: string
          metadata: Json | null
          rule_id: string
          source_deal_id: string
          status: string
          target_deal_id: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string
          id?: string
          metadata?: Json | null
          rule_id: string
          source_deal_id: string
          status?: string
          target_deal_id: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string
          id?: string
          metadata?: Json | null
          rule_id?: string
          source_deal_id?: string
          status?: string
          target_deal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_replication_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "deal_replication_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_replication_logs_source_deal_id_fkey"
            columns: ["source_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_replication_logs_target_deal_id_fkey"
            columns: ["target_deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_replication_queue: {
        Row: {
          attempts: number
          created_at: string
          deal_id: string
          error_message: string | null
          id: string
          origin_id: string
          processed_at: string | null
          stage_id: string
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          deal_id: string
          error_message?: string | null
          id?: string
          origin_id: string
          processed_at?: string | null
          stage_id: string
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          deal_id?: string
          error_message?: string | null
          id?: string
          origin_id?: string
          processed_at?: string | null
          stage_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_replication_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_replication_queue_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_replication_queue_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_replication_rules: {
        Row: {
          copy_custom_fields: boolean
          copy_tasks: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          match_condition: Json | null
          name: string
          priority: number
          source_origin_id: string
          source_stage_id: string
          target_origin_id: string
          target_stage_id: string
          updated_at: string
        }
        Insert: {
          copy_custom_fields?: boolean
          copy_tasks?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          match_condition?: Json | null
          name: string
          priority?: number
          source_origin_id: string
          source_stage_id: string
          target_origin_id: string
          target_stage_id: string
          updated_at?: string
        }
        Update: {
          copy_custom_fields?: boolean
          copy_tasks?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          match_condition?: Json | null
          name?: string
          priority?: number
          source_origin_id?: string
          source_stage_id?: string
          target_origin_id?: string
          target_stage_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_replication_rules_source_origin_id_fkey"
            columns: ["source_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_replication_rules_source_stage_id_fkey"
            columns: ["source_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_replication_rules_target_origin_id_fkey"
            columns: ["target_origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_replication_rules_target_stage_id_fkey"
            columns: ["target_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stages: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          stage_id: string
          stage_name: string
          stage_order: number
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          stage_id: string
          stage_name: string
          stage_order: number
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          stage_id?: string
          stage_name?: string
          stage_order?: number
        }
        Relationships: []
      }
      deal_tasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string
          description: string | null
          due_date: string | null
          id: string
          owner_id: string | null
          status: Database["public"]["Enums"]["activity_task_status"]
          template_id: string | null
          title: string
          type: Database["public"]["Enums"]["activity_task_type"]
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["activity_task_status"]
          template_id?: string | null
          title: string
          type?: Database["public"]["Enums"]["activity_task_type"]
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_id?: string | null
          status?: Database["public"]["Enums"]["activity_task_status"]
          template_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["activity_task_type"]
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "activity_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean | null
          codigo: string | null
          created_at: string | null
          id: string
          is_bu: boolean | null
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          is_bu?: boolean | null
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          codigo?: string | null
          created_at?: string | null
          id?: string
          is_bu?: boolean | null
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          created_at: string | null
          data_emissao: string | null
          data_validade: string | null
          descricao: string | null
          employee_id: string
          id: string
          obrigatorio: boolean | null
          observacao_status: string | null
          status: string | null
          storage_path: string | null
          storage_url: string | null
          tipo_documento: string
          titulo: string
          updated_at: string | null
          uploaded_by: string | null
          visivel_colaborador: boolean | null
        }
        Insert: {
          created_at?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          employee_id: string
          id?: string
          obrigatorio?: boolean | null
          observacao_status?: string | null
          status?: string | null
          storage_path?: string | null
          storage_url?: string | null
          tipo_documento: string
          titulo: string
          updated_at?: string | null
          uploaded_by?: string | null
          visivel_colaborador?: boolean | null
        }
        Update: {
          created_at?: string | null
          data_emissao?: string | null
          data_validade?: string | null
          descricao?: string | null
          employee_id?: string
          id?: string
          obrigatorio?: boolean | null
          observacao_status?: string | null
          status?: string | null
          storage_path?: string | null
          storage_url?: string | null
          tipo_documento?: string
          titulo?: string
          updated_at?: string | null
          uploaded_by?: string | null
          visivel_colaborador?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_events: {
        Row: {
          created_at: string | null
          created_by: string | null
          data_evento: string
          descricao: string | null
          employee_id: string
          id: string
          metadata: Json | null
          tipo_evento: string
          titulo: string
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data_evento?: string
          descricao?: string | null
          employee_id: string
          id?: string
          metadata?: Json | null
          tipo_evento: string
          titulo: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data_evento?: string
          descricao?: string | null
          employee_id?: string
          id?: string
          metadata?: Json | null
          tipo_evento?: string
          titulo?: string
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_events_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_exam_scores: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string
          exam_id: string
          id: string
          nota: number
          observacao: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          exam_id: string
          id?: string
          nota: number
          observacao?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          exam_id?: string
          id?: string
          nota?: number
          observacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_exam_scores_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_exam_scores_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "employee_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_exams: {
        Row: {
          aplicador_id: string | null
          ativo: boolean | null
          created_at: string | null
          data_aplicacao: string | null
          descricao: string | null
          id: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          aplicador_id?: string | null
          ativo?: boolean | null
          created_at?: string | null
          data_aplicacao?: string | null
          descricao?: string | null
          id?: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          aplicador_id?: string | null
          ativo?: boolean | null
          created_at?: string | null
          data_aplicacao?: string | null
          descricao?: string | null
          id?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      employee_notes: {
        Row: {
          conteudo: string
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          privada: boolean | null
          tipo: string | null
          titulo: string | null
          updated_at: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          privada?: boolean | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          privada?: boolean | null
          tipo?: string | null
          titulo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_notes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_products: {
        Row: {
          created_at: string | null
          created_by: string | null
          employee_id: string
          id: string
          product_code: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          employee_id: string
          id?: string
          product_code: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          employee_id?: string
          id?: string
          product_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_products_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          agencia: string | null
          banco: string | null
          cargo: string | null
          cargo_catalogo_id: string | null
          cep: string | null
          cidade: string | null
          conta: string | null
          cpf: string | null
          created_at: string | null
          created_by: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          departamento: string | null
          descricao_comissao: string | null
          email_pessoal: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          gestor_id: string | null
          id: string
          jornada_trabalho: string | null
          modelo_fechamento: string | null
          nacionalidade: string | null
          nivel: number | null
          nome_completo: string
          observacao_geral: string | null
          ote_mensal: number | null
          pix: string | null
          profile_id: string | null
          rg: string | null
          salario_base: number | null
          sdr_id: string | null
          squad: string | null
          status: string | null
          telefone: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          tipo_variavel: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          cargo?: string | null
          cargo_catalogo_id?: string | null
          cep?: string | null
          cidade?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          descricao_comissao?: string | null
          email_pessoal?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          gestor_id?: string | null
          id?: string
          jornada_trabalho?: string | null
          modelo_fechamento?: string | null
          nacionalidade?: string | null
          nivel?: number | null
          nome_completo: string
          observacao_geral?: string | null
          ote_mensal?: number | null
          pix?: string | null
          profile_id?: string | null
          rg?: string | null
          salario_base?: number | null
          sdr_id?: string | null
          squad?: string | null
          status?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          tipo_variavel?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          cargo?: string | null
          cargo_catalogo_id?: string | null
          cep?: string | null
          cidade?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string | null
          created_by?: string | null
          data_admissao?: string | null
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          descricao_comissao?: string | null
          email_pessoal?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          gestor_id?: string | null
          id?: string
          jornada_trabalho?: string | null
          modelo_fechamento?: string | null
          nacionalidade?: string | null
          nivel?: number | null
          nome_completo?: string
          observacao_geral?: string | null
          ote_mensal?: number | null
          pix?: string | null
          profile_id?: string | null
          rg?: string | null
          salario_base?: number | null
          sdr_id?: string | null
          squad?: string | null
          status?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          tipo_variavel?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_cargo_catalogo_id_fkey"
            columns: ["cargo_catalogo_id"]
            isOneToOne: false
            referencedRelation: "cargos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "employees_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      encaixe_queue: {
        Row: {
          closer_id: string
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          deal_id: string
          id: string
          lead_type: string
          notes: string | null
          notified_at: string | null
          preferred_date: string
          preferred_time_end: string | null
          preferred_time_start: string | null
          priority: number | null
          scheduled_meeting_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          closer_id: string
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id: string
          id?: string
          lead_type?: string
          notes?: string | null
          notified_at?: string | null
          preferred_date: string
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          priority?: number | null
          scheduled_meeting_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          closer_id?: string
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deal_id?: string
          id?: string
          lead_type?: string
          notes?: string | null
          notified_at?: string | null
          preferred_date?: string
          preferred_time_end?: string | null
          preferred_time_start?: string | null
          priority?: number | null
          scheduled_meeting_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encaixe_queue_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaixe_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaixe_queue_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encaixe_queue_scheduled_meeting_id_fkey"
            columns: ["scheduled_meeting_id"]
            isOneToOne: false
            referencedRelation: "meeting_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_componentes_realizado: {
        Row: {
          created_at: string
          fechamento_pessoa_id: string
          id: string
          meta_componente_id: string
          observacao: string | null
          percentual_realizado: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          fechamento_pessoa_id: string
          id?: string
          meta_componente_id: string
          observacao?: string | null
          percentual_realizado?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          fechamento_pessoa_id?: string
          id?: string
          meta_componente_id?: string
          observacao?: string | null
          percentual_realizado?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_componentes_realizado_fechamento_pessoa_id_fkey"
            columns: ["fechamento_pessoa_id"]
            isOneToOne: false
            referencedRelation: "fechamento_pessoa"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_componentes_realizado_meta_componente_id_fkey"
            columns: ["meta_componente_id"]
            isOneToOne: false
            referencedRelation: "metas_componentes"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_mes: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          competencia: string
          created_at: string
          criado_em: string
          criado_por: string | null
          id: string
          observacao_geral: string | null
          status: string
          updated_at: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          competencia: string
          created_at?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          observacao_geral?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          competencia?: string
          created_at?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          observacao_geral?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fechamento_metricas_mes: {
        Row: {
          ano_mes: string
          ativo: boolean | null
          cargo_catalogo_id: string | null
          created_at: string | null
          fonte_dados: string | null
          id: string
          label_exibicao: string
          meta_percentual: number | null
          meta_valor: number | null
          nome_metrica: string
          peso_percentual: number | null
          squad: string | null
          updated_at: string | null
        }
        Insert: {
          ano_mes: string
          ativo?: boolean | null
          cargo_catalogo_id?: string | null
          created_at?: string | null
          fonte_dados?: string | null
          id?: string
          label_exibicao: string
          meta_percentual?: number | null
          meta_valor?: number | null
          nome_metrica: string
          peso_percentual?: number | null
          squad?: string | null
          updated_at?: string | null
        }
        Update: {
          ano_mes?: string
          ativo?: boolean | null
          cargo_catalogo_id?: string | null
          created_at?: string | null
          fonte_dados?: string | null
          id?: string
          label_exibicao?: string
          meta_percentual?: number | null
          meta_valor?: number | null
          nome_metrica?: string
          peso_percentual?: number | null
          squad?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_metricas_mes_cargo_catalogo_id_fkey"
            columns: ["cargo_catalogo_id"]
            isOneToOne: false
            referencedRelation: "cargos_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamento_pessoa: {
        Row: {
          ajuste_manual_motivo: string | null
          ajuste_manual_valor: number
          cargo_catalogo_id: string | null
          created_at: string
          employee_id: string
          fechamento_mes_id: string
          fixo_valor: number
          id: string
          ifood_mensal: number | null
          ifood_pendente: number | null
          ifood_ultrameta_global: number | null
          marcado_critico: boolean
          meta_mes_id: string | null
          multiplicador: number
          ote_total: number
          percentual_global: number
          status: string
          total_conta: number
          updated_at: string
          variavel_paga: number
          variavel_valor: number
        }
        Insert: {
          ajuste_manual_motivo?: string | null
          ajuste_manual_valor?: number
          cargo_catalogo_id?: string | null
          created_at?: string
          employee_id: string
          fechamento_mes_id: string
          fixo_valor?: number
          id?: string
          ifood_mensal?: number | null
          ifood_pendente?: number | null
          ifood_ultrameta_global?: number | null
          marcado_critico?: boolean
          meta_mes_id?: string | null
          multiplicador?: number
          ote_total?: number
          percentual_global?: number
          status?: string
          total_conta?: number
          updated_at?: string
          variavel_paga?: number
          variavel_valor?: number
        }
        Update: {
          ajuste_manual_motivo?: string | null
          ajuste_manual_valor?: number
          cargo_catalogo_id?: string | null
          created_at?: string
          employee_id?: string
          fechamento_mes_id?: string
          fixo_valor?: number
          id?: string
          ifood_mensal?: number | null
          ifood_pendente?: number | null
          ifood_ultrameta_global?: number | null
          marcado_critico?: boolean
          meta_mes_id?: string | null
          multiplicador?: number
          ote_total?: number
          percentual_global?: number
          status?: string
          total_conta?: number
          updated_at?: string
          variavel_paga?: number
          variavel_valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fechamento_pessoa_cargo_catalogo_id_fkey"
            columns: ["cargo_catalogo_id"]
            isOneToOne: false
            referencedRelation: "cargos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_pessoa_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_pessoa_fechamento_mes_id_fkey"
            columns: ["fechamento_mes_id"]
            isOneToOne: false
            referencedRelation: "fechamento_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamento_pessoa_meta_mes_id_fkey"
            columns: ["meta_mes_id"]
            isOneToOne: false
            referencedRelation: "metas_mes"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_data: {
        Row: {
          conversion_rate: number | null
          created_at: string | null
          date: string
          id: string
          leads_count: number
          stage_id: string
          updated_at: string | null
        }
        Insert: {
          conversion_rate?: number | null
          created_at?: string | null
          date: string
          id?: string
          leads_count?: number
          stage_id: string
          updated_at?: string | null
        }
        Update: {
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          leads_count?: number
          stage_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_data_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          created_at: string | null
          funnel_id: string
          id: string
          name: string
          stage_number: number
          target_conversion_rate: number | null
        }
        Insert: {
          created_at?: string | null
          funnel_id: string
          id?: string
          name: string
          stage_number: number
          target_conversion_rate?: number | null
        }
        Update: {
          created_at?: string | null
          funnel_id?: string
          id?: string
          name?: string
          stage_number?: number
          target_conversion_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          channel_id: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      ghost_appointments_audit: {
        Row: {
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          deal_id: string
          detection_date: string
          detection_reason: string
          distinct_days: number
          first_r1_date: string | null
          ghost_type: string
          id: string
          last_r1_date: string | null
          movement_history: Json
          no_show_count: number
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sdr_email: string
          sdr_name: string | null
          severity: string
          status: string | null
          total_r1_agendada: number
          updated_at: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deal_id: string
          detection_date?: string
          detection_reason: string
          distinct_days?: number
          first_r1_date?: string | null
          ghost_type: string
          id?: string
          last_r1_date?: string | null
          movement_history?: Json
          no_show_count?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sdr_email: string
          sdr_name?: string | null
          severity: string
          status?: string | null
          total_r1_agendada?: number
          updated_at?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deal_id?: string
          detection_date?: string
          detection_reason?: string
          distinct_days?: number
          first_r1_date?: string | null
          ghost_type?: string
          id?: string
          last_r1_date?: string | null
          movement_history?: Json
          no_show_count?: number
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sdr_email?: string
          sdr_name?: string | null
          severity?: string
          status?: string | null
          total_r1_agendada?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      gr_actions: {
        Row: {
          action_type: Database["public"]["Enums"]["gr_action_type"]
          created_at: string
          description: string | null
          entry_id: string
          id: string
          metadata: Json | null
          performed_by: string
        }
        Insert: {
          action_type: Database["public"]["Enums"]["gr_action_type"]
          created_at?: string
          description?: string | null
          entry_id: string
          id?: string
          metadata?: Json | null
          performed_by: string
        }
        Update: {
          action_type?: Database["public"]["Enums"]["gr_action_type"]
          created_at?: string
          description?: string | null
          entry_id?: string
          id?: string
          metadata?: Json | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "gr_actions_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "gr_wallet_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      gr_distribution_rules: {
        Row: {
          balance_type: string
          bu: string
          created_at: string
          id: string
          is_active: boolean
          manager_id: string | null
          mode: Database["public"]["Enums"]["gr_distribution_mode"]
          updated_at: string
        }
        Insert: {
          balance_type?: string
          bu: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          mode?: Database["public"]["Enums"]["gr_distribution_mode"]
          updated_at?: string
        }
        Update: {
          balance_type?: string
          bu?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          mode?: Database["public"]["Enums"]["gr_distribution_mode"]
          updated_at?: string
        }
        Relationships: []
      }
      gr_transfers_log: {
        Row: {
          created_at: string
          entry_id: string
          from_wallet_id: string | null
          id: string
          reason: string | null
          to_wallet_id: string | null
          transferred_by: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          from_wallet_id?: string | null
          id?: string
          reason?: string | null
          to_wallet_id?: string | null
          transferred_by: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          from_wallet_id?: string | null
          id?: string
          reason?: string | null
          to_wallet_id?: string | null
          transferred_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "gr_transfers_log_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "gr_wallet_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gr_transfers_log_from_wallet_id_fkey"
            columns: ["from_wallet_id"]
            isOneToOne: false
            referencedRelation: "gr_wallets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gr_transfers_log_to_wallet_id_fkey"
            columns: ["to_wallet_id"]
            isOneToOne: false
            referencedRelation: "gr_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      gr_wallet_entries: {
        Row: {
          assigned_by: string | null
          contact_id: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          deal_id: string | null
          entry_date: string
          entry_source: string
          financial_profile: Json | null
          id: string
          last_contact_at: string | null
          next_action_date: string | null
          notes: string | null
          product_purchased: string | null
          purchase_value: number | null
          recommended_products: string[] | null
          status: Database["public"]["Enums"]["gr_entry_status"]
          transaction_id: string | null
          updated_at: string
          wallet_id: string
        }
        Insert: {
          assigned_by?: string | null
          contact_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          deal_id?: string | null
          entry_date?: string
          entry_source?: string
          financial_profile?: Json | null
          id?: string
          last_contact_at?: string | null
          next_action_date?: string | null
          notes?: string | null
          product_purchased?: string | null
          purchase_value?: number | null
          recommended_products?: string[] | null
          status?: Database["public"]["Enums"]["gr_entry_status"]
          transaction_id?: string | null
          updated_at?: string
          wallet_id: string
        }
        Update: {
          assigned_by?: string | null
          contact_id?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          deal_id?: string | null
          entry_date?: string
          entry_source?: string
          financial_profile?: Json | null
          id?: string
          last_contact_at?: string | null
          next_action_date?: string | null
          notes?: string | null
          product_purchased?: string | null
          purchase_value?: number | null
          recommended_products?: string[] | null
          status?: Database["public"]["Enums"]["gr_entry_status"]
          transaction_id?: string | null
          updated_at?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gr_wallet_entries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gr_wallet_entries_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: true
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gr_wallet_entries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "hubla_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gr_wallet_entries_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "gr_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      gr_wallets: {
        Row: {
          bu: string
          created_at: string
          current_count: number
          gr_user_id: string
          id: string
          is_open: boolean
          max_capacity: number | null
          updated_at: string
        }
        Insert: {
          bu?: string
          created_at?: string
          current_count?: number
          gr_user_id: string
          id?: string
          is_open?: boolean
          max_capacity?: number | null
          updated_at?: string
        }
        Update: {
          bu?: string
          created_at?: string
          current_count?: number
          gr_user_id?: string
          id?: string
          is_open?: boolean
          max_capacity?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      hubla_transactions: {
        Row: {
          count_in_dashboard: boolean | null
          created_at: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          event_type: string
          excluded_from_cart: boolean | null
          gross_override: number | null
          hubla_id: string
          id: string
          installment_fee_cents: number | null
          installment_number: number | null
          is_offer: boolean | null
          linked_attendee_id: string | null
          net_value: number | null
          offer_id: string | null
          offer_name: string | null
          payment_method: string | null
          product_category: string | null
          product_code: string | null
          product_name: string
          product_price: number | null
          product_type: string | null
          raw_data: Json | null
          sale_date: string
          sale_origin: string | null
          sale_status: string | null
          source: string | null
          subtotal_cents: number | null
          total_installments: number | null
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          count_in_dashboard?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          event_type: string
          excluded_from_cart?: boolean | null
          gross_override?: number | null
          hubla_id: string
          id?: string
          installment_fee_cents?: number | null
          installment_number?: number | null
          is_offer?: boolean | null
          linked_attendee_id?: string | null
          net_value?: number | null
          offer_id?: string | null
          offer_name?: string | null
          payment_method?: string | null
          product_category?: string | null
          product_code?: string | null
          product_name: string
          product_price?: number | null
          product_type?: string | null
          raw_data?: Json | null
          sale_date: string
          sale_origin?: string | null
          sale_status?: string | null
          source?: string | null
          subtotal_cents?: number | null
          total_installments?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          count_in_dashboard?: boolean | null
          created_at?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          event_type?: string
          excluded_from_cart?: boolean | null
          gross_override?: number | null
          hubla_id?: string
          id?: string
          installment_fee_cents?: number | null
          installment_number?: number | null
          is_offer?: boolean | null
          linked_attendee_id?: string | null
          net_value?: number | null
          offer_id?: string | null
          offer_name?: string | null
          payment_method?: string | null
          product_category?: string | null
          product_code?: string | null
          product_name?: string
          product_price?: number | null
          product_type?: string | null
          raw_data?: Json | null
          sale_date?: string
          sale_origin?: string | null
          sale_status?: string | null
          source?: string | null
          subtotal_cents?: number | null
          total_installments?: number | null
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hubla_transactions_linked_attendee_id_fkey"
            columns: ["linked_attendee_id"]
            isOneToOne: false
            referencedRelation: "meeting_slot_attendees"
            referencedColumns: ["id"]
          },
        ]
      }
      hubla_webhook_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          processed_at: string | null
          processing_time_ms: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed_at?: string | null
          processing_time_ms?: number | null
          status?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed_at?: string | null
          processing_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      incorporator_goals: {
        Row: {
          created_at: string | null
          efeito_alavanca: number | null
          id: string
          meta: number | null
          month: string
          resultado: number | null
          supermeta: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          efeito_alavanca?: number | null
          id?: string
          meta?: number | null
          month: string
          resultado?: number | null
          supermeta?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          efeito_alavanca?: number | null
          id?: string
          meta?: number | null
          month?: string
          resultado?: number | null
          supermeta?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_sync: string | null
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          name: string
          type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_sync?: string | null
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      lead_assignments: {
        Row: {
          assigned_date: string
          created_at: string | null
          id: string
          lead_id: string | null
          sdr_name: string
        }
        Insert: {
          assigned_date: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          sdr_name: string
        }
        Update: {
          assigned_date?: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          sdr_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_config: {
        Row: {
          created_at: string | null
          current_count: number | null
          id: string
          is_active: boolean | null
          origin_id: string
          percentage: number
          updated_at: string | null
          user_email: string
          user_name: string | null
        }
        Insert: {
          created_at?: string | null
          current_count?: number | null
          id?: string
          is_active?: boolean | null
          origin_id: string
          percentage?: number
          updated_at?: string | null
          user_email: string
          user_name?: string | null
        }
        Update: {
          created_at?: string | null
          current_count?: number | null
          id?: string
          is_active?: boolean | null
          origin_id?: string
          percentage?: number
          updated_at?: string | null
          user_email?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_config_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tracking: {
        Row: {
          closer: string | null
          created_at: string | null
          dias_compra: number | null
          id: string
          lead_id: string | null
          perfil: string | null
          produto_final: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          closer?: string | null
          created_at?: string | null
          dias_compra?: number | null
          id?: string
          lead_id?: string | null
          perfil?: string | null
          produto_final?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          closer?: string | null
          created_at?: string | null
          dias_compra?: number | null
          id?: string
          lead_id?: string | null
          perfil?: string | null
          produto_final?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_tracking_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          lead_date: string
          name: string
          origin: string | null
          phone: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          lead_date: string
          name: string
          origin?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          lead_date?: string
          name?: string
          origin?: string | null
          phone?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      local_pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          name: string
          origin_id: string | null
          stage_order: number
          stage_type: string | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          origin_id?: string | null
          stage_order?: number
          stage_type?: string | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          origin_id?: string | null
          stage_order?: number
          stage_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "local_pipeline_stages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "crm_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "local_pipeline_stages_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_slot_attendees: {
        Row: {
          already_builds: boolean | null
          attendee_name: string | null
          attendee_phone: string | null
          booked_at: string | null
          booked_by: string | null
          calendly_invitee_uri: string | null
          carrinho_status: string | null
          carrinho_updated_at: string | null
          closer_notes: string | null
          contact_id: string | null
          contract_paid_at: string | null
          created_at: string | null
          deal_id: string | null
          decision_maker_type: string | null
          id: string
          is_decision_maker: boolean | null
          is_partner: boolean | null
          is_reschedule: boolean | null
          lead_profile: string | null
          meeting_link: string | null
          meeting_slot_id: string
          notes: string | null
          notified_at: string | null
          parent_attendee_id: string | null
          partner_name: string | null
          r2_confirmation: string | null
          r2_observations: string | null
          r2_status_id: string | null
          status: string | null
          thermometer_ids: string[] | null
          updated_at: string | null
          updated_by: string | null
          video_status: string | null
        }
        Insert: {
          already_builds?: boolean | null
          attendee_name?: string | null
          attendee_phone?: string | null
          booked_at?: string | null
          booked_by?: string | null
          calendly_invitee_uri?: string | null
          carrinho_status?: string | null
          carrinho_updated_at?: string | null
          closer_notes?: string | null
          contact_id?: string | null
          contract_paid_at?: string | null
          created_at?: string | null
          deal_id?: string | null
          decision_maker_type?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_partner?: boolean | null
          is_reschedule?: boolean | null
          lead_profile?: string | null
          meeting_link?: string | null
          meeting_slot_id: string
          notes?: string | null
          notified_at?: string | null
          parent_attendee_id?: string | null
          partner_name?: string | null
          r2_confirmation?: string | null
          r2_observations?: string | null
          r2_status_id?: string | null
          status?: string | null
          thermometer_ids?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          video_status?: string | null
        }
        Update: {
          already_builds?: boolean | null
          attendee_name?: string | null
          attendee_phone?: string | null
          booked_at?: string | null
          booked_by?: string | null
          calendly_invitee_uri?: string | null
          carrinho_status?: string | null
          carrinho_updated_at?: string | null
          closer_notes?: string | null
          contact_id?: string | null
          contract_paid_at?: string | null
          created_at?: string | null
          deal_id?: string | null
          decision_maker_type?: string | null
          id?: string
          is_decision_maker?: boolean | null
          is_partner?: boolean | null
          is_reschedule?: boolean | null
          lead_profile?: string | null
          meeting_link?: string | null
          meeting_slot_id?: string
          notes?: string | null
          notified_at?: string | null
          parent_attendee_id?: string | null
          partner_name?: string | null
          r2_confirmation?: string | null
          r2_observations?: string | null
          r2_status_id?: string | null
          status?: string | null
          thermometer_ids?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
          video_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_slot_attendees_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_attendees_booked_by_fkey"
            columns: ["booked_by"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "meeting_slot_attendees_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_attendees_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_attendees_meeting_slot_id_fkey"
            columns: ["meeting_slot_id"]
            isOneToOne: false
            referencedRelation: "meeting_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_attendees_parent_attendee_id_fkey"
            columns: ["parent_attendee_id"]
            isOneToOne: false
            referencedRelation: "meeting_slot_attendees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slot_attendees_r2_status_id_fkey"
            columns: ["r2_status_id"]
            isOneToOne: false
            referencedRelation: "r2_status_options"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_slots: {
        Row: {
          booked_by: string | null
          calendly_event_type_uri: string | null
          calendly_event_uri: string | null
          calendly_invitee_uri: string | null
          closer_id: string
          closer_notes: string | null
          contact_id: string | null
          created_at: string | null
          deal_id: string | null
          duration_minutes: number | null
          google_event_id: string | null
          id: string
          lead_type: string | null
          max_attendees: number | null
          meeting_link: string | null
          meeting_type: string | null
          notes: string | null
          scheduled_at: string
          source: string | null
          status: string | null
          updated_at: string | null
          video_conference_link: string | null
        }
        Insert: {
          booked_by?: string | null
          calendly_event_type_uri?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          closer_id: string
          closer_notes?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          id?: string
          lead_type?: string | null
          max_attendees?: number | null
          meeting_link?: string | null
          meeting_type?: string | null
          notes?: string | null
          scheduled_at: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
          video_conference_link?: string | null
        }
        Update: {
          booked_by?: string | null
          calendly_event_type_uri?: string | null
          calendly_event_uri?: string | null
          calendly_invitee_uri?: string | null
          closer_id?: string
          closer_notes?: string | null
          contact_id?: string | null
          created_at?: string | null
          deal_id?: string | null
          duration_minutes?: number | null
          google_event_id?: string | null
          id?: string
          lead_type?: string | null
          max_attendees?: number | null
          meeting_link?: string | null
          meeting_type?: string | null
          notes?: string | null
          scheduled_at?: string
          source?: string | null
          status?: string | null
          updated_at?: string | null
          video_conference_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_slots_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slots_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_slots_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_componentes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          meta_mes_id: string
          nome_componente: string
          ordem: number
          valor_base: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta_mes_id: string
          nome_componente: string
          ordem?: number
          valor_base?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          meta_mes_id?: string
          nome_componente?: string
          ordem?: number
          valor_base?: number
        }
        Relationships: [
          {
            foreignKeyName: "metas_componentes_meta_mes_id_fkey"
            columns: ["meta_mes_id"]
            isOneToOne: false
            referencedRelation: "metas_mes"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_mes: {
        Row: {
          area: string
          ativo: boolean
          cargo_base: string
          cargo_catalogo_id: string | null
          competencia: string
          created_at: string
          created_by: string | null
          id: string
          nivel: number | null
          observacao: string | null
          regua_id: string | null
          updated_at: string
        }
        Insert: {
          area: string
          ativo?: boolean
          cargo_base: string
          cargo_catalogo_id?: string | null
          competencia: string
          created_at?: string
          created_by?: string | null
          id?: string
          nivel?: number | null
          observacao?: string | null
          regua_id?: string | null
          updated_at?: string
        }
        Update: {
          area?: string
          ativo?: boolean
          cargo_base?: string
          cargo_catalogo_id?: string | null
          competencia?: string
          created_at?: string
          created_by?: string | null
          id?: string
          nivel?: number | null
          observacao?: string | null
          regua_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_mes_cargo_catalogo_id_fkey"
            columns: ["cargo_catalogo_id"]
            isOneToOne: false
            referencedRelation: "cargos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metas_mes_regua_id_fkey"
            columns: ["regua_id"]
            isOneToOne: false
            referencedRelation: "regua_multiplicador"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_costs: {
        Row: {
          amount: number
          cost_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_recurring: boolean | null
          month: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          cost_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          month: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          cost_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          month?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      organograma: {
        Row: {
          ativo: boolean | null
          cargo_catalogo_id: string | null
          created_at: string | null
          departamento: string | null
          id: string
          parent_id: string | null
          posicao_ordem: number | null
          squad: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          cargo_catalogo_id?: string | null
          created_at?: string | null
          departamento?: string | null
          id?: string
          parent_id?: string | null
          posicao_ordem?: number | null
          squad?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          cargo_catalogo_id?: string | null
          created_at?: string | null
          departamento?: string | null
          id?: string
          parent_id?: string | null
          posicao_ordem?: number | null
          squad?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organograma_cargo_catalogo_id_fkey"
            columns: ["cargo_catalogo_id"]
            isOneToOne: false
            referencedRelation: "cargos_catalogo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organograma_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "organograma"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_returns: {
        Row: {
          blocked: boolean
          contact_email: string | null
          contact_id: string | null
          contact_name: string | null
          created_at: string
          id: string
          notes: string | null
          original_deal_id: string | null
          partner_product: string
          return_product: string | null
          return_source: string
          return_value: number | null
          reviewed_at: string | null
          reviewed_by: string | null
        }
        Insert: {
          blocked?: boolean
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          original_deal_id?: string | null
          partner_product: string
          return_product?: string | null
          return_source: string
          return_value?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Update: {
          blocked?: boolean
          contact_email?: string | null
          contact_id?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          original_deal_id?: string | null
          partner_product?: string
          return_product?: string | null
          return_source?: string
          return_value?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_returns_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_permissions: {
        Row: {
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          group_id: string | null
          id: string
          origin_id: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          origin_id?: string | null
          role: string
          updated_at?: string | null
        }
        Update: {
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          group_id?: string | null
          id?: string
          origin_id?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "crm_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_permissions_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      playbook_docs: {
        Row: {
          ativo: boolean
          categoria: Database["public"]["Enums"]["playbook_categoria"]
          conteudo_rico: string | null
          created_at: string
          criado_por: string | null
          data_publicacao: string
          descricao: string | null
          id: string
          link_url: string | null
          obrigatorio: boolean
          role: Database["public"]["Enums"]["playbook_role"]
          storage_path: string | null
          storage_url: string | null
          tipo_conteudo: Database["public"]["Enums"]["playbook_tipo_conteudo"]
          titulo: string
          updated_at: string
          versao: string
        }
        Insert: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["playbook_categoria"]
          conteudo_rico?: string | null
          created_at?: string
          criado_por?: string | null
          data_publicacao?: string
          descricao?: string | null
          id?: string
          link_url?: string | null
          obrigatorio?: boolean
          role: Database["public"]["Enums"]["playbook_role"]
          storage_path?: string | null
          storage_url?: string | null
          tipo_conteudo: Database["public"]["Enums"]["playbook_tipo_conteudo"]
          titulo: string
          updated_at?: string
          versao?: string
        }
        Update: {
          ativo?: boolean
          categoria?: Database["public"]["Enums"]["playbook_categoria"]
          conteudo_rico?: string | null
          created_at?: string
          criado_por?: string | null
          data_publicacao?: string
          descricao?: string | null
          id?: string
          link_url?: string | null
          obrigatorio?: boolean
          role?: Database["public"]["Enums"]["playbook_role"]
          storage_path?: string | null
          storage_url?: string | null
          tipo_conteudo?: Database["public"]["Enums"]["playbook_tipo_conteudo"]
          titulo?: string
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      playbook_reads: {
        Row: {
          confirmado_em: string | null
          created_at: string
          id: string
          lido_em: string | null
          notion_page_id: string | null
          playbook_doc_id: string
          status: Database["public"]["Enums"]["playbook_read_status"]
          ultima_acao_em: string
          updated_at: string
          user_id: string
          visualizacoes_qtd: number
        }
        Insert: {
          confirmado_em?: string | null
          created_at?: string
          id?: string
          lido_em?: string | null
          notion_page_id?: string | null
          playbook_doc_id: string
          status?: Database["public"]["Enums"]["playbook_read_status"]
          ultima_acao_em?: string
          updated_at?: string
          user_id: string
          visualizacoes_qtd?: number
        }
        Update: {
          confirmado_em?: string | null
          created_at?: string
          id?: string
          lido_em?: string | null
          notion_page_id?: string | null
          playbook_doc_id?: string
          status?: Database["public"]["Enums"]["playbook_read_status"]
          ultima_acao_em?: string
          updated_at?: string
          user_id?: string
          visualizacoes_qtd?: number
        }
        Relationships: [
          {
            foreignKeyName: "playbook_reads_playbook_doc_id_fkey"
            columns: ["playbook_doc_id"]
            isOneToOne: false
            referencedRelation: "playbook_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      premiacao_ganhadores: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          posicao: number
          premiacao_id: string
          premio_recebido: string | null
          squad: string | null
          valor_final: number | null
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          posicao: number
          premiacao_id: string
          premio_recebido?: string | null
          squad?: string | null
          valor_final?: number | null
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          posicao?: number
          premiacao_id?: string
          premio_recebido?: string | null
          squad?: string | null
          valor_final?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "premiacao_ganhadores_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premiacao_ganhadores_premiacao_id_fkey"
            columns: ["premiacao_id"]
            isOneToOne: false
            referencedRelation: "premiacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      premiacoes: {
        Row: {
          bu: string
          cargos_elegiveis: string[]
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          metrica_config: Json | null
          metrica_ranking: string
          nome: string
          premio_descricao: string
          premio_valor: number | null
          qtd_ganhadores: number
          status: string
          tipo_competicao: string
          updated_at: string
        }
        Insert: {
          bu: string
          cargos_elegiveis?: string[]
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          metrica_config?: Json | null
          metrica_ranking: string
          nome: string
          premio_descricao: string
          premio_valor?: number | null
          qtd_ganhadores?: number
          status?: string
          tipo_competicao?: string
          updated_at?: string
        }
        Update: {
          bu?: string
          cargos_elegiveis?: string[]
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          metrica_config?: Json | null
          metrica_ranking?: string
          nome?: string
          premio_descricao?: string
          premio_valor?: number | null
          qtd_ganhadores?: number
          status?: string
          tipo_competicao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "premiacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "premiacoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      product_configurations: {
        Row: {
          count_in_dashboard: boolean | null
          created_at: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          product_category: string
          product_code: string | null
          product_name: string
          reference_price: number | null
          target_bu: string | null
          updated_at: string | null
        }
        Insert: {
          count_in_dashboard?: boolean | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          product_category?: string
          product_code?: string | null
          product_name: string
          reference_price?: number | null
          target_bu?: string | null
          updated_at?: string | null
        }
        Update: {
          count_in_dashboard?: boolean | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          product_category?: string
          product_code?: string | null
          product_name?: string
          reference_price?: number | null
          target_bu?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_status: string | null
          avatar_url: string | null
          blocked_until: string | null
          can_book_r2: boolean | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          show_on_tv: boolean | null
          squad: string[] | null
          updated_at: string | null
          whatsapp_signature: string | null
        }
        Insert: {
          access_status?: string | null
          avatar_url?: string | null
          blocked_until?: string | null
          can_book_r2?: boolean | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          show_on_tv?: boolean | null
          squad?: string[] | null
          updated_at?: string | null
          whatsapp_signature?: string | null
        }
        Update: {
          access_status?: string | null
          avatar_url?: string | null
          blocked_until?: string | null
          can_book_r2?: boolean | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          show_on_tv?: boolean | null
          squad?: string[] | null
          updated_at?: string | null
          whatsapp_signature?: string | null
        }
        Relationships: []
      }
      project_comments: {
        Row: {
          comment: string
          created_at: string | null
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string | null
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string | null
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          progress: number | null
          responsible_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          progress?: number | null
          responsible_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          progress?: number | null
          responsible_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      qualification_field_configs: {
        Row: {
          created_at: string | null
          created_by: string | null
          fields: Json
          group_id: string | null
          id: string
          is_active: boolean | null
          origin_id: string | null
          scope_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          fields?: Json
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          origin_id?: string | null
          scope_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          fields?: Json
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          origin_id?: string | null
          scope_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qualification_field_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_field_configs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "qualification_field_configs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "crm_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qualification_field_configs_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      r2_daily_slots: {
        Row: {
          closer_id: string
          created_at: string | null
          created_by: string | null
          google_meet_link: string | null
          id: string
          slot_date: string
          start_time: string
        }
        Insert: {
          closer_id: string
          created_at?: string | null
          created_by?: string | null
          google_meet_link?: string | null
          id?: string
          slot_date: string
          start_time: string
        }
        Update: {
          closer_id?: string
          created_at?: string | null
          created_by?: string | null
          google_meet_link?: string | null
          id?: string
          slot_date?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "r2_daily_slots_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
        ]
      }
      r2_status_options: {
        Row: {
          color: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          color?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      r2_thermometer_options: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      r2_vendas_extras: {
        Row: {
          attendee_email: string | null
          attendee_name: string
          attendee_phone: string | null
          closer_id: string | null
          created_at: string | null
          created_by: string | null
          hubla_transaction_id: string | null
          id: string
          notes: string | null
          sale_date: string | null
          week_start: string
        }
        Insert: {
          attendee_email?: string | null
          attendee_name: string
          attendee_phone?: string | null
          closer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          hubla_transaction_id?: string | null
          id?: string
          notes?: string | null
          sale_date?: string | null
          week_start: string
        }
        Update: {
          attendee_email?: string | null
          attendee_name?: string
          attendee_phone?: string | null
          closer_id?: string | null
          created_at?: string | null
          created_by?: string | null
          hubla_transaction_id?: string | null
          id?: string
          notes?: string | null
          sale_date?: string | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "r2_vendas_extras_closer_id_fkey"
            columns: ["closer_id"]
            isOneToOne: false
            referencedRelation: "closers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "r2_vendas_extras_hubla_transaction_id_fkey"
            columns: ["hubla_transaction_id"]
            isOneToOne: false
            referencedRelation: "hubla_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      regua_faixas: {
        Row: {
          created_at: string
          faixa_ate: number
          faixa_de: number
          id: string
          multiplicador: number
          ordem: number
          regua_id: string
        }
        Insert: {
          created_at?: string
          faixa_ate: number
          faixa_de: number
          id?: string
          multiplicador: number
          ordem?: number
          regua_id: string
        }
        Update: {
          created_at?: string
          faixa_ate?: number
          faixa_de?: number
          id?: string
          multiplicador?: number
          ordem?: number
          regua_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "regua_faixas_regua_id_fkey"
            columns: ["regua_id"]
            isOneToOne: false
            referencedRelation: "regua_multiplicador"
            referencedColumns: ["id"]
          },
        ]
      }
      regua_multiplicador: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome_regua: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome_regua: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome_regua?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string | null
          created_by: string | null
          data: Json | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          data?: Json | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          type?: string
        }
        Relationships: []
      }
      rh_nfse: {
        Row: {
          ano: number
          arquivo_url: string | null
          created_at: string | null
          created_by: string | null
          data_envio_nfse: string | null
          data_pagamento: string | null
          employee_id: string
          id: string
          mes: number
          numero_nfse: string | null
          observacoes: string | null
          status_nfse: string | null
          status_pagamento: string | null
          storage_path: string | null
          updated_at: string | null
          updated_by: string | null
          valor_nfse: number
        }
        Insert: {
          ano: number
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          data_envio_nfse?: string | null
          data_pagamento?: string | null
          employee_id: string
          id?: string
          mes: number
          numero_nfse?: string | null
          observacoes?: string | null
          status_nfse?: string | null
          status_pagamento?: string | null
          storage_path?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_nfse?: number
        }
        Update: {
          ano?: number
          arquivo_url?: string | null
          created_at?: string | null
          created_by?: string | null
          data_envio_nfse?: string | null
          data_pagamento?: string | null
          employee_id?: string
          id?: string
          mes?: number
          numero_nfse?: string | null
          observacoes?: string | null
          status_nfse?: string | null
          status_pagamento?: string | null
          storage_path?: string | null
          updated_at?: string | null
          updated_by?: string | null
          valor_nfse?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_nfse_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_level: string
          resource: string
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_level?: string
          resource: string
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_level?: string
          resource?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      role_required_documents: {
        Row: {
          ativo: boolean | null
          cargo: string
          created_at: string | null
          descricao: string | null
          id: string
          prazo_dias: number | null
          tipo_documento: string
        }
        Insert: {
          ativo?: boolean | null
          cargo: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          prazo_dias?: number | null
          tipo_documento: string
        }
        Update: {
          ativo?: boolean | null
          cargo?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          prazo_dias?: number | null
          tipo_documento?: string
        }
        Relationships: []
      }
      sdr: {
        Row: {
          active: boolean | null
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          criado_por: string | null
          email: string | null
          id: string
          meta_diaria: number | null
          name: string
          nivel: number | null
          observacao: string | null
          role_type: string | null
          squad: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          email?: string | null
          id?: string
          meta_diaria?: number | null
          name: string
          nivel?: number | null
          observacao?: string | null
          role_type?: string | null
          squad?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          email?: string | null
          id?: string
          meta_diaria?: number | null
          name?: string
          nivel?: number | null
          observacao?: string | null
          role_type?: string | null
          squad?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sdr_comp_plan: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          criado_por: string | null
          dias_uteis: number | null
          fixo_valor: number
          id: string
          ifood_mensal: number | null
          ifood_ultrameta: number | null
          meta_no_show_pct: number | null
          meta_organizacao: number | null
          meta_reunioes_agendadas: number | null
          meta_reunioes_realizadas: number | null
          meta_tentativas: number | null
          ote_total: number
          sdr_id: string
          status: string | null
          updated_at: string | null
          valor_docs_reuniao: number
          valor_meta_rpg: number
          valor_organizacao: number
          valor_tentativas: number
          variavel_total: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          dias_uteis?: number | null
          fixo_valor?: number
          id?: string
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          meta_no_show_pct?: number | null
          meta_organizacao?: number | null
          meta_reunioes_agendadas?: number | null
          meta_reunioes_realizadas?: number | null
          meta_tentativas?: number | null
          ote_total?: number
          sdr_id: string
          status?: string | null
          updated_at?: string | null
          valor_docs_reuniao?: number
          valor_meta_rpg?: number
          valor_organizacao?: number
          valor_tentativas?: number
          variavel_total?: number
          vigencia_fim?: string | null
          vigencia_inicio: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          criado_por?: string | null
          dias_uteis?: number | null
          fixo_valor?: number
          id?: string
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          meta_no_show_pct?: number | null
          meta_organizacao?: number | null
          meta_reunioes_agendadas?: number | null
          meta_reunioes_realizadas?: number | null
          meta_tentativas?: number | null
          ote_total?: number
          sdr_id?: string
          status?: string | null
          updated_at?: string | null
          valor_docs_reuniao?: number
          valor_meta_rpg?: number
          valor_organizacao?: number
          valor_tentativas?: number
          variavel_total?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "sdr_comp_plan_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_intermediacoes: {
        Row: {
          ano_mes: string
          created_at: string | null
          created_by: string | null
          hubla_transaction_id: string | null
          id: string
          observacao: string | null
          produto_nome: string | null
          sdr_id: string
          valor_venda: number | null
        }
        Insert: {
          ano_mes: string
          created_at?: string | null
          created_by?: string | null
          hubla_transaction_id?: string | null
          id?: string
          observacao?: string | null
          produto_nome?: string | null
          sdr_id: string
          valor_venda?: number | null
        }
        Update: {
          ano_mes?: string
          created_at?: string | null
          created_by?: string | null
          hubla_transaction_id?: string | null
          id?: string
          observacao?: string | null
          produto_nome?: string | null
          sdr_id?: string
          valor_venda?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_intermediacoes_hubla_transaction_id_fkey"
            columns: ["hubla_transaction_id"]
            isOneToOne: false
            referencedRelation: "hubla_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_intermediacoes_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_levels: {
        Row: {
          description: string | null
          dias_uteis: number | null
          fixo_valor: number
          ifood_mensal: number | null
          ifood_ultrameta: number | null
          level: number
          meta_no_show_pct: number | null
          meta_organizacao: number | null
          meta_reunioes_agendadas: number | null
          meta_reunioes_realizadas: number | null
          meta_tentativas: number | null
          ote_total: number | null
          updated_at: string | null
          valor_docs_reuniao: number | null
          valor_meta_rpg: number | null
          valor_organizacao: number | null
          valor_tentativas: number | null
          variavel_total: number | null
        }
        Insert: {
          description?: string | null
          dias_uteis?: number | null
          fixo_valor: number
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          level: number
          meta_no_show_pct?: number | null
          meta_organizacao?: number | null
          meta_reunioes_agendadas?: number | null
          meta_reunioes_realizadas?: number | null
          meta_tentativas?: number | null
          ote_total?: number | null
          updated_at?: string | null
          valor_docs_reuniao?: number | null
          valor_meta_rpg?: number | null
          valor_organizacao?: number | null
          valor_tentativas?: number | null
          variavel_total?: number | null
        }
        Update: {
          description?: string | null
          dias_uteis?: number | null
          fixo_valor?: number
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          level?: number
          meta_no_show_pct?: number | null
          meta_organizacao?: number | null
          meta_reunioes_agendadas?: number | null
          meta_reunioes_realizadas?: number | null
          meta_tentativas?: number | null
          ote_total?: number | null
          updated_at?: string | null
          valor_docs_reuniao?: number | null
          valor_meta_rpg?: number | null
          valor_organizacao?: number | null
          valor_tentativas?: number | null
          variavel_total?: number | null
        }
        Relationships: []
      }
      sdr_month_kpi: {
        Row: {
          ano_mes: string
          created_at: string | null
          id: string
          intermediacoes_contrato: number | null
          ligacoes_contato: number | null
          ligacoes_manual_override: boolean | null
          modo_entrada: string | null
          no_shows: number | null
          reunioes_agendadas: number | null
          reunioes_realizadas: number | null
          score_organizacao: number | null
          sdr_id: string
          taxa_no_show: number | null
          tentativas_auto: number | null
          tentativas_ligacoes: number | null
          updated_at: string | null
        }
        Insert: {
          ano_mes: string
          created_at?: string | null
          id?: string
          intermediacoes_contrato?: number | null
          ligacoes_contato?: number | null
          ligacoes_manual_override?: boolean | null
          modo_entrada?: string | null
          no_shows?: number | null
          reunioes_agendadas?: number | null
          reunioes_realizadas?: number | null
          score_organizacao?: number | null
          sdr_id: string
          taxa_no_show?: number | null
          tentativas_auto?: number | null
          tentativas_ligacoes?: number | null
          updated_at?: string | null
        }
        Update: {
          ano_mes?: string
          created_at?: string | null
          id?: string
          intermediacoes_contrato?: number | null
          ligacoes_contato?: number | null
          ligacoes_manual_override?: boolean | null
          modo_entrada?: string | null
          no_shows?: number | null
          reunioes_agendadas?: number | null
          reunioes_realizadas?: number | null
          score_organizacao?: number | null
          sdr_id?: string
          taxa_no_show?: number | null
          tentativas_auto?: number | null
          tentativas_ligacoes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_month_kpi_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_month_payout: {
        Row: {
          ajustes_json: Json | null
          ano_mes: string
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          departamento_vigente: string | null
          dias_uteis_mes: number | null
          id: string
          ifood_mensal: number | null
          ifood_ultrameta: number | null
          ifood_ultrameta_autorizado: boolean | null
          ifood_ultrameta_autorizado_em: string | null
          ifood_ultrameta_autorizado_por: string | null
          meta_agendadas_ajustada: number | null
          meta_realizadas_ajustada: number | null
          meta_tentativas_ajustada: number | null
          mult_organizacao: number | null
          mult_reunioes_agendadas: number | null
          mult_reunioes_realizadas: number | null
          mult_tentativas: number | null
          nfse_id: string | null
          pct_organizacao: number | null
          pct_reunioes_agendadas: number | null
          pct_reunioes_realizadas: number | null
          pct_tentativas: number | null
          sdr_id: string
          status: string | null
          total_conta: number | null
          total_ifood: number | null
          updated_at: string | null
          valor_fixo: number | null
          valor_organizacao: number | null
          valor_reunioes_agendadas: number | null
          valor_reunioes_realizadas: number | null
          valor_tentativas: number | null
          valor_variavel_total: number | null
        }
        Insert: {
          ajustes_json?: Json | null
          ano_mes: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          departamento_vigente?: string | null
          dias_uteis_mes?: number | null
          id?: string
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          ifood_ultrameta_autorizado?: boolean | null
          ifood_ultrameta_autorizado_em?: string | null
          ifood_ultrameta_autorizado_por?: string | null
          meta_agendadas_ajustada?: number | null
          meta_realizadas_ajustada?: number | null
          meta_tentativas_ajustada?: number | null
          mult_organizacao?: number | null
          mult_reunioes_agendadas?: number | null
          mult_reunioes_realizadas?: number | null
          mult_tentativas?: number | null
          nfse_id?: string | null
          pct_organizacao?: number | null
          pct_reunioes_agendadas?: number | null
          pct_reunioes_realizadas?: number | null
          pct_tentativas?: number | null
          sdr_id: string
          status?: string | null
          total_conta?: number | null
          total_ifood?: number | null
          updated_at?: string | null
          valor_fixo?: number | null
          valor_organizacao?: number | null
          valor_reunioes_agendadas?: number | null
          valor_reunioes_realizadas?: number | null
          valor_tentativas?: number | null
          valor_variavel_total?: number | null
        }
        Update: {
          ajustes_json?: Json | null
          ano_mes?: string
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          departamento_vigente?: string | null
          dias_uteis_mes?: number | null
          id?: string
          ifood_mensal?: number | null
          ifood_ultrameta?: number | null
          ifood_ultrameta_autorizado?: boolean | null
          ifood_ultrameta_autorizado_em?: string | null
          ifood_ultrameta_autorizado_por?: string | null
          meta_agendadas_ajustada?: number | null
          meta_realizadas_ajustada?: number | null
          meta_tentativas_ajustada?: number | null
          mult_organizacao?: number | null
          mult_reunioes_agendadas?: number | null
          mult_reunioes_realizadas?: number | null
          mult_tentativas?: number | null
          nfse_id?: string | null
          pct_organizacao?: number | null
          pct_reunioes_agendadas?: number | null
          pct_reunioes_realizadas?: number | null
          pct_tentativas?: number | null
          sdr_id?: string
          status?: string | null
          total_conta?: number | null
          total_ifood?: number | null
          updated_at?: string | null
          valor_fixo?: number | null
          valor_organizacao?: number | null
          valor_reunioes_agendadas?: number | null
          valor_reunioes_realizadas?: number | null
          valor_tentativas?: number | null
          valor_variavel_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_month_payout_nfse_id_fkey"
            columns: ["nfse_id"]
            isOneToOne: false
            referencedRelation: "rh_nfse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sdr_month_payout_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_payout_audit_log: {
        Row: {
          campo: string
          created_at: string | null
          id: string
          motivo: string | null
          payout_id: string
          user_id: string | null
          valor_anterior: string | null
          valor_novo: string | null
        }
        Insert: {
          campo: string
          created_at?: string | null
          id?: string
          motivo?: string | null
          payout_id: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Update: {
          campo?: string
          created_at?: string | null
          id?: string
          motivo?: string | null
          payout_id?: string
          user_id?: string | null
          valor_anterior?: string | null
          valor_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sdr_payout_audit_log_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "sdr_month_payout"
            referencedColumns: ["id"]
          },
        ]
      }
      sdr_review_requests: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          periodo: string
          status: string
          tipo_problema: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          periodo: string
          status?: string
          tipo_problema: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          periodo?: string
          status?: string
          tipo_problema?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      squads: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          departamento_id: string | null
          id: string
          nome: string
          ordem: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          departamento_id?: string | null
          id?: string
          nome: string
          ordem?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          departamento_id?: string | null
          id?: string
          nome?: string
          ordem?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "squads_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_attempt_limits: {
        Row: {
          created_at: string
          id: string
          max_attempts: number
          stage_id: string | null
          stage_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_attempts?: number
          stage_id?: string | null
          stage_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_attempts?: number
          stage_id?: string | null
          stage_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_attempt_limits_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: true
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_permissions: {
        Row: {
          can_edit: boolean | null
          can_move_from: boolean | null
          can_move_to: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          stage_id: string
          stage_uuid: string | null
        }
        Insert: {
          can_edit?: boolean | null
          can_move_from?: boolean | null
          can_move_to?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          stage_id: string
          stage_uuid?: string | null
        }
        Update: {
          can_edit?: boolean | null
          can_move_from?: boolean | null
          can_move_to?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          stage_id?: string
          stage_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_permissions_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "deal_stages"
            referencedColumns: ["stage_id"]
          },
          {
            foreignKeyName: "stage_permissions_stage_uuid_fkey"
            columns: ["stage_uuid"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string
          last_page: number | null
          metadata: Json | null
          started_at: string | null
          status: string
          total_processed: number | null
          total_skipped: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          last_page?: number | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          total_processed?: number | null
          total_skipped?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          last_page?: number | null
          metadata?: Json | null
          started_at?: string | null
          status?: string
          total_processed?: number | null
          total_skipped?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      task_spaces: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          icon: string | null
          id: string
          is_private: boolean | null
          name: string
          order_index: number | null
          parent_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          is_private?: boolean | null
          name: string
          order_index?: number | null
          parent_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          icon?: string | null
          id?: string
          is_private?: boolean | null
          name?: string
          order_index?: number | null
          parent_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_spaces_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      team_monthly_goal_winners: {
        Row: {
          autorizado: boolean | null
          autorizado_em: string | null
          autorizado_por: string | null
          created_at: string | null
          goal_id: string | null
          id: string
          sdr_id: string | null
          tipo_premio: string
          valor_premio: number
        }
        Insert: {
          autorizado?: boolean | null
          autorizado_em?: string | null
          autorizado_por?: string | null
          created_at?: string | null
          goal_id?: string | null
          id?: string
          sdr_id?: string | null
          tipo_premio: string
          valor_premio: number
        }
        Update: {
          autorizado?: boolean | null
          autorizado_em?: string | null
          autorizado_por?: string | null
          created_at?: string | null
          goal_id?: string | null
          id?: string
          sdr_id?: string | null
          tipo_premio?: string
          valor_premio?: number
        }
        Relationships: [
          {
            foreignKeyName: "team_monthly_goal_winners_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "team_monthly_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_monthly_goal_winners_sdr_id_fkey"
            columns: ["sdr_id"]
            isOneToOne: false
            referencedRelation: "sdr"
            referencedColumns: ["id"]
          },
        ]
      }
      team_monthly_goals: {
        Row: {
          ano_mes: string
          bu: string
          created_at: string | null
          created_by: string | null
          id: string
          meta_divina_premio_closer: number | null
          meta_divina_premio_sdr: number | null
          meta_divina_valor: number | null
          meta_premio_ifood: number | null
          meta_valor: number | null
          supermeta_premio_ifood: number | null
          supermeta_valor: number | null
          ultrameta_premio_ifood: number | null
          ultrameta_valor: number | null
          updated_at: string | null
        }
        Insert: {
          ano_mes: string
          bu?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          meta_divina_premio_closer?: number | null
          meta_divina_premio_sdr?: number | null
          meta_divina_valor?: number | null
          meta_premio_ifood?: number | null
          meta_valor?: number | null
          supermeta_premio_ifood?: number | null
          supermeta_valor?: number | null
          ultrameta_premio_ifood?: number | null
          ultrameta_valor?: number | null
          updated_at?: string | null
        }
        Update: {
          ano_mes?: string
          bu?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          meta_divina_premio_closer?: number | null
          meta_divina_premio_sdr?: number | null
          meta_divina_valor?: number | null
          meta_premio_ifood?: number | null
          meta_valor?: number | null
          supermeta_premio_ifood?: number | null
          supermeta_valor?: number | null
          ultrameta_premio_ifood?: number | null
          ultrameta_valor?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_targets: {
        Row: {
          created_at: string | null
          created_by: string | null
          current_value: number | null
          id: string
          origin_id: string | null
          reference_id: string | null
          target_name: string
          target_type: string
          target_value: number
          updated_at: string | null
          week_end: string
          week_start: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          id?: string
          origin_id?: string | null
          reference_id?: string | null
          target_name: string
          target_type: string
          target_value?: number
          updated_at?: string | null
          week_end: string
          week_start: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          current_value?: number | null
          id?: string
          origin_id?: string | null
          reference_id?: string | null
          target_name?: string
          target_type?: string
          target_value?: number
          updated_at?: string | null
          week_end?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_targets_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category_id: string | null
          channel_id: string | null
          created_at: string | null
          created_by: string | null
          date: string
          description: string
          id: string
          status: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          description: string
          id?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          status?: Database["public"]["Enums"]["transaction_status"] | null
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_employment_data: {
        Row: {
          commission_rate: number | null
          created_at: string | null
          department: string | null
          fixed_salary: number | null
          hire_date: string | null
          id: string
          is_active: boolean | null
          ote: number | null
          position: string | null
          status: Database["public"]["Enums"]["user_status"]
          termination_date: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          commission_rate?: number | null
          created_at?: string | null
          department?: string | null
          fixed_salary?: number | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          ote?: number | null
          position?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          termination_date?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          commission_rate?: number | null
          created_at?: string | null
          department?: string | null
          fixed_salary?: number | null
          hire_date?: string | null
          id?: string
          is_active?: boolean | null
          ote?: number | null
          position?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_files: {
        Row: {
          categoria_cargo: string | null
          created_at: string | null
          data_upload: string
          descricao: string | null
          file_name: string
          file_size: number | null
          id: string
          storage_path: string
          storage_url: string
          tipo: Database["public"]["Enums"]["user_file_type"]
          titulo: string
          updated_at: string | null
          uploaded_by: string
          user_id: string
          visivel_para_usuario: boolean
        }
        Insert: {
          categoria_cargo?: string | null
          created_at?: string | null
          data_upload?: string
          descricao?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          storage_path: string
          storage_url: string
          tipo: Database["public"]["Enums"]["user_file_type"]
          titulo: string
          updated_at?: string | null
          uploaded_by: string
          user_id: string
          visivel_para_usuario?: boolean
        }
        Update: {
          categoria_cargo?: string | null
          created_at?: string | null
          data_upload?: string
          descricao?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          storage_path?: string
          storage_url?: string
          tipo?: Database["public"]["Enums"]["user_file_type"]
          titulo?: string
          updated_at?: string | null
          uploaded_by?: string
          user_id?: string
          visivel_para_usuario?: boolean
        }
        Relationships: []
      }
      user_flags: {
        Row: {
          category: Database["public"]["Enums"]["flag_category"]
          created_at: string | null
          created_by: string | null
          description: string | null
          flag_type: Database["public"]["Enums"]["flag_type"]
          id: string
          is_resolved: boolean | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: number | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["flag_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          flag_type: Database["public"]["Enums"]["flag_type"]
          id?: string
          is_resolved?: boolean | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["flag_category"]
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          flag_type?: Database["public"]["Enums"]["flag_type"]
          id?: string
          is_resolved?: boolean | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: number | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          clint_user_id: string | null
          created_at: string | null
          id: string
          other_integrations: Json | null
          twilio_agent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clint_user_id?: string | null
          created_at?: string | null
          id?: string
          other_integrations?: Json | null
          twilio_agent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clint_user_id?: string | null
          created_at?: string | null
          id?: string
          other_integrations?: Json | null
          twilio_agent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_observations: {
        Row: {
          category: string | null
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_important: boolean | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_important?: boolean | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_important?: boolean | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_level: Database["public"]["Enums"]["permission_level"]
          resource: Database["public"]["Enums"]["resource_type"]
          restrictions: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_level?: Database["public"]["Enums"]["permission_level"]
          resource: Database["public"]["Enums"]["resource_type"]
          restrictions?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_level?: Database["public"]["Enums"]["permission_level"]
          resource?: Database["public"]["Enums"]["resource_type"]
          restrictions?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_performance_summary"
            referencedColumns: ["user_id"]
          },
        ]
      }
      user_targets: {
        Row: {
          created_at: string | null
          current_value: number | null
          end_date: string
          id: string
          is_achieved: boolean | null
          name: string
          period: Database["public"]["Enums"]["target_period"]
          start_date: string
          target_value: number
          type: Database["public"]["Enums"]["target_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          end_date: string
          id?: string
          is_achieved?: boolean | null
          name: string
          period: Database["public"]["Enums"]["target_period"]
          start_date: string
          target_value: number
          type: Database["public"]["Enums"]["target_type"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          end_date?: string
          id?: string
          is_achieved?: boolean | null
          name?: string
          period?: Database["public"]["Enums"]["target_period"]
          start_date?: string
          target_value?: number
          type?: Database["public"]["Enums"]["target_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_configs: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          error_count: number | null
          events: string[]
          headers: Json | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          method: string | null
          name: string
          origin_id: string | null
          stage_ids: string[] | null
          success_count: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          error_count?: number | null
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          method?: string | null
          name: string
          origin_id?: string | null
          stage_ids?: string[] | null
          success_count?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          error_count?: number | null
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          method?: string | null
          name?: string
          origin_id?: string | null
          stage_ids?: string[] | null
          success_count?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          auth_header_name: string | null
          auth_header_value: string | null
          auto_tags: string[] | null
          created_at: string | null
          created_by: string | null
          description: string | null
          field_mapping: Json | null
          id: string
          is_active: boolean | null
          last_lead_at: string | null
          leads_received: number | null
          name: string
          origin_id: string | null
          required_fields: string[] | null
          slug: string
          stage_id: string | null
          updated_at: string | null
        }
        Insert: {
          auth_header_name?: string | null
          auth_header_value?: string | null
          auto_tags?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          field_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          last_lead_at?: string | null
          leads_received?: number | null
          name: string
          origin_id?: string | null
          required_fields?: string[] | null
          slug: string
          stage_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_header_name?: string | null
          auth_header_value?: string | null
          auto_tags?: string[] | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          field_mapping?: Json | null
          id?: string
          is_active?: boolean | null
          last_lead_at?: string | null
          leads_received?: number | null
          name?: string
          origin_id?: string | null
          required_fields?: string[] | null
          slug?: string
          stage_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "crm_origins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "local_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_data: Json
          event_type: string
          id: string
          processed_at: string | null
          processing_time_ms: number | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_data: Json
          event_type: string
          id?: string
          processed_at?: string | null
          processing_time_ms?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_data?: Json
          event_type?: string
          id?: string
          processed_at?: string | null
          processing_time_ms?: number | null
          status?: string
        }
        Relationships: []
      }
      weekly_metrics: {
        Row: {
          a010_revenue: number | null
          a010_sales: number | null
          ads_cost: number | null
          approval_notes: string | null
          approval_status: string | null
          approved_at: string | null
          approved_by: string | null
          captacao_revenue: number | null
          captacao_sales: number | null
          cir: number | null
          clint_revenue: number | null
          clube_arremate_revenue: number | null
          clube_arremate_sales: number | null
          contract_revenue: number | null
          contract_sales: number | null
          cpl: number | null
          cplr: number | null
          created_at: string | null
          custo_real: number | null
          efeito_alavanca_revenue: number | null
          efeito_alavanca_sales: number | null
          end_date: string
          faturamento_clint: number | null
          faturamento_total: number | null
          formacao_revenue: number | null
          formacao_sales: number | null
          id: string
          imersao_revenue: number | null
          imersao_sales: number | null
          imersao_socios_revenue: number | null
          imersao_socios_sales: number | null
          incorporador_50k: number | null
          mentoria_caixa_revenue: number | null
          mentoria_caixa_sales: number | null
          mentoria_grupo_caixa_revenue: number | null
          mentoria_grupo_caixa_sales: number | null
          ob_construir: number | null
          ob_construir_alugar_revenue: number | null
          ob_construir_alugar_sales: number | null
          ob_construir_revenue: number | null
          ob_construir_sales: number | null
          ob_evento_revenue: number | null
          ob_evento_sales: number | null
          ob_vitalicio: number | null
          ob_vitalicio_revenue: number | null
          ob_vitalicio_sales: number | null
          office_cost: number | null
          operating_cost: number | null
          operating_profit: number | null
          outros_revenue: number | null
          outros_sales: number | null
          p2_revenue: number | null
          p2_sales: number | null
          parceria_revenue: number | null
          parceria_sales: number | null
          projetos_revenue: number | null
          projetos_sales: number | null
          real_cost: number | null
          renovacao_revenue: number | null
          renovacao_sales: number | null
          roas: number | null
          roi: number | null
          sdr_ia_ig: number | null
          socios_revenue: number | null
          socios_sales: number | null
          stage_01_actual: number | null
          stage_01_rate: number | null
          stage_01_target: number | null
          stage_02_actual: number | null
          stage_02_rate: number | null
          stage_02_target: number | null
          stage_03_actual: number | null
          stage_03_rate: number | null
          stage_03_target: number | null
          stage_04_actual: number | null
          stage_04_rate: number | null
          stage_04_target: number | null
          stage_05_actual: number | null
          stage_05_rate: number | null
          stage_05_target: number | null
          stage_06_actual: number | null
          stage_06_rate: number | null
          stage_06_target: number | null
          stage_07_actual: number | null
          stage_07_rate: number | null
          stage_07_target: number | null
          stage_08_actual: number | null
          stage_08_rate: number | null
          stage_08_target: number | null
          start_date: string
          team_cost: number | null
          total_cost: number | null
          total_revenue: number | null
          ultrameta_clint: number | null
          ultrameta_liquido: number | null
          updated_at: string | null
          week_label: string
        }
        Insert: {
          a010_revenue?: number | null
          a010_sales?: number | null
          ads_cost?: number | null
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          captacao_revenue?: number | null
          captacao_sales?: number | null
          cir?: number | null
          clint_revenue?: number | null
          clube_arremate_revenue?: number | null
          clube_arremate_sales?: number | null
          contract_revenue?: number | null
          contract_sales?: number | null
          cpl?: number | null
          cplr?: number | null
          created_at?: string | null
          custo_real?: number | null
          efeito_alavanca_revenue?: number | null
          efeito_alavanca_sales?: number | null
          end_date: string
          faturamento_clint?: number | null
          faturamento_total?: number | null
          formacao_revenue?: number | null
          formacao_sales?: number | null
          id?: string
          imersao_revenue?: number | null
          imersao_sales?: number | null
          imersao_socios_revenue?: number | null
          imersao_socios_sales?: number | null
          incorporador_50k?: number | null
          mentoria_caixa_revenue?: number | null
          mentoria_caixa_sales?: number | null
          mentoria_grupo_caixa_revenue?: number | null
          mentoria_grupo_caixa_sales?: number | null
          ob_construir?: number | null
          ob_construir_alugar_revenue?: number | null
          ob_construir_alugar_sales?: number | null
          ob_construir_revenue?: number | null
          ob_construir_sales?: number | null
          ob_evento_revenue?: number | null
          ob_evento_sales?: number | null
          ob_vitalicio?: number | null
          ob_vitalicio_revenue?: number | null
          ob_vitalicio_sales?: number | null
          office_cost?: number | null
          operating_cost?: number | null
          operating_profit?: number | null
          outros_revenue?: number | null
          outros_sales?: number | null
          p2_revenue?: number | null
          p2_sales?: number | null
          parceria_revenue?: number | null
          parceria_sales?: number | null
          projetos_revenue?: number | null
          projetos_sales?: number | null
          real_cost?: number | null
          renovacao_revenue?: number | null
          renovacao_sales?: number | null
          roas?: number | null
          roi?: number | null
          sdr_ia_ig?: number | null
          socios_revenue?: number | null
          socios_sales?: number | null
          stage_01_actual?: number | null
          stage_01_rate?: number | null
          stage_01_target?: number | null
          stage_02_actual?: number | null
          stage_02_rate?: number | null
          stage_02_target?: number | null
          stage_03_actual?: number | null
          stage_03_rate?: number | null
          stage_03_target?: number | null
          stage_04_actual?: number | null
          stage_04_rate?: number | null
          stage_04_target?: number | null
          stage_05_actual?: number | null
          stage_05_rate?: number | null
          stage_05_target?: number | null
          stage_06_actual?: number | null
          stage_06_rate?: number | null
          stage_06_target?: number | null
          stage_07_actual?: number | null
          stage_07_rate?: number | null
          stage_07_target?: number | null
          stage_08_actual?: number | null
          stage_08_rate?: number | null
          stage_08_target?: number | null
          start_date: string
          team_cost?: number | null
          total_cost?: number | null
          total_revenue?: number | null
          ultrameta_clint?: number | null
          ultrameta_liquido?: number | null
          updated_at?: string | null
          week_label: string
        }
        Update: {
          a010_revenue?: number | null
          a010_sales?: number | null
          ads_cost?: number | null
          approval_notes?: string | null
          approval_status?: string | null
          approved_at?: string | null
          approved_by?: string | null
          captacao_revenue?: number | null
          captacao_sales?: number | null
          cir?: number | null
          clint_revenue?: number | null
          clube_arremate_revenue?: number | null
          clube_arremate_sales?: number | null
          contract_revenue?: number | null
          contract_sales?: number | null
          cpl?: number | null
          cplr?: number | null
          created_at?: string | null
          custo_real?: number | null
          efeito_alavanca_revenue?: number | null
          efeito_alavanca_sales?: number | null
          end_date?: string
          faturamento_clint?: number | null
          faturamento_total?: number | null
          formacao_revenue?: number | null
          formacao_sales?: number | null
          id?: string
          imersao_revenue?: number | null
          imersao_sales?: number | null
          imersao_socios_revenue?: number | null
          imersao_socios_sales?: number | null
          incorporador_50k?: number | null
          mentoria_caixa_revenue?: number | null
          mentoria_caixa_sales?: number | null
          mentoria_grupo_caixa_revenue?: number | null
          mentoria_grupo_caixa_sales?: number | null
          ob_construir?: number | null
          ob_construir_alugar_revenue?: number | null
          ob_construir_alugar_sales?: number | null
          ob_construir_revenue?: number | null
          ob_construir_sales?: number | null
          ob_evento_revenue?: number | null
          ob_evento_sales?: number | null
          ob_vitalicio?: number | null
          ob_vitalicio_revenue?: number | null
          ob_vitalicio_sales?: number | null
          office_cost?: number | null
          operating_cost?: number | null
          operating_profit?: number | null
          outros_revenue?: number | null
          outros_sales?: number | null
          p2_revenue?: number | null
          p2_sales?: number | null
          parceria_revenue?: number | null
          parceria_sales?: number | null
          projetos_revenue?: number | null
          projetos_sales?: number | null
          real_cost?: number | null
          renovacao_revenue?: number | null
          renovacao_sales?: number | null
          roas?: number | null
          roi?: number | null
          sdr_ia_ig?: number | null
          socios_revenue?: number | null
          socios_sales?: number | null
          stage_01_actual?: number | null
          stage_01_rate?: number | null
          stage_01_target?: number | null
          stage_02_actual?: number | null
          stage_02_rate?: number | null
          stage_02_target?: number | null
          stage_03_actual?: number | null
          stage_03_rate?: number | null
          stage_03_target?: number | null
          stage_04_actual?: number | null
          stage_04_rate?: number | null
          stage_04_target?: number | null
          stage_05_actual?: number | null
          stage_05_rate?: number | null
          stage_05_target?: number | null
          stage_06_actual?: number | null
          stage_06_rate?: number | null
          stage_06_target?: number | null
          stage_07_actual?: number | null
          stage_07_rate?: number | null
          stage_07_target?: number | null
          stage_08_actual?: number | null
          stage_08_rate?: number | null
          stage_08_target?: number | null
          start_date?: string
          team_cost?: number | null
          total_cost?: number | null
          total_revenue?: number | null
          ultrameta_clint?: number | null
          ultrameta_liquido?: number | null
          updated_at?: string | null
          week_label?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          contact_avatar: string | null
          contact_id: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          deal_id: string | null
          id: string
          instance_id: string | null
          is_group: boolean | null
          last_message: string | null
          last_message_at: string | null
          owner_id: string | null
          remote_jid: string
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          contact_avatar?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          instance_id?: string | null
          is_group?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          owner_id?: string | null
          remote_jid: string
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          contact_avatar?: string | null
          contact_id?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          deal_id?: string | null
          id?: string
          instance_id?: string | null
          is_group?: boolean | null
          last_message?: string | null
          last_message_at?: string | null
          owner_id?: string | null
          remote_jid?: string
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          client_token: string | null
          connected_at: string | null
          created_at: string
          created_by: string | null
          id: string
          instance_id: string
          name: string
          phone_number: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          client_token?: string | null
          connected_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id: string
          name?: string
          phone_number?: string | null
          status?: string
          token: string
          updated_at?: string
        }
        Update: {
          client_token?: string | null
          connected_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          instance_id?: string
          name?: string
          phone_number?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: string
          id: string
          message_id_whatsapp: string | null
          metadata: Json | null
          read_at: string | null
          sender_id: string | null
          sender_name: string | null
          sent_at: string
          status: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          id?: string
          message_id_whatsapp?: string | null
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: string
          id?: string
          message_id_whatsapp?: string | null
          metadata?: Json | null
          read_at?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      working_days_calendar: {
        Row: {
          ano_mes: string
          created_at: string | null
          dias_uteis_base: number
          dias_uteis_final: number
          feriados_nacionais: Json | null
          id: string
          ifood_mensal_calculado: number | null
          ifood_valor_dia: number
          observacoes: string | null
          paradas_empresa: Json | null
          updated_at: string | null
        }
        Insert: {
          ano_mes: string
          created_at?: string | null
          dias_uteis_base?: number
          dias_uteis_final?: number
          feriados_nacionais?: Json | null
          id?: string
          ifood_mensal_calculado?: number | null
          ifood_valor_dia?: number
          observacoes?: string | null
          paradas_empresa?: Json | null
          updated_at?: string | null
        }
        Update: {
          ano_mes?: string
          created_at?: string | null
          dias_uteis_base?: number
          dias_uteis_final?: number
          feriados_nacionais?: Json | null
          id?: string
          ifood_mensal_calculado?: number | null
          ifood_valor_dia?: number
          observacoes?: string | null
          paradas_empresa?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      deal_current_stages: {
        Row: {
          current_stage: string | null
          current_stage_lower: string | null
          deal_id: string | null
          last_stage_change: string | null
        }
        Relationships: []
      }
      deal_task_stats_monthly: {
        Row: {
          completed_by: string | null
          completion_rate: number | null
          month: string | null
          overdue_completed: number | null
          tasks_canceled: number | null
          tasks_completed: number | null
          tasks_pending: number | null
          tasks_total: number | null
          template_id: string | null
          type: Database["public"]["Enums"]["activity_task_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "activity_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_performance_summary: {
        Row: {
          commission_rate: number | null
          department: string | null
          email: string | null
          fixed_salary: number | null
          full_name: string | null
          hire_date: string | null
          is_active: boolean | null
          ote: number | null
          position: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          status: Database["public"]["Enums"]["user_status"] | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_partner_to_gr: {
        Args: {
          p_bu?: string
          p_contact_id?: string
          p_customer_email: string
          p_customer_name: string
          p_customer_phone: string
          p_deal_id?: string
          p_product: string
          p_transaction_id: string
          p_value: number
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      detect_ghost_appointments: { Args: { days_back?: number }; Returns: Json }
      generate_patrimonio_number: {
        Args: { p_tipo: Database["public"]["Enums"]["asset_type"] }
        Returns: string
      }
      get_all_hubla_transactions: {
        Args: {
          p_end_date?: string
          p_limit?: number
          p_products?: string[]
          p_search?: string
          p_start_date?: string
        }
        Returns: {
          customer_email: string
          customer_name: string
          customer_phone: string
          gross_override: number
          hubla_id: string
          id: string
          installment_number: number
          linked_attendee_id: string
          net_value: number
          product_category: string
          product_name: string
          product_price: number
          reference_price: number
          sale_date: string
          sale_origin: string
          sale_status: string
          source: string
          total_installments: number
        }[]
      }
      get_contact_with_meetings: {
        Args: { p_email?: string; p_phone_suffix?: string }
        Returns: {
          contact_id: string
          contact_name: string
          deals_count: number
          meetings_count: number
        }[]
      }
      get_distinct_products: {
        Args: never
        Returns: {
          product_name: string
          transaction_count: number
        }[]
      }
      get_duplicate_contact_emails: {
        Args: { limit_count?: number }
        Returns: {
          contact_count: number
          email: string
        }[]
      }
      get_duplicate_contact_phones: {
        Args: { limit_count?: number }
        Returns: {
          contact_count: number
          phone_suffix: string
        }[]
      }
      get_first_transaction_dates: {
        Args: never
        Returns: {
          customer_email: string
          first_sale_date: string
          first_transaction_id: string
          product_key: string
        }[]
      }
      get_first_transaction_ids: {
        Args: never
        Returns: {
          id: string
        }[]
      }
      get_hubla_transactions_by_bu: {
        Args: {
          p_bu: string
          p_end_date?: string
          p_limit?: number
          p_search?: string
          p_start_date?: string
        }
        Returns: {
          customer_email: string
          customer_name: string
          customer_phone: string
          gross_override: number
          hubla_id: string
          id: string
          installment_number: number
          linked_attendee_id: string
          net_value: number
          product_category: string
          product_name: string
          product_price: number
          reference_price: number
          sale_date: string
          sale_origin: string
          sale_status: string
          source: string
          total_installments: number
        }[]
      }
      get_incorporador_transactions:
        | {
            Args: { p_limit?: number; p_search?: string }
            Returns: {
              count_in_dashboard: boolean
              customer_email: string
              customer_name: string
              customer_phone: string
              hubla_id: string
              id: string
              installment_number: number
              is_offer: boolean
              net_value: number
              product_category: string
              product_name: string
              product_price: number
              raw_data: Json
              sale_date: string
              sale_status: string
              source: string
              total_installments: number
            }[]
          }
        | {
            Args: {
              p_end_date?: string
              p_limit?: number
              p_search?: string
              p_start_date?: string
            }
            Returns: {
              count_in_dashboard: boolean
              customer_email: string
              customer_name: string
              customer_phone: string
              hubla_id: string
              id: string
              installment_number: number
              is_offer: boolean
              net_value: number
              product_category: string
              product_name: string
              product_price: number
              raw_data: Json
              sale_date: string
              sale_status: string
              source: string
              total_installments: number
            }[]
          }
        | {
            Args: {
              p_end_date?: string
              p_limit?: number
              p_products?: string[]
              p_search?: string
              p_start_date?: string
            }
            Returns: {
              count_in_dashboard: boolean
              customer_email: string
              customer_name: string
              customer_phone: string
              hubla_id: string
              id: string
              installment_number: number
              is_offer: boolean
              net_value: number
              product_category: string
              product_name: string
              product_price: number
              raw_data: Json
              sale_date: string
              sale_status: string
              source: string
              total_installments: number
            }[]
          }
        | {
            Args: {
              p_end_date?: string
              p_limit?: number
              p_products?: string[]
              p_search?: string
              p_start_date?: string
            }
            Returns: {
              count_in_dashboard: boolean
              customer_email: string
              customer_name: string
              customer_phone: string
              hubla_id: string
              id: string
              installment_number: number
              is_offer: boolean
              net_value: number
              product_category: string
              product_name: string
              product_price: number
              raw_data: Json
              sale_date: string
              sale_status: string
              source: string
              total_installments: number
            }[]
          }
      get_next_gr_for_assignment: { Args: { p_bu?: string }; Returns: string }
      get_next_lead_owner: { Args: { p_origin_id: string }; Returns: string }
      get_novo_lead_count:
        | { Args: { target_date: string }; Returns: Json }
        | {
            Args: { target_date: string; valid_emails?: string[] }
            Returns: Json
          }
      get_sdr_all_movements_v2: {
        Args: {
          end_date: string
          sdr_email_filter?: string
          start_date: string
        }
        Returns: {
          closer: string
          conta: boolean
          contact_email: string
          contact_name: string
          contact_phone: string
          current_owner: string
          data_agendamento: string
          deal_id: string
          deal_name: string
          from_stage: string
          intermediador: string
          origin_name: string
          probability: number
          status_atual: string
          tipo: string
          total_movimentacoes: number
        }[]
      }
      get_sdr_meetings_from_agenda: {
        Args: {
          end_date: string
          sdr_email_filter?: string
          start_date: string
        }
        Returns: {
          attendee_id: string
          attendee_status: string
          closer: string
          contact_email: string
          contact_name: string
          contact_phone: string
          data_agendamento: string
          deal_id: string
          deal_name: string
          intermediador: string
          meeting_slot_id: string
          origin_name: string
          probability: number
          scheduled_at: string
          sdr_email: string
          status_atual: string
          tipo: string
        }[]
      }
      get_sdr_meetings_v2: {
        Args: {
          end_date: string
          sdr_email_filter?: string
          start_date: string
        }
        Returns: Json
      }
      get_sdr_metrics_from_agenda: {
        Args: {
          end_date: string
          sdr_email_filter?: string
          start_date: string
        }
        Returns: Json
      }
      get_sdr_metrics_v2: {
        Args: {
          end_date: string
          sdr_email_filter?: string
          start_date: string
        }
        Returns: Json
      }
      get_sdr_metrics_v3: {
        Args: {
          end_date: string
          sdr_email_filter?: string
          start_date: string
        }
        Returns: {
          ganho: number
          lq: number
          no_show: number
          novo_lead: number
          perdido: number
          r1_agendada: number
          r1_realizada: number
          sdr_email: string
          total_agendamentos: number
        }[]
      }
      get_tv_funnel_metrics: { Args: { target_date: string }; Returns: Json }
      get_tv_sdr_metrics: { Args: { target_date: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_bu_manager: { Args: { _user_id: string }; Returns: boolean }
      is_own_sdr: { Args: { _sdr_id: string }; Returns: boolean }
      link_contacts_to_origins_via_deals: { Args: never; Returns: number }
      reconcile_hubla_clint_ids: { Args: never; Returns: Json }
      refresh_deal_current_stages: { Args: never; Returns: undefined }
      reset_distribution_counters: {
        Args: { p_origin_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      sync_crm_deals_to_gr_wallets: { Args: never; Returns: number }
      upsert_deals_smart: { Args: { deals_data: Json }; Returns: undefined }
      user_has_permission: {
        Args: {
          _required_level: Database["public"]["Enums"]["permission_level"]
          _resource: Database["public"]["Enums"]["resource_type"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_task_status: "pending" | "done" | "canceled"
      activity_task_type: "call" | "whatsapp" | "email" | "meeting" | "other"
      alert_level: "info" | "warning" | "critical"
      app_role:
        | "admin"
        | "manager"
        | "viewer"
        | "sdr"
        | "closer"
        | "coordenador"
        | "rh"
        | "financeiro"
        | "closer_sombra"
        | "gr"
      asset_event_type:
        | "comprado"
        | "liberado"
        | "transferido"
        | "manutencao"
        | "devolucao"
        | "baixa"
      asset_status:
        | "em_estoque"
        | "em_uso"
        | "em_manutencao"
        | "devolvido"
        | "baixado"
      asset_type:
        | "notebook"
        | "desktop"
        | "monitor"
        | "celular"
        | "tablet"
        | "impressora"
        | "outro"
      assignment_status: "ativo" | "devolvido" | "transferido"
      auction_status: "ativo" | "encerrado" | "cancelado"
      automation_channel: "whatsapp" | "email" | "sms"
      automation_status:
        | "pending"
        | "processing"
        | "sent"
        | "delivered"
        | "read"
        | "replied"
        | "failed"
        | "cancelled"
      automation_trigger: "enter" | "exit"
      flag_category:
        | "desempenho"
        | "comportamento"
        | "frequencia"
        | "financeiro"
        | "compliance"
        | "outros"
      flag_type: "red" | "yellow" | "green"
      gr_action_type:
        | "reuniao_agendada"
        | "reuniao_realizada"
        | "diagnostico"
        | "produto_sugerido"
        | "produto_contratado"
        | "nota"
        | "encaminhamento_bu"
        | "status_change"
        | "contato_telefonico"
        | "contato_whatsapp"
      gr_distribution_mode: "automatico" | "manual"
      gr_entry_status:
        | "ativo"
        | "em_negociacao"
        | "em_pausa"
        | "convertido"
        | "inativo"
        | "transferido"
      permission_level: "none" | "view" | "edit" | "full"
      playbook_categoria:
        | "onboarding"
        | "processo"
        | "politica"
        | "script"
        | "treinamento"
        | "outro"
      playbook_read_status: "nao_lido" | "lido" | "confirmado"
      playbook_role:
        | "sdr"
        | "closer"
        | "coordenador"
        | "gestor_sdr"
        | "gestor_closer"
        | "master"
        | "admin"
        | "manager"
        | "viewer"
      playbook_tipo_conteudo: "arquivo" | "link" | "texto"
      project_status: "a_fazer" | "em_andamento" | "concluido" | "cancelado"
      resource_type:
        | "dashboard"
        | "receita"
        | "custos"
        | "projetos"
        | "credito"
        | "leilao"
        | "alertas"
        | "relatorios"
        | "configuracoes"
        | "efeito_alavanca"
        | "crm"
        | "fechamento_sdr"
        | "tv_sdr"
        | "usuarios"
        | "financeiro"
        | "patrimonio"
        | "agenda_r2"
      target_period: "mensal" | "trimestral" | "anual"
      target_type: "receita" | "vendas" | "leads" | "conversao" | "custom"
      transaction_status: "pago" | "pendente" | "cancelado"
      transaction_type: "receita" | "custo"
      user_file_type:
        | "contrato_trabalho"
        | "politica_comissao"
        | "metas"
        | "outro"
        | "termo_responsabilidade"
      user_status: "ativo" | "ferias" | "inativo" | "pendente_aprovacao"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_task_status: ["pending", "done", "canceled"],
      activity_task_type: ["call", "whatsapp", "email", "meeting", "other"],
      alert_level: ["info", "warning", "critical"],
      app_role: [
        "admin",
        "manager",
        "viewer",
        "sdr",
        "closer",
        "coordenador",
        "rh",
        "financeiro",
        "closer_sombra",
        "gr",
      ],
      asset_event_type: [
        "comprado",
        "liberado",
        "transferido",
        "manutencao",
        "devolucao",
        "baixa",
      ],
      asset_status: [
        "em_estoque",
        "em_uso",
        "em_manutencao",
        "devolvido",
        "baixado",
      ],
      asset_type: [
        "notebook",
        "desktop",
        "monitor",
        "celular",
        "tablet",
        "impressora",
        "outro",
      ],
      assignment_status: ["ativo", "devolvido", "transferido"],
      auction_status: ["ativo", "encerrado", "cancelado"],
      automation_channel: ["whatsapp", "email", "sms"],
      automation_status: [
        "pending",
        "processing",
        "sent",
        "delivered",
        "read",
        "replied",
        "failed",
        "cancelled",
      ],
      automation_trigger: ["enter", "exit"],
      flag_category: [
        "desempenho",
        "comportamento",
        "frequencia",
        "financeiro",
        "compliance",
        "outros",
      ],
      flag_type: ["red", "yellow", "green"],
      gr_action_type: [
        "reuniao_agendada",
        "reuniao_realizada",
        "diagnostico",
        "produto_sugerido",
        "produto_contratado",
        "nota",
        "encaminhamento_bu",
        "status_change",
        "contato_telefonico",
        "contato_whatsapp",
      ],
      gr_distribution_mode: ["automatico", "manual"],
      gr_entry_status: [
        "ativo",
        "em_negociacao",
        "em_pausa",
        "convertido",
        "inativo",
        "transferido",
      ],
      permission_level: ["none", "view", "edit", "full"],
      playbook_categoria: [
        "onboarding",
        "processo",
        "politica",
        "script",
        "treinamento",
        "outro",
      ],
      playbook_read_status: ["nao_lido", "lido", "confirmado"],
      playbook_role: [
        "sdr",
        "closer",
        "coordenador",
        "gestor_sdr",
        "gestor_closer",
        "master",
        "admin",
        "manager",
        "viewer",
      ],
      playbook_tipo_conteudo: ["arquivo", "link", "texto"],
      project_status: ["a_fazer", "em_andamento", "concluido", "cancelado"],
      resource_type: [
        "dashboard",
        "receita",
        "custos",
        "projetos",
        "credito",
        "leilao",
        "alertas",
        "relatorios",
        "configuracoes",
        "efeito_alavanca",
        "crm",
        "fechamento_sdr",
        "tv_sdr",
        "usuarios",
        "financeiro",
        "patrimonio",
        "agenda_r2",
      ],
      target_period: ["mensal", "trimestral", "anual"],
      target_type: ["receita", "vendas", "leads", "conversao", "custom"],
      transaction_status: ["pago", "pendente", "cancelado"],
      transaction_type: ["receita", "custo"],
      user_file_type: [
        "contrato_trabalho",
        "politica_comissao",
        "metas",
        "outro",
        "termo_responsabilidade",
      ],
      user_status: ["ativo", "ferias", "inativo", "pendente_aprovacao"],
    },
  },
} as const
