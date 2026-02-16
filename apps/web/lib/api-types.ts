import type { Project, Receipt, ReceiptItem, ProjectColor } from '@architech/shared';

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
  };
  uploader: {
    id: string;
    full_name: string;
  };
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
}
