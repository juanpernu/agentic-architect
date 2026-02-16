import type { UserRole, ProjectStatus, ReceiptStatus } from './enums';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  clerk_user_id: string;
  organization_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  status: ProjectStatus;
  architect_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  project_id: string;
  uploaded_by: string;
  supplier_id: string | null;
  vendor: string | null;
  total_amount: number;
  receipt_date: string;
  receipt_type: string | null;
  receipt_code: string | null;
  receipt_number: string | null;
  receipt_time: string | null;
  net_amount: number | null;
  iva_rate: number | null;
  iva_amount: number | null;
  image_url: string;
  ai_raw_response: Record<string, unknown>;
  ai_confidence: number;
  status: ReceiptStatus;
  created_at: string;
  updated_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  responsible_person: string | null;
  cuit: string | null;
  iibb: string | null;
  street: string | null;
  locality: string | null;
  province: string | null;
  postal_code: string | null;
  activity_start_date: string | null;
  fiscal_condition: string | null;
  created_at: string;
  updated_at: string;
}

// AI Extraction types
export interface ExtractionResult {
  supplier: {
    name: string | null;
    responsible_person: string | null;
    cuit: string | null;
    iibb: string | null;
    address: {
      street: string | null;
      locality: string | null;
      province: string | null;
      postal_code: string | null;
    };
    activity_start_date: string | null;
    fiscal_condition: string | null;
  };
  receipt: {
    code: string | null;
    type: string | null;
    number: string | null;
    date: string | null;
    time: string | null;
  };
  items: ExtractionItem[];
  totals: {
    net_amount: number | null;
    iva_rate: number | null;
    iva_amount: number | null;
    total: number | null;
  };
  confidence: number;
}

export interface ExtractionItem {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

// API request/response types
export interface CreateProjectInput {
  name: string;
  address?: string;
  status?: ProjectStatus;
  architect_id?: string;
}

export interface UpdateProjectInput {
  name?: string;
  address?: string;
  status?: ProjectStatus;
  architect_id?: string;
}

export interface ConfirmReceiptInput {
  project_id: string;
  image_url: string;
  ai_raw_response: Record<string, unknown>;
  ai_confidence: number;
  supplier: {
    name: string;
    responsible_person?: string | null;
    cuit?: string | null;
    iibb?: string | null;
    street?: string | null;
    locality?: string | null;
    province?: string | null;
    postal_code?: string | null;
    activity_start_date?: string | null;
    fiscal_condition?: string | null;
  };
  receipt_type?: string | null;
  receipt_code?: string | null;
  receipt_number?: string | null;
  receipt_date: string;
  receipt_time?: string | null;
  total_amount: number;
  net_amount?: number | null;
  iva_rate?: number | null;
  iva_amount?: number | null;
  items: Omit<ExtractionItem, 'subtotal'>[];
}

// Dashboard types
export interface DashboardStats {
  active_projects: number;
  monthly_spend: number;
  weekly_receipts: number;
  pending_review: number;
}

export interface SpendByProject {
  project_id: string;
  project_name: string;
  total_spend: number;
}

export interface SpendTrend {
  month: string;
  total: number;
}
