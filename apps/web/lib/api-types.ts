import type { Project, Receipt, ReceiptItem } from '@architech/shared';

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
  } | null;
}

export interface ReceiptWithDetails extends Receipt {
  project: {
    id: string;
    name: string;
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
  };
  uploader: {
    id: string;
    full_name: string;
  };
  receipt_items: ReceiptItem[];
}
