import type { BackupExportResult } from "./portability";

export interface BackupReceipt { version: 1; generatedAt: string; kind: "encrypted" | "plain"; }
export type ReceiptState = { status: "available"; receipt: BackupReceipt | null } | { status: "unavailable"; receipt: null };
export const BACKUP_RECEIPT_KEY = "mdd-backup-receipt-v1";

/** This device-only receipt deliberately stays out of Dexie and portable backups. */
export function readBackupReceipt(storage?: Pick<Storage, "getItem">): ReceiptState {
  try {
    const raw = (storage ?? localStorage).getItem(BACKUP_RECEIPT_KEY);
    if (!raw) return { status: "available", receipt: null };
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("version" in value) || value.version !== 1 ||
        !("generatedAt" in value) || typeof value.generatedAt !== "string" || !Number.isFinite(Date.parse(value.generatedAt)) ||
        !("kind" in value) || (value.kind !== "plain" && value.kind !== "encrypted")) return { status: "unavailable", receipt: null };
    return { status: "available", receipt: { version: 1, generatedAt: value.generatedAt, kind: value.kind } };
  } catch { return { status: "unavailable", receipt: null }; }
}
export function recordBackupReceipt(result: Pick<BackupExportResult, "generatedAt" | "kind">, storage?: Pick<Storage, "setItem">): ReceiptState {
  const receipt: BackupReceipt = { version: 1, generatedAt: result.generatedAt, kind: result.kind };
  try { (storage ?? localStorage).setItem(BACKUP_RECEIPT_KEY, JSON.stringify(receipt)); return { status: "available", receipt }; }
  catch { return { status: "unavailable", receipt: null }; }
}
