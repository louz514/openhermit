import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { SyncSkillEntry } from '../exec-backend.js';

/** Copy enabled skills into a host-side directory, removing stale entries. */
export const syncSkillsToHostDir = async (
  systemSkillsDir: string,
  skills: SyncSkillEntry[],
): Promise<void> => {
  await mkdir(systemSkillsDir, { recursive: true });

  const desired = new Map(skills.map((s) => [s.id, s.sourcePath]));

  let existing: string[];
  try {
    existing = await readdir(systemSkillsDir);
  } catch {
    existing = [];
  }

  for (const name of existing) {
    if (!desired.has(name)) {
      await rm(path.join(systemSkillsDir, name), { recursive: true, force: true });
    }
  }

  for (const [id, sourcePath] of desired) {
    const destPath = path.join(systemSkillsDir, id);
    await rm(destPath, { recursive: true, force: true });
    await cp(sourcePath, destPath, { recursive: true });
  }
};
