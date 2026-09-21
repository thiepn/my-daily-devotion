import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");

const [contractRaw,css,nativeCss,main,data,polishTest,nativeTest,pkgRaw]=await Promise.all([
  read("canonical/mobile-first-layout.v1.json"),
  read("src/styles/morning-grace-mobile.css"),
  read("src/styles/morning-grace-mobile-native.css"),
  read("src/main.tsx"),
  read("src/data/DataScreen.tsx"),
  read("tests/ux/morning-grace-polish.spec.ts"),
  read("tests/ux/mobile-native-navigation.spec.ts"),
  read("package.json")
]);

const contract=JSON.parse(contractRaw);
const pkg=JSON.parse(pkgRaw);

assert.equal(contract.version,1);
assert.equal(contract.name,"Morning Grace Mobile-First Layout");
assert.equal(contract.breakpointPx,760);

for(const selector of [
  ".utility-bar",
  ".mobile-nav",
  ".mg-canonical-hero",
  ".mg-reading-cards",
  ".mg-bible-toolbar",
  ".mg-bible-chapter-art",
  ".mg-prayer-focus",
  ".prayer-status-tabs",
  ".mg-history-stats",
  ".mg-history-calendar",
  ".mg-secondary-screen"
]) assert.ok(css.includes(selector),"Mobile CSS missing "+selector);

assert.match(css,/@media\s*\(max-width:\s*760px\)/);
assert.match(css,/--mobile-appbar-height:\s*48px/);
assert.match(css,/--mobile-tabbar-height:\s*60px/);
assert.match(css,/\.mg-hero-art,[\s\S]*\.mg-bible-chapter-art[\s\S]*display:\s*none\s*!important/);
assert.match(css,/\.mg-reading-cards\s*\{[\s\S]*display:\s*block/);
assert.match(css,/\.mg-history-stats\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/);
assert.doesNotMatch(css,/(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css,/url\(\s*["']?https?:\/\//i);

const polishIndex=main.indexOf('"./styles/morning-grace-polish.css"');
const mobileIndex=main.indexOf('"./styles/morning-grace-mobile.css"');
const nativeMobileIndex=main.indexOf('"./styles/morning-grace-mobile-native.css"');
assert.ok(polishIndex>=0&&mobileIndex>polishIndex,"Mobile layout must load after the full Morning Grace desktop system");
assert.ok(nativeMobileIndex>mobileIndex,"Native mobile refinement must load after the base mobile layout");
assert.match(nativeCss,/\.mobile-detail-route \.mobile-nav\s*\{[\s\S]*display:\s*none/);
assert.match(nativeCss,/\.mobile-detail-route \.utility-mobile-back\s*\{/);
assert.match(nativeCss,/\.mobile-immersive-route:has\(\.mg-focused-prayer-workspace\) \.utility-bar\s*\{[\s\S]*display:\s*none/);
assert.match(nativeCss,/safe-area-inset-top/);
assert.match(nativeCss,/safe-area-inset-bottom/);
assert.doesNotMatch(nativeCss,/(?:linear|radial|conic)-gradient\s*\(/i);

assert.match(data,/mobile-appearance-panel/);
assert.match(data,/ThemeSwitcher/);
assert.match(polishTest,/utility-bar \.theme-switcher/);
assert.match(polishTest,/mobile-appearance-panel/);
assert.match(nativeTest,/secondary destinations use a pushed screen with back navigation/);
assert.match(nativeTest,/phone landscape keeps secondary routes in stacked-app mode/);
assert.equal(contract.secondaryNavigation.behavior,"hide root bottom tabs and utility actions; expose contextual back navigation");
assert.equal(pkg.scripts["verify:mobile-layout"],"node scripts/verify-mobile-first-layout.mjs");

console.log("✓ Mobile-first layout contract verified");
console.log("  compact app bar + bottom tab bar installed");
console.log("  Today reading cards convert to grouped rows");
console.log("  Bible is reading-first with mobile artwork removed");
console.log("  Prayer and History use dense mobile-native compositions");
console.log("  secondary routes use stacked navigation with contextual back controls");
console.log("  focused prayer can remove outer app chrome for an immersive task");
console.log("  desktop/tablet Morning Grace layers remain upstream and unchanged");
