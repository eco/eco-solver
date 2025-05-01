export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      accumulation_periods: {
        Row: {
          created_at: string | null
          distribution_amount: number | null
          duration: unknown
          id: number
          started_at: string
          starting_solver_balance: number
        }
        Insert: {
          created_at?: string | null
          distribution_amount?: number | null
          duration: unknown
          id?: number
          started_at: string
          starting_solver_balance: number
        }
        Update: {
          created_at?: string | null
          distribution_amount?: number | null
          duration?: unknown
          id?: number
          started_at?: string
          starting_solver_balance?: number
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string | null
          id: number
          password_hash: string
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          password_hash: string
          username: string
        }
        Update: {
          created_at?: string | null
          id?: number
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      chips: {
        Row: {
          created_at: string | null
          id: number
          last_tap_at: string | null
          uid: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          last_tap_at?: string | null
          uid: string
        }
        Update: {
          created_at?: string | null
          id?: number
          last_tap_at?: string | null
          uid?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          chip_id: number
          claimed_at: string | null
          id: number
          reward_period_id: number
          wallet_address: string | null
        }
        Insert: {
          chip_id: number
          claimed_at?: string | null
          id?: number
          reward_period_id: number
          wallet_address?: string | null
        }
        Update: {
          chip_id?: number
          claimed_at?: string | null
          id?: number
          reward_period_id?: number
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_chip_id_fkey"
            columns: ["chip_id"]
            isOneToOne: false
            referencedRelation: "chips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_reward_period_id_fkey"
            columns: ["reward_period_id"]
            isOneToOne: false
            referencedRelation: "reward_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      distributions: {
        Row: {
          accumulation_period_id: number
          distributed_at: string | null
          id: number
        }
        Insert: {
          accumulation_period_id: number
          distributed_at?: string | null
          id?: number
        }
        Update: {
          accumulation_period_id?: number
          distributed_at?: string | null
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "distributions_accumulation_period_id_fkey"
            columns: ["accumulation_period_id"]
            isOneToOne: false
            referencedRelation: "accumulation_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_periods: {
        Row: {
          accumulation_period_id: number | null
          created_at: string | null
          created_by: string | null
          ended_at: string | null
          id: number
          started_at: string
        }
        Insert: {
          accumulation_period_id?: number | null
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: number
          started_at: string
        }
        Update: {
          accumulation_period_id?: number | null
          created_at?: string | null
          created_by?: string | null
          ended_at?: string | null
          id?: number
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_periods_accumulation_period_id_fkey"
            columns: ["accumulation_period_id"]
            isOneToOne: false
            referencedRelation: "accumulation_periods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
  | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
  | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
  ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
