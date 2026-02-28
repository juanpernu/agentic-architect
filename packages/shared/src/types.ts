import type { UserRole, ProjectStatus, ProjectColor } from './enums';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  address_street: string | null;
  address_locality: string | null;
  address_province: string | null;
  address_postal_code: string | null;
  phone: string | null;
  logo_url: string | null;
  website: string | null;
  contact_email: string | null;
  social_instagram: string | null;
  social_linkedin: string | null;
  plan: 'free' | 'advance' | 'enterprise';
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing' | 'paused';
  payment_customer_id: string | null;
  payment_subscription_id: string | null;
  subscription_seats: number | null;
  max_seats: number;
  billing_cycle: string | null;
  current_period_end: string | null;
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
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  status: ProjectStatus;
  architect_id: string | null;
  color: ProjectColor | null;
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
  rubro_id: string | null;
  bank_account_id: string | null;
  category: 'income' | 'expense' | null;
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

export interface Rubro {
  id: string;
  budget_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export interface BankAccount {
  id: string;
  organization_id: string;
  name: string;
  bank_name: string;
  cbu: string | null;
  alias: string | null;
  currency: string;
  is_active: boolean;
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
  color?: ProjectColor;
}

export interface UpdateProjectInput {
  name?: string;
  address?: string;
  status?: ProjectStatus;
  architect_id?: string;
  color?: ProjectColor;
}

export interface ConfirmReceiptInput {
  category: 'income' | 'expense';
  project_id: string;
  rubro_id?: string;
  bank_account_id?: string;
  paid_by?: string;
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
  new_projects_this_week: number;
  previous_month_spend: number;
}

export interface SpendByProject {
  project_id: string;
  project_name: string;
  total_spend: number;
}

export interface SpendTrend {
  bucket: string;
  total: number;
}

export interface RubroSpend {
  project_id: string;
  project_name: string;
  rubro_id: string;
  rubro_name: string;
  rubro_color: string | null;
  total_amount: number;
  receipt_count: number;
}

// Budget types
export interface BudgetItem {
  description: string;
  unit: string;
  quantity: number;
  cost: number;
  subtotal: number;
}

export interface BudgetSection {
  rubro_id: string;
  rubro_name: string;
  is_additional: boolean;
  subtotal?: number;
  cost?: number;
  items: BudgetItem[];
}

export interface BudgetSnapshot {
  sections: BudgetSection[];
}

export interface Budget {
  id: string;
  project_id: string;
  organization_id: string;
  current_version: number;
  status: 'draft' | 'published';
  snapshot: BudgetSnapshot | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetVersion {
  id: string;
  budget_id: string;
  version_number: number;
  snapshot: BudgetSnapshot;
  total_amount: number;
  created_by: string;
  created_at: string;
}

export interface CreateBudgetInput {
  project_id: string;
  snapshot: BudgetSnapshot;
}

export interface UpdateBudgetInput {
  snapshot: BudgetSnapshot;
}

// Administration types
export interface IncomeType {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface ExpenseType {
  id: string;
  org_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Income {
  id: string;
  org_id: string;
  project_id: string;
  amount: number;
  date: string;
  income_type_id: string | null;
  receipt_id: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  org_id: string;
  project_id: string;
  amount: number;
  date: string;
  expense_type_id: string | null;
  rubro_id: string | null;
  receipt_id: string | null;
  paid_by: string | null;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}
