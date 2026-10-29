"use client";
import { Session, Trial } from "./types";

/** Everything lives in IndexedDB on this device. No account, no server copy. */
const DB = "is-it-working";
const VERSION = 1;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("trials")) db.createObjectStore("trials", { keyPath: "id" });
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("trialId", "trialId");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r ? r.result : (undefined as T));
    t.onerror = () => reject(t.error);
  });
}

export const listTrials = () => tx<Trial[]>("trials", "readonly", (s) => s.getAll());
export const getTrial = (id: string) => tx<Trial | undefined>("trials", "readonly", (s) => s.get(id));
export const putTrial = (t: Trial) => tx("trials", "readwrite", (s) => s.put(t)).then(() => t);
export const putSession = (x: Session) => tx("sessions", "readwrite", (s) => s.put(x)).then(() => x);
export const listSessions = (trialId: string) =>
  tx<Session[]>("sessions", "readonly", (s) => s.index("trialId").getAll(trialId)).then((xs) =>
    xs.sort((a, b) => a.date.localeCompare(b.date)),
  );
export const listAllSessions = () => tx<Session[]>("sessions", "readonly", (s) => s.getAll());

export async function deleteTrial(id: string) {
  const sessions = await listSessions(id);
  for (const s of sessions) await tx("sessions", "readwrite", (st) => st.delete(s.id));
  await tx("trials", "readwrite", (s) => s.delete(id));
}

export interface ExportFile {
  app: "is-it-working";
  version: 1;
  exportedAt: string;
  trials: Trial[];
  sessions: Session[];
}

export async function exportAll(): Promise<ExportFile> {
  return { app: "is-it-working", version: 1, exportedAt: new Date().toISOString(), trials: await listTrials(), sessions: await listAllSessions() };
}

export async function importAll(file: unknown): Promise<number> {
  const f = file as Partial<ExportFile>;
  if (f?.app !== "is-it-working" || !Array.isArray(f.trials) || !Array.isArray(f.sessions)) throw new Error("Not an Is it working? export file");
  for (const t of f.trials) await putTrial(t);
  for (const s of f.sessions) await putSession(s);
  return f.trials.length;
}

export const uid = () => crypto.randomUUID();
