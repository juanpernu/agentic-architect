import type { Project, Receipt, ReceiptItem, ProjectColor, CostCenter, BankAccount } from '@architech/shared';

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
  cost_center: { id: string; name: string; color: ProjectColor | null } | null;
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
  cost_center: { id: string; name: string; color: ProjectColor | null } | null;
  bank_account: { id: string; name: string; bank_name: string } | null;
}
