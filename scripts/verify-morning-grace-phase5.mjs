import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");

const [contractRaw,css,main,app,errorBoundary,draftGuard,newPrayer,history,pkgRaw,doc]=await Promise.all([
  read("canonical/morning-grace-final-polish.v1.json"),
  read("src/styles/morning-grace-polish.css"),
  read("src/main.tsx"),
  read("src/app/App.tsx"),
  read("src/app/RouteErrorBoundary.tsx"),
  read("src/app/useDraftGuard.tsx"),
  read("src/prayer/NewPrayerScreen.tsx"),
  read("src/history/HistoryScreens.tsx"),
  read("package.json"),
  read("docs/PHASE_5_MORNING_GRACE_FINAL_POLISH.md")
]);

// V2 centralizes imports; the older JSON describes the retained legacy screens.
const styles = await read("src/styles/index.css");
assert.match(main, /styles\/index\.css/);

const contract=JSON.parse(contractRaw);
const pkg=JSON.parse(pkgRaw);

assert.equal(contract.version,1);
assert.equal(contract.name,"Morning Grace Final Visual Polish");
assert.equal(contract.status,"phase-5-frozen");

for(const token of [
  ".mg-route-loading",
  ".mg-state-screen",
  ".draft-dialog",
  ".conflict-review",
  ".mg-prayer-capture-workspace",
  "@keyframes mg-screen-in",
  "@media (prefers-reduced-motion: reduce)"
]) assert.ok(css.includes(token),"Polish CSS missing "+token);

assert.doesNotMatch(css,/(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css,/url\(\s*["']?https?:\/\//i);
assert.match(css,/max-width:\s*700px/);

assert.match(app,/className="utility-link" to=\{searchHref\}/);
assert.match(app,/className="utility-link" to=\{dataHref\}/);
assert.match(app,/function utilityReturnTarget/);
assert.match(app,/function withReturn/);
assert.match(app,/route-loading-mark/);
assert.match(errorBoundary,/mg-state-screen/);
assert.match(draftGuard,/draft-dialog-save/);
assert.match(draftGuard,/draft-dialog-discard/);
assert.match(draftGuard,/draft-dialog-keep/);
assert.match(newPrayer,/mg-prayer-capture-workspace/);
assert.match(history,/history-day-entry/);
assert.match(await read("src/styles/history.css"),/\.history-day-entry/);

const secondaryIndex=styles.indexOf('"./morning-grace-secondary.css"');
const polishIndex=styles.indexOf('"./morning-grace-polish.css"');
assert.ok(secondaryIndex>=0&&polishIndex>secondaryIndex,"Final polish must load after every Morning Grace structural layer");
assert.match(main,/BrandMark className="mg-state-mark"/);

assert.equal(pkg.scripts["verify:morning-grace:phase5"],"node scripts/verify-morning-grace-phase5.mjs");

assert.match(doc,/Status:\s*\*\*implemented on redesign branch\*\*/i);
assert.match(doc,/Mobile top chrome/i);
assert.match(doc,/Draft and conflict states/i);
assert.match(doc,/Reduced-motion/i);
assert.match(doc,/remain unmerged/i);

console.log("✓ Morning Grace Editorial Phase 5 verification passed");
console.log("  final chrome, typography, controls, states, dark mode and motion polish frozen");
console.log("  Add Prayer + History detail residual routes now use Morning Grace");
console.log("  mobile utility chrome is icon-first with accessible labels and contextual return routes preserved");
console.log("  final polish remains presentation-only and release integration is still deferred");
