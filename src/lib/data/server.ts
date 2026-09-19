import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { normalizeDataset } from '@/lib/data/normalize';
import type { LocalDataFile, NormalizedDataset } from '@/types/domain';

const DATA_DIR = path.join(process.cwd(), 'data');

function ensureSafeFileName(fileName: string) {
  const base = path.basename(fileName);
  if (base !== fileName) {
    throw new Error('Invalid file name');
  }
  return base;
}

export async function listLocalDataFiles(): Promise<LocalDataFile[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(DATA_DIR);
  } catch {
    return [];
  }

  const files = await Promise.all(
    names
      .filter((name) => name.toLowerCase().endsWith('.json'))
      .map(async (name) => {
        const stats = await fs.stat(path.join(DATA_DIR, name));
        return {
          name,
          sizeBytes: stats.size,
          modifiedAt: stats.mtime.toISOString()
        } satisfies LocalDataFile;
      })
  );

  return files.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
}

export async function readLocalDataFile(fileName: string) {
  const safeName = ensureSafeFileName(fileName);
  const fullPath = path.join(DATA_DIR, safeName);
  const rawText = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(rawText);
}

export async function loadLocalNormalizedDataset(fileName: string): Promise<NormalizedDataset> {
  const json = await readLocalDataFile(fileName);
  return normalizeDataset(json, {
    kind: 'local',
    label: fileName,
    fileName
  });
}
