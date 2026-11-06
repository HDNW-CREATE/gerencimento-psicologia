'use server';

import { z } from 'zod';
import { fmtDateTime } from '@/lib/format';
import { ok, run, type ActionResult } from '../action-result';
import { getRecordVersions } from '../clinical';

export interface VersionDTO {
  version: number;
  title: string;
  html: string;
  reason: string | null;
  createdLabel: string;
}

/** Histórico de versões de um registro (somente ADMIN – a checagem está em `getRecordVersions`). */
export async function getRecordVersionsAction(input: unknown): Promise<ActionResult<VersionDTO[]>> {
  return run(async () => {
    const { recordId } = z.object({ recordId: z.string() }).parse(input);
    const versions = await getRecordVersions(recordId);
    return ok(
      undefined,
      versions.map((v) => ({
        version: v.version,
        title: v.title,
        html: v.html,
        reason: v.reason,
        createdLabel: fmtDateTime(v.createdAt),
      })),
    );
  });
}
