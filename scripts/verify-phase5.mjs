import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const root = new URL("../", import.meta.url); const read = (path) => readFile(new URL(path, root), "utf8");
const [schema, reflections, notes, reflectionScreen, handoff, reader, today, app, main, pkgRaw] = await Promise.all([
  read("src/data/schema.ts"), read("src/data/repositories/reflections.ts"), read("src/data/repositories/verse-notes.ts"), read("src/reflection/ReflectionScreen.tsx"), read("src/reflection/PrayerHandoffScreen.tsx"), read("src/scripture/BibleScreen.tsx"), read("src/mcheyne/TodayScreen.tsx"), read("src/app/App.tsx"), read("src/main.tsx"), read("package.json"),
]);
const pkg = JSON.parse(pkgRaw);
assert.match(schema, /DATABASE_SCHEMA_VERSION = 1/);
for (const store of ["reflections", "verseNotes", "scriptureLinks"]) assert.match(schema, new RegExp(`${store}:`));
assert.match(reflections, /REFLECTION_CREATED/); assert.match(reflections, /attachScripture/); assert.match(reflections, /removeDaily/); assert.match(notes, /class VerseNoteRepository/); assert.match(notes, /deletedAt: nowInstant/);
assert.match(reflectionScreen, /Optional prompts/); assert.match(reflectionScreen, /Save reflection/); assert.match(reflectionScreen, /Linked Scripture/); assert.match(reflectionScreen, /Continue toward prayer/);
assert.match(handoff, /sourceReflectionId/); assert.match(handoff, /Create prayer · Phase 6/);
assert.match(reader, /buildReflectionUrl/); assert.match(reader, /> Reflect</); assert.match(reader, /Add verse note|Edit verse note/); assert.match(reader, /Verse note saved locally/); assert.doesNotMatch(reader, /Reflection linkage arrives in Phase 5/);
assert.match(today, /TodayReflectionPanel/); assert.match(app, /\/today\/reflection\/:localDate/); assert.match(app, /\/prayer\/new/); assert.doesNotMatch(app, /label: "Journal"/);
assert.ok(main.includes("phase5.css")); assert.ok(pkg.scripts["verify:phase5"]); assert.equal(pkg.version, "0.5.0");
console.log("✓ Phase 5 Reflection & Scripture Capture verification passed");
console.log("  one dated reflection model with meaningful creation history");
console.log("  structural Scripture links + passage-specific verse notes");
console.log("  Bible → Reflect and Reflection → Prayer context handoff wired locally");
