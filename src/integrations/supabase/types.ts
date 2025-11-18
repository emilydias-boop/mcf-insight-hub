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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
    }
    Enums: {
      alert_level: "info" | "warning" | "critical"
      app_role: "admin" | "manager" | "viewer"
      auction_status: "ativo" | "encerrado" | "cancelado"
      project_status: "a_fazer" | "em_andamento" | "concluido" | "cancelado"
      transaction_status: "pago" | "pendente" | "cancelado"
      transaction_type: "receita" | "custo"
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
      alert_level: ["info", "warning", "critical"],
      app_role: ["admin", "manager", "viewer"],
      auction_status: ["ativo", "encerrado", "cancelado"],
      project_status: ["a_fazer", "em_andamento", "concluido", "cancelado"],
      transaction_status: ["pago", "pendente", "cancelado"],
      transaction_type: ["receita", "custo"],
    },
  },
} as const
