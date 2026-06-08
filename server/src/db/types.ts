import { CategoryId } from '../constants/categories.js';

export interface AccountRow {
  AccountId: number;
  Name: string;
  FilenameRegex: string | null;
  Sign: number;
  AccountRegex: string | null;
  DefaultPersonId: number | null;
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
  CategoryId: CategoryId | null;
  PersonId: number | null;
  Comment: string | null;
}
