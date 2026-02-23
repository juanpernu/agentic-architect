import type { Project, Receipt, ReceiptItem, ProjectColor, BankAccount, Budget, BudgetVersion, BudgetSnapshot } from '@architech/shared';

export interface ProjectWithDetails extends Project {
  architect: {
    id: string;
    full_name: string;
  } | null;
  total_spend: number;
}

export interface ProjectDetail extends Project {
  architect: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
}

export interface ReceiptWithDetails extends Receipt {
  project: {
    id: string;
    name: string;
    color: ProjectColor | null;
  } | null;
  uploader: {
    id: string;
    full_name: string;
  };
  rubro: { id: string; name: string; color: string | null } | null;
  bank_account: { id: string; name: string; bank_name: string } | null;
}

export interface ReceiptDetail extends Receipt {
  project: {
    id: string;
    name: string;
    color: ProjectColor | null;
  };
  uploader: {
    id: string;
    full_name: string;
  };
  receipt_items: ReceiptItem[];
  rubro: { id: string; name: string; color: string | null } | null;
  bank_account: { id: string; name: string; bank_name: string } | null;
}

export interface BudgetListItem extends Budget {
  project_name: string;
  project_color: string | null;
  total_amount: number;
  updated_by_name: string | null;
}

export interface BudgetDetail extends Budget {
  project: {
    id: string;
    name: string;
  };
  latest_version: BudgetVersion | null;
}

export interface BudgetVersionSummary {
  id: string;
  version_number: number;
  total_amount: number;
  created_by_name: string;
  created_at: string;
}
