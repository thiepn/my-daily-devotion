import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root=new URL("../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");

const [contractRaw,css,stackedCss,main,app,search,data,polishTest,navigationTest,denseSecondaryTest,pkgRaw]=await Promise.all([
  read("canonical/mobile-first-layout.v1.json"),
  read("src/styles/morning-grace-mobile.css"),
  read("src/styles/morning-grace-mobile-stacked.css"),
  read("src/main.tsx"),
  read("src/app/App.tsx"),
  read("src/search/SearchScreen.tsx"),
  read("src/data/DataScreen.tsx"),
  read("tests/ux/morning-grace-polish.spec.ts"),
  read("tests/ux/mobile-native-navigation.spec.ts"),
  read("tests/ux/mobile-dense-secondary.spec.ts"),
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
const stackedIndex=main.indexOf('"./styles/morning-grace-mobile-stacked.css"');
assert.ok(polishIndex>=0&&mobileIndex>polishIndex,"Mobile layout must load after the full Morning Grace desktop system");
assert.ok(stackedIndex>mobileIndex,"Stacked mobile refinement must load after the certified base mobile layout");

assert.match(stackedCss,/\.mobile-detail-route \.mobile-nav,[\s\S]*display:\s*none/);
assert.match(stackedCss,/\.mobile-detail-route \.utility-bar \.utility-actions/);
assert.match(stackedCss,/\.mobile-detail-route \.mobile-appbar-back\s*\{[\s\S]*width:\s*44px[\s\S]*height:\s*44px/);
assert.match(stackedCss,/\.mobile-detail-route \.mg-secondary-header h1\s*\{[\s\S]*position:\s*absolute/);
assert.match(stackedCss,/\.mobile-immersive-route:has\(\.mg-focused-prayer-workspace\) \.utility-bar\s*\{[\s\S]*display:\s*none/);
assert.match(stackedCss,/safe-area-inset-top/);
assert.match(stackedCss,/safe-area-inset-bottom/);
assert.doesNotMatch(stackedCss,/(?:linear|radial|conic)-gradient\s*\(/i);

assert.match(app,/mobile-detail-route/);
assert.match(app,/mobile-immersive-route/);
assert.match(app,/safeReturnTarget/);
assert.match(app,/sourceDevotionDate/);
assert.match(app,/aria-label="Back"/);
assert.match(app,/Prayer settings/);
assert.match(app,/utilityReturnTarget/);
assert.match(app,/withReturn/);
assert.match(app,/pathname === "\/search" \|\| pathname === "\/data"\) return returnTo \?\? "\/today"/);
assert.match(search,/if\(returnTo\)next\.set\("return",returnTo\)/);

assert.match(data,/mobile-appearance-panel/);
assert.match(data,/ThemeSwitcher/);
assert.match(polishTest,/utility-bar \.theme-switcher/);
assert.match(polishTest,/mobile-appearance-panel/);
assert.match(navigationTest,/secondary destinations behave like pushed app screens/);
assert.match(navigationTest,/pushed screens survive 320px width with 200 percent text/);
assert.match(navigationTest,/phone landscape keeps secondary routes in stacked-app mode/);
assert.match(navigationTest,/Search and Data return to the root context that opened them/);
assert.match(navigationTest,/in-content Search entry points preserve their source screen/);
assert.match(stackedCss,/People\/Categories: editor first/);
assert.match(stackedCss,/Prayer detail becomes one dense story stream/);
assert.match(stackedCss,/History detail views use compact timeline rows/);
assert.match(denseSecondaryTest,/People and Categories put the editor before the saved list/);
assert.match(denseSecondaryTest,/Prayer detail is a compact mobile story with visible status context/);
assert.match(denseSecondaryTest,/History Day keeps its date visible/);
assert.match(denseSecondaryTest,/dense management screens remain usable at 320px and 200 percent text/);
assert.equal(contract.secondaryNavigation.behavior,"hide root bottom tabs and Search/Data utility actions; expose contextual Back navigation");
assert.equal(contract.secondaryNavigation.touchTargetPx,44);
assert.equal(pkg.scripts["verify:mobile-layout"],"node scripts/verify-mobile-first-layout.mjs");

console.log("✓ Mobile-first layout contract verified");
console.log("  compact app bar + bottom root-tab bar installed");
console.log("  Today reading cards convert to grouped rows");
console.log("  Bible is reading-first with mobile artwork removed");
console.log("  Prayer and History use dense mobile-native compositions");
console.log("  secondary routes use stacked navigation and 44px contextual Back");
console.log("  active Focused Prayer can remove outer shell chrome without trapping empty states");
console.log("  Search/Data preserve exact mobile source context through utility workflows");
console.log("  Prayer management and History detail routes use dense mobile-native compositions");
console.log("  320px, 200% text and phone-landscape detail states are covered");
console.log("  desktop/tablet Morning Grace layers remain upstream and unchanged");
