export interface Account {
  id: number;
  name: string;
}

export interface FileInfo {
  id: number;
  filename: string;
  accountName: string | null;
  range: string;
  isStaged?: boolean;
}

export interface CategoryInfo {
  name: string;
  isIncome: boolean;
}

export type CategoryMap = Record<string, CategoryInfo>;
