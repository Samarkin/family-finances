export interface AccountRow {
  AccountId: number;
  FilenameRegex: string | null;
  AccountRegex: string | null;
}

export interface PersonRow {
  PersonId: number;
  MemberRegex: string | null;
}

export interface FileStageRow {
  FileStageId: number;
  Filename: string;
  Sign: number;
  AccountId: number | null;
}

export interface TransactionStageRow {
  TransactionStageId: number;
  Hash: string;
  Date: string;
  Description: string;
  Amount: number;
  RawCategory: string | null;
  CategoryId: string | null;
  PersonId: number | null;
}
