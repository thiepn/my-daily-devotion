import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/** Historical gates share the approved additive migration contract, rather
 * than accepting an arbitrary version bump or silently dropping v1 checks. */
export async function assertReviewedDatabaseContract() {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  const [schema, migrations, portable] = await Promise.all([read("src/data/schema.ts"), read("src/data/migrations.ts"), read("src/data/portable-tables.ts")]);
  assert.match(schema, /DATABASE_SCHEMA_VERSION = 3;/);
  assert.match(schema, /DOMAIN_CONTRACT_VERSION = 1;/);
  const original = schema.replaceAll("\r\n", "\n").match(/export const schemaV1 = \{[\s\S]*?\} as const;/)?.[0];
  assert.ok(original, "Original schema registration must remain present");
  assert.equal(createHash("sha256").update(original).digest("hex"), "0841fdccc164eaf2a16892e2950a02ffafe92ab3a7c66c3d4e47834978319e9d", "v1 domain indexes changed");
  assert.match(migrations, /REGISTERED_SCHEMA_VERSIONS = \[1, 2, 3\]/);
  assert.match(migrations, /version\(1\)\.stores\(schemaV1\)/);
  assert.match(migrations, /version\(2\)\.stores\(recoverySchemaV2\)\.upgrade/);
  assert.match(migrations, /version\(3\)\.stores\(recoverySchemaV3\)\.upgrade/);
  assert.match(migrations, /draftJournalState.*add\(newJournalState\(\)\)/);
  for (const definition of ['editorDrafts: "&id,kind,targetKey,updatedAt,journalEpoch,[targetKey+updatedAt]"', 'editorDraftContents: "&id"', 'draftJournalState: "&key"']) assert.ok(schema.includes(definition));
  const approvedV3 = `export const recoverySchemaV3 = {
  savedVersions: "&id,targetKey,capturedAt,[targetKey+capturedAt],journalEpoch",
  savedVersionContents: "&id",
  removalGroups: "&id,removedAt,expiresAt,journalEpoch,state",
  removalGroupContents: "&id",
} as const;`;
  assert.equal(schema.replaceAll("\r\n", "\n").match(/export const recoverySchemaV3 = \{[\s\S]*?\} as const;/)?.[0], approvedV3, "Schema 3 must contain only the four owner-approved recovery stores");
  assert.match(portable, /PORTABLE_SCHEMA_VERSION = 1;/);
  assert.match(portable, /PORTABLE_CONTRACT_VERSION = 1;/);
}
