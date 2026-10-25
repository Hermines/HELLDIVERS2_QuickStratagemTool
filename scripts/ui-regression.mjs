import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readUiFile(filename) {
  return fs.readFileSync(path.join(root, "ui", filename), "utf8");
}

function checkInlineScripts(filename) {
  const html = readUiFile(filename);
  const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, `${filename} should contain an inline script`);
  scripts.forEach((match, index) => {
    new vm.Script(match[1], { filename: `${filename}:inline-${index + 1}` });
  });
}

checkInlineScripts("index.html");
checkInlineScripts("overlay.html");
checkInlineScripts("toast.html");
checkInlineScripts("ocr-help.html");
checkInlineScripts("ocr-select.html");

const indexSource = readUiFile("index.html");
const overlaySource = readUiFile("overlay.html");
const ocrHelpSource = readUiFile("ocr-help.html");
const toastSource = readUiFile("toast.html");
const mainSource = fs.readFileSync(path.join(root, "src-tauri", "src", "main.rs"), "utf8");
const hooksSource = fs.readFileSync(path.join(root, "src-tauri", "src", "hooks.rs"), "utf8");
const inputSource = fs.readFileSync(path.join(root, "src-tauri", "src", "input.rs"), "utf8");
const windowsSource = fs.readFileSync(path.join(root, "src-tauri", "src", "windows.rs"), "utf8");
const networkSource = fs.readFileSync(path.join(root, "src-tauri", "src", "network.rs"), "utf8");
const catalogSource = fs.readFileSync(path.join(root, "src-tauri", "src", "catalog.rs"), "utf8");

assert.match(indexSource, /<div id="titlebar" data-tauri-drag-region="deep">/);
assert.match(indexSource, /<div class="titlebar-controls" data-tauri-drag-region="false">/);
assert.match(overlaySource, /<div id="drag-bar" data-tauri-drag-region="deep">/);
assert.match(overlaySource, /<button class="lock-btn" data-tauri-drag-region="false"/);
assert.match(ocrHelpSource, /<div id="titlebar" data-tauri-drag-region="deep">/);
assert.match(ocrHelpSource, /<button id="close-btn" data-tauri-drag-region="false"/);
assert.match(ocrHelpSource, /html\[data-theme="light"\]\s*\{/, "the OCR help window must ship a light theme token set");
assert.match(
  ocrHelpSource,
  /loadData\('settings\.json'\)[\s\S]{0,200}applyTheme\(settings && settings\.theme\)/,
  "the OCR help window must adopt the persisted theme at load time",
);

// Light-theme readability and Fluent styling of the remaining surfaces.
assert.match(
  indexSource,
  /html\[data-theme="light"\] \.arrow-img \{ filter: invert\(1\)/,
  "the white direction arrows must be inverted on the light theme",
);
assert.match(
  indexSource,
  /--slider-track:/,
  "the opacity slider must use theme-aware track colors with enough contrast",
);
assert.match(
  indexSource,
  /\.toggle-option\.active \{ color: var\(--text-on-accent\); \}/,
  "the selected segment must use the accent fill so on/off switches stay readable in both themes",
);
assert.match(
  indexSource,
  /\.toggle-option\.active::before \{ opacity: 1; transform: scale\(1\); \}/,
  "switching segments must animate the selection pill in and out",
);
assert.match(
  indexSource,
  /\.toggle-box \{[^}]*border: 1px solid var\(--stroke-strong\);/,
  "the segmented switch container must keep a clearly visible border in both themes",
);
assert.match(toastSource, /html\[data-theme="light"\]/, "toast bubbles must ship a light theme token set");
assert.match(toastSource, /loadData\('settings\.json'\)/, "toast bubbles must adopt the persisted theme");
assert.match(
  overlaySource,
  /#drag-bar\s*\{[\s\S]{0,400}#4CC2FF/,
  "the overlay drag bar must use the Fluent accent instead of the legacy yellow",
);

// Focus rings, listening-state hint contrast, and overlay text hotkey styling.
assert.match(
  indexSource,
  /\.set-input:focus \{ background: var\(--bg-input-focus\); border-color: var\(--stroke-strong\); box-shadow: inset 0 -2px 0 var\(--accent\); \}/,
  "focused text fields must keep their visible neutral border and add only the accent underline",
);
assert.doesNotMatch(
  indexSource,
  /input:focus-visible/,
  "text inputs must not draw the outer keyboard-focus ring; the accent underline already marks focus",
);
assert.match(
  indexSource,
  /--bg-input-focus:/,
  "text field fills must be theme-aware and recessed at rest",
);
assert.match(
  indexSource,
  /--shadow-btn:/,
  "neutral buttons must carry theme-aware elevation shadows",
);
assert.match(
  indexSource,
  /\.set-btn \{[\s\S]{0,400}box-shadow: var\(--shadow-btn\)/,
  "settings action buttons (unlock, reset position, key binds) must be elevated",
);
assert.match(
  indexSource,
  /\.set-btn:hover \{ background: var\(--fill-control-hover\); transform: translateY\(-1px\); box-shadow: var\(--shadow-btn-hover\); \}/,
  "settings action buttons must lift on hover",
);
assert.match(
  indexSource,
  /select\.set-input option \{ background-color: var\(--bg-solid-strong\); color: var\(--text-primary\); \}/,
  "native dropdown options must stay readable in both themes",
);
assert.match(
  indexSource,
  /\.btn-square\.primary \{[\s\S]{0,300}box-shadow: 0 1px 2px rgba\(0, 0, 0, 0\.35\)/,
  "primary buttons must carry elevation shadow for depth",
);
assert.match(
  indexSource,
  /\.btn-square\.primary:hover \{ background-color: var\(--accent-hover\); transform: translateY\(-1px\);/,
  "primary button hover must give clear lift feedback",
);
assert.match(
  indexSource,
  /\.bind-btn\.listening \.bind-subtext \{ color: var\(--text-on-accent\); font-size: 11px; \}/,
  "the chord-capture hint must stay readable on the accent-filled listening button",
);
assert.match(
  overlaySource,
  /\.hotkey-text \{[\s\S]{0,300}#1A86D8/,
  "text-style hotkey hints in the overlay must use the deeper Fluent blue",
);
assert.doesNotMatch(overlaySource, />MOVE</, "the overlay drag bar must not show the MOVE label");

// The title bar exposes a persisted light/dark theme toggle.
assert.match(
  indexSource,
  /<button class="window-btn theme-btn" id="btn-theme" onclick="toggleTheme\(\)"/,
  "the title bar must expose the theme toggle button",
);
assert.match(
  indexSource,
  /theme:\s*'dark',/,
  "the persisted theme must default to dark so old configurations keep the previous look",
);
assert.match(
  indexSource,
  /gameSettings\.theme = gameSettings\.theme === 'light' \? 'light' : 'dark';/,
  "malformed persisted theme values must normalize to dark instead of silently enabling light mode",
);
assert.match(
  indexSource,
  /function applyTheme\(\) \{[\s\S]{0,200}documentElement\.dataset\.theme/,
  "the saved theme must drive the html data-theme attribute consumed by the theme token sets",
);
assert.match(indexSource, /html\[data-theme="light"\]\s*\{/, "a light theme token set must exist");
assert.match(indexSource, /themeToLight: "切换到浅色主题"/);
assert.match(indexSource, /themeToDark: "切换到深色主题"/);
assert.match(indexSource, /themeToLight: "Switch to light theme"/);
assert.match(indexSource, /themeToDark: "Switch to dark theme"/);

// The main window uses a landscape layout with the primary actions in a sidebar.
assert.match(indexSource, /<nav id="app-sidebar" aria-label="Main navigation">/);
assert.doesNotMatch(indexSource, /class="top-controls"/, "the top button row must stay replaced by the sidebar");
assert.match(indexSource, /<button class="sidebar-btn" id="btn-top-settings" onclick="openSettings\(\)">/);
assert.match(indexSource, /<button class="sidebar-btn" id="btn-top-presets" onclick="openPresets\(\)">/);
assert.match(indexSource, /<button class="sidebar-btn" id="btn-top-overlay" onclick="handleToggleOverlay\(\)">/);
assert.match(indexSource, /<button class="sidebar-btn primary" id="btn-top-lib" onclick="openLibrary\(\)">/);
assert.match(
  indexSource,
  /querySelector\('\.sidebar-label'\)\.textContent = lang\.btnSettings/,
  "sidebar localization must update the label span without erasing the button icon",
);
assert.match(indexSource, /<div id="main-panel">\s*<div class="main-panel-title" id="txt-main-title">/);
assert.match(indexSource, /mainLoadoutTitle: "当前装配"/);
assert.match(indexSource, /mainLoadoutTitle: "CURRENT LOADOUT"/);

assert.match(
  indexSource,
  /<html lang="zh-CN" data-ui-ready="false" aria-busy="true">/,
  "the unlocalized startup shell must be hidden before the first paint",
);
assert.match(
  indexSource,
  /html\[data-ui-ready="false"\] body > \*\s*{\s*visibility:\s*hidden;/,
  "startup content must remain hidden while settings are loading",
);
assert.match(indexSource, /function finishUiStartup\(\)[\s\S]*dataset\.uiReady = 'true'/);
assert.match(
  indexSource,
  /function updateI18n\(\) \{[\s\S]{0,80}documentElement\.lang = currentLang === 'zh' \? 'zh-CN' : 'en';/,
  "every localization refresh must sync the <html lang> attribute, including runtime language switches",
);
// Loadout drag reordering must preview live: the dragged row follows the mouse
// and the affected rows shift smoothly to their projected slots.
assert.match(
  indexSource,
  /function applyDragPreview\(dropIndex, clientY\) \{/,
  "the loadout drag must render a live reorder preview",
);
assert.match(
  indexSource,
  /sourceRow\.style\.transform = `translateY\(\$\{clientY - mouseDrag\.startY \+ dragScrollDelta\(\)\}px\) scale\(1\.02\)`;/,
  "the dragged row must follow the cursor without a transition",
);
assert.match(
  indexSource,
  /body\.is-dragging \.list-row\.dragging \{ pointer-events: none; \}/,
  "the floating drag row must not intercept pointer input",
);
assert.match(
  indexSource,
  /\.list-row\.dragging \{[\s\S]{0,120}transition: none;/,
  "the dragged row must track the cursor without transition lag",
);
assert.match(
  indexSource,
  /function dropIndexAt\(clientX, clientY\) \{[\s\S]{0,600}for \(const rect of mouseDrag\.rowRects\)/,
  "drop lookup must use the captured row geometry instead of transformed hit-testing",
);
assert.match(
  indexSource,
  /row\.style\.transform = shift \? `translateY\(\$\{shift\}px\)` : '';/,
  "affected rows must shift to their projected slots and reset when the preview collapses",
);
assert.match(
  indexSource,
  /if \(mouseDrag\) finishLoadoutDrag\(\);\s*[\s\S]{0,260}style\.transition = 'none';[\s\S]{0,120}style\.transform = '';/,
  "a new drag must hard-reset any in-flight settle animation before capturing the baseline geometry",
);
assert.match(
  indexSource,
  /if \(mouseDrag\) finishLoadoutDrag\(\);[\s\S]{0,600}?dragSrcIndex = sourceIndex;/,
  "the source index must be assigned after the stale-drag reset, which clears it",
);
assert.match(
  indexSource,
  /function dragScrollDelta\(\) \{[\s\S]{0,300}main-panel[\s\S]{0,120}scrollTop - mouseDrag\.startScrollTop/,
  "wheel-scrolling the panel during a drag must be compensated in the captured geometry",
);
assert.match(
  indexSource,
  /const y = clientY \+ dragScrollDelta\(\);/,
  "the drop lookup must map the cursor back onto the captured row centers after scrolling",
);
assert.match(
  indexSource,
  /clientY - mouseDrag\.startY \+ dragScrollDelta\(\)/,
  "the floating row must stay glued to the cursor across mid-drag scrolling",
);
assert.match(
  indexSource,
  /!sourceRow\.classList\.contains\('dragging'\)\) \{ finishLoadoutDrag\(\); return; \}/,
  "a mid-drag list re-render must end the drag gracefully instead of continuing headless",
);
const initDataStart = indexSource.indexOf("async function initData()");
const initDataEnd = indexSource.indexOf("window.handleToggleOverlay", initDataStart);
assert.notEqual(initDataStart, -1, "could not find main UI initialization");
assert.notEqual(initDataEnd, -1, "could not find main UI initialization end marker");
const initDataSource = indexSource.slice(initDataStart, initDataEnd);
const firstThemeApply = initDataSource.indexOf("applyTheme();");
const firstI18nUpdate = initDataSource.indexOf("updateI18n();");
const slowStartupIo = initDataSource.indexOf("await Promise.all([");
assert.ok(
  firstThemeApply > -1 && firstThemeApply < firstI18nUpdate,
  "the saved theme must be applied before the first localization pass",
);
assert.ok(
  firstI18nUpdate > -1 && firstI18nUpdate < slowStartupIo,
  "the saved language must be applied before slower startup I/O",
);
assert.match(
  initDataSource,
  /updateI18n\(\);\s*renderMainList\(\{ syncOverlay: true \}\);\s*finishUiStartup\(\);/,
  "the UI may only be revealed after localization and the initial list render",
);
assert.match(
  indexSource,
  /initData\(\)\.catch\([\s\S]*?\)\.finally\(finishUiStartup\);/,
  "startup failures must not leave the window permanently hidden",
);

const tauriConfig = JSON.parse(
  fs.readFileSync(path.join(root, "src-tauri", "tauri.conf.json"), "utf8"),
);
const installerHooks = tauriConfig.bundle?.windows?.nsis?.installerHooks;
assert.equal(installerHooks, "windows/installer-hooks.nsh");
const cargoVersion = fs
  .readFileSync(path.join(root, "src-tauri", "Cargo.toml"), "utf8")
  .match(/^version\s*=\s*"([^"]+)"/m)?.[1];
assert.ok(cargoVersion, "Cargo.toml must declare a package version");
assert.equal(tauriConfig.version, cargoVersion, "the bundled version must match the application version");
const mainWindowConfig = tauriConfig.app?.windows?.find((window) => window.label === "main");
assert.ok(mainWindowConfig, "the main window must remain declared in tauri.conf.json");
assert.ok(
  mainWindowConfig.width > mainWindowConfig.height,
  "the main window must default to a landscape size for the sidebar layout",
);
assert.ok(
  mainWindowConfig.minWidth >= 860 && mainWindowConfig.minHeight >= 600,
  "the landscape window must keep a usable minimum size for the sidebar layout",
);
assert.equal(
  mainWindowConfig.transparent,
  true,
  "the main window must stay transparent so the rounded corners reveal the desktop instead of the webview background",
);
assert.equal(
  mainWindowConfig.backgroundColor,
  undefined,
  "an opaque webview background would bleed through the rounded window corners as dark wedges",
);
assert.equal(
  mainWindowConfig.visible,
  false,
  "the main window must start hidden and be revealed by the renderer so startup never flashes a blank frame",
);
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
assert.equal(packageJson.version, cargoVersion);
assert.equal(packageLock.version, cargoVersion);
assert.equal(packageLock.packages[""].version, cargoVersion);
const installerHookSource = fs.readFileSync(path.join(root, "src-tauri", installerHooks), "utf8");
assert.match(installerHookSource, /CheckIfAppIsRunning "HD2 Macro Terminal\.exe"/);
assert.match(installerHookSource, /CheckIfAppIsRunning "HD2-Trigger\.exe"/);
assert.doesNotMatch(installerHookSource, /CheckIfAppIsRunning "electron\.exe"/i);

for (const command of [
  "toggle_overlay",
  "show_toast",
  "open_ocr_help",
  "close_ocr_help_window",
  "start_ocr_region_select",
  "ocr_region_selected",
  "cancel_ocr_region_select",
]) {
  assert.match(
    mainSource,
    new RegExp(`async\\s+fn\\s+${command}\\s*\\(`),
    `${command} must stay async because it can create a WebView window on Windows`,
  );
}

assert.match(
  indexSource,
  /\.modal-overlay\s*{[\s\S]{0,500}visibility:\s*hidden;[\s\S]{0,500}\.modal-overlay\.active\s*{[^}]*visibility:\s*visible;/,
  "inactive full-window blur layers must be excluded from rendering",
);
assert.match(
  indexSource,
  /\.modal-overlay\s*{[\s\S]{0,600}transform: translateY\(14px\);/,
  "modal transitions must include a Fluent-style slide-up entrance",
);
assert.match(
  indexSource,
  /#global-status\s*{[\s\S]{0,500}visibility:\s*hidden;[\s\S]{0,500}#global-status\.show\s*{[^}]*visibility:\s*visible;/,
  "the hidden status blur layer must be excluded from rendering",
);
assert.match(
  mainSource,
  /if windows::overlay_is_visible\(&app\)\?\s*{[\s\S]{0,300}persist_current_overlay_position\(&app\)\?;[\s\S]{0,200}destroy_window\(&app, "overlay"\)\?;/,
  "overlay position must be persisted before its idle WebView is destroyed",
);
assert.match(
  windowsSource,
  /pub fn hide_toast[\s\S]{0,500}window\.destroy\(\)/,
  "expired toast WebViews must release their renderer instead of remaining hidden",
);

const helperStart = indexSource.indexOf("const CANONICAL_GLOBAL_KEYS");
const helperEnd = indexSource.indexOf("function normalizeOverlayPosition", helperStart);
assert.notEqual(helperStart, -1, "could not find UI safety helpers");
assert.notEqual(helperEnd, -1, "could not find UI safety helper end marker");

const context = vm.createContext({});
vm.runInContext(
  `
    const MAX_PRESET_NAME_LENGTH = 40;
    const MAX_SLOT_COUNT = 14;
    const EMPTY_IMAGE_SOURCE = "empty-image";
    ${indexSource.slice(helperStart, helperEnd)}
    globalThis.helpers = {
      canonicalGlobalKeyName,
      normalizeHotkeyChord,
      normalizeGlobalInputEvent,
      domBindingInputFromCode,
      bindingChordFromInput,
      escapeHtml,
      safeImageSource,
      normalizeImportedPreset
    };
  `,
  context,
  { filename: "index.html:safety-helpers" },
);

const {
  canonicalGlobalKeyName,
  normalizeHotkeyChord,
  normalizeGlobalInputEvent,
  domBindingInputFromCode,
  bindingChordFromInput,
  escapeHtml,
  safeImageSource,
  normalizeImportedPreset,
} = context.helpers;
assert.equal(canonicalGlobalKeyName("W"), "KeyW");
assert.equal(canonicalGlobalKeyName("Up"), "ArrowUp");
assert.equal(canonicalGlobalKeyName("F24"), "F24");
assert.equal(canonicalGlobalKeyName("NotAKey"), null);
assert.equal(normalizeHotkeyChord("F8"), "F8", "legacy single-key bindings must remain valid");
assert.equal(normalizeHotkeyChord("ControlLeft+1"), "ControlLeft+Digit1");
assert.equal(normalizeHotkeyChord("ControlLeft+ControlLeft"), null);
assert.equal(normalizeHotkeyChord("WheelUp+Digit1"), null, "a wheel edge cannot be held as a modifier");
assert.equal(
  normalizeHotkeyChord("ControlLeft+ShiftLeft+AltLeft+MetaLeft+KeyW+KeyA+KeyS+KeyD+Digit1"),
  null,
  "oversized chords must be rejected",
);
const extraHeldInput = normalizeGlobalInputEvent({
  key: "Digit1",
  pressedInputs: ["ShiftLeft", "KeyW", "ControlLeft", "Digit1"],
});
assert.deepEqual(
  JSON.parse(JSON.stringify(bindingChordFromInput(extraHeldInput))),
  ["ControlLeft", "ShiftLeft", "KeyW", "Digit1"],
  "binding should keep the newest input as the trigger and order held requirements consistently",
);
const domPressedKeys = new Set();
assert.deepEqual(
  JSON.parse(JSON.stringify(domBindingInputFromCode("ControlLeft", domPressedKeys))),
  { key: "ControlLeft", pressedInputs: ["ControlLeft"] },
);
const domChordInput = domBindingInputFromCode("KeyW", domPressedKeys);
assert.deepEqual(
  JSON.parse(JSON.stringify(bindingChordFromInput(domChordInput))),
  ["ControlLeft", "KeyW"],
  "focused-window keyboard capture must preserve held keys for chord binding",
);
assert.equal(domBindingInputFromCode("NotAKey", domPressedKeys), null);
assert.equal(escapeHtml('<img src=x onerror="boom">'), "&lt;img src=x onerror=&quot;boom&quot;&gt;");
assert.equal(safeImageSource("Machine_Gun_Stratagem_Icon.svg"), "Machine_Gun_Stratagem_Icon.svg");
assert.equal(safeImageSource("javascript:alert(1)"), "empty-image");
assert.equal(safeImageSource("https://tracker.invalid/icon.svg"), "empty-image");

const databaseStart = indexSource.indexOf("const defaultStratagemDB = [");
const databaseEnd = indexSource.indexOf("let stratagemDB", databaseStart);
assert.notEqual(databaseStart, -1, "could not find the default stratagem database");
assert.notEqual(databaseEnd, -1, "could not find the default stratagem database end marker");
const bundledIcons = [...indexSource.slice(databaseStart, databaseEnd).matchAll(/\bicon:\s*'([^']+)'/g)].map(
  (match) => match[1],
);
assert.ok(bundledIcons.length >= 103, "expected the bundled stratagem icon catalog synced to v11");
for (const icon of new Set(bundledIcons)) {
  assert.equal(safeImageSource(icon), icon, `bundled icon should be accepted: ${icon}`);
  assert.ok(fs.existsSync(path.join(root, "ui", icon)), `bundled icon is missing: ${icon}`);
}

const databaseContext = vm.createContext({});
vm.runInContext(
  `${indexSource.slice(databaseStart, databaseEnd)}\nglobalThis.database = defaultStratagemDB;`,
  databaseContext,
  { filename: "index.html:stratagem-database" },
);
const meltagun = JSON.parse(
  vm.runInContext(
    "JSON.stringify(database.find((stratagem) => stratagem.id === 'wpn_meltagun'))",
    databaseContext,
  ),
);
assert.deepEqual(meltagun, {
  id: "wpn_meltagun",
  grp: "support",
  name: { zh: "40-K热熔枪", en: "40-KMeltagun" },
  aliases: ["热熔枪"],
  ocr: ["热熔枪"],
  seq: ["S", "A", "W", "A", "A", "S"],
  icon: "40-K_Meltagun_Stratagem_Icon.svg",
});

const meltagunIconSource = readUiFile("40-K_Meltagun_Stratagem_Icon.svg");
assert.match(meltagunIconSource, /viewBox="0 0 256 256"/);
assert.match(meltagunIconSource, /fill="#011419" fill-opacity="\.75"/);
assert.match(meltagunIconSource, /fill="#53bcda"/);
assert.match(meltagunIconSource, /fill="#ffffee"/);
assert.match(meltagunIconSource, /fill="#5abeda"/);
assert.doesNotMatch(meltagunIconSource, /<image\b/i, "the bundled Meltagun icon must remain vector-only");

const validPreset = normalizeImportedPreset({
  n: "Support",
  l: [{ s: "wpn_mg", h: "F8", l: true }],
});
assert.equal(validPreset.name, "Support");
assert.equal(validPreset.loadout[0].hotkey, "F8");
const chordPreset = normalizeImportedPreset({
  n: "Chord",
  l: [{ s: "wpn_mg", h: "ControlLeft+Digit1", l: false }],
});
assert.equal(chordPreset.loadout[0].hotkey, "ControlLeft+Digit1");
assert.equal(
  normalizeImportedPreset({ n: "Bad", l: [{ s: "wpn_mg", h: '\"><img onerror=boom>', l: false }] }),
  null,
);
assert.equal(
  normalizeImportedPreset({ n: "Too many", l: Array.from({ length: 15 }, () => ({ s: null, h: null })) }),
  null,
);

const saveActorStart = indexSource.indexOf("const pendingDataSaves = new Map();");
const saveActorEnd = indexSource.indexOf("async function initData", saveActorStart);
assert.notEqual(saveActorStart, -1, "could not find the durable save actor");
assert.notEqual(saveActorEnd, -1, "could not find the durable save actor end marker");
const durableWrites = [];
const fallbackWrites = new Map();
const saveContext = vm.createContext({
  console: { ...console, error() {} },
  setTimeout,
  structuredClone,
  localStorage: {
    getItem(key) {
      return fallbackWrites.get(key) ?? null;
    },
    setItem(key, value) {
      fallbackWrites.set(key, value);
    },
    removeItem(key) {
      fallbackWrites.delete(key);
    },
  },
  window: {
    electronAPI: {
      async saveData(filename, data) {
        durableWrites.push({ filename, data: structuredClone(data) });
      },
    },
  },
});
vm.runInContext(
  `
    ${indexSource.slice(saveActorStart, saveActorEnd)}
    globalThis.saveActor = {
      saveDataToLocal,
      loadWithMigration,
      nativeSaveFallbackKey,
      pendingDataSaves
    };
  `,
  saveContext,
  { filename: "index.html:save-actor" },
);
const firstRevision = { revision: 1, nested: { value: "first" } };
saveContext.saveActor.saveDataToLocal("settings.json", firstRevision, "settings-fallback");
firstRevision.nested.value = "mutated-after-queue";
saveContext.saveActor.saveDataToLocal("settings.json", { revision: 2 }, "settings-fallback");
const latestSave = saveContext.saveActor.saveDataToLocal(
  "settings.json",
  { revision: 3 },
  "settings-fallback",
);
await saveContext.window.flushPendingDataSaves();
await latestSave;
assert.deepEqual(
  JSON.parse(JSON.stringify(durableWrites)),
  [
    { filename: "settings.json", data: { revision: 1, nested: { value: "first" } } },
    { filename: "settings.json", data: { revision: 3 } },
  ],
  "the save actor should serialize writes and coalesce only superseded queued revisions",
);
assert.equal(saveContext.saveActor.pendingDataSaves.size, 0, "the save actor should fully drain");
assert.equal(fallbackWrites.size, 0, "successful native saves should not use localStorage fallback");

saveContext.window.electronAPI.saveData = async () => {
  throw new Error("simulated native write failure");
};
await saveContext.saveActor.saveDataToLocal(
  "settings.json",
  { revision: 4 },
  "settings-fallback",
);
await saveContext.window.flushPendingDataSaves();
const nativeFallbackKey = saveContext.saveActor.nativeSaveFallbackKey("settings.json");
assert.deepEqual(JSON.parse(fallbackWrites.get(nativeFallbackKey)), { revision: 4 });

saveContext.window.electronAPI.loadData = async () => ({ revision: 3 });
saveContext.window.electronAPI.saveData = async (filename, data) => {
  durableWrites.push({ filename, data: structuredClone(data) });
};
const recoveredRevision = await saveContext.saveActor.loadWithMigration(
  "settings.json",
  "settings-fallback",
);
assert.equal(recoveredRevision.revision, 4, "a newer failed native save must override the old file");
await saveContext.window.flushPendingDataSaves();
assert.equal(fallbackWrites.has(nativeFallbackKey), false, "recovered native saves should clear fallback");

saveContext.window.electronAPI.saveData = async () => {
  throw new Error("simulated persistent native failure");
};
saveContext.localStorage.setItem = () => {
  throw new Error("simulated localStorage failure");
};
await saveContext.saveActor.saveDataToLocal(
  "presets.json",
  { revision: 5 },
  "presets-fallback",
);
await assert.rejects(
  saveContext.window.flushPendingDataSaves(),
  /Failed to save presets\.json to native storage or local fallback/,
  "shutdown flush must surface a double persistence failure",
);

assert.match(
  indexSource,
  /if \(displayResult\.ok && gameSettings\.ocrDisplayId != null/,
  "display enumeration failures must not erase a saved OCR region",
);
const bridgeSource = readUiFile("bridge.js");
assert.doesNotMatch(indexSource, /diagnostics-modal|openDiagnostics|recordBindingDiagnostic/);
assert.doesNotMatch(mainSource, /collect_diagnostics_report|export_diagnostics_report|record_runtime_failure/);
assert.doesNotMatch(bridgeSource, /collectDiagnosticsReport|recordRuntimeFailure|openSponsor/);

assert.match(bridgeSource, /subscribe\("quit-requested", callback\)/);
assert.match(indexSource, /window\.electronAPI\.onQuitRequested/);
assert.match(bridgeSource, /setGlobalInputFilter:\s*\(config, captureAll\).*set_global_input_filter/);
assert.match(bridgeSource, /getInputDiagnostics:.*get_input_diagnostics/);
assert.match(bridgeSource, /onNativeShortcut:.*native-shortcut/);
assert.match(bridgeSource, /onNativeMacroStarted:.*native-macro-started/);
assert.match(bridgeSource, /onNativeMacroFinished:.*native-macro-finished/);
assert.doesNotMatch(bridgeSource, /check_for_updates|open_release_download|open_bilibili_page|load_cached_free_notice|check_free_notice_updates|should_show_free_notice|acknowledge_free_notice/);
assert.doesNotMatch(indexSource, /free-notice|freeSoftwareNotice|id="update-modal"|checkForStartupUpdate|pendingUpdateInfo|goToUpdateDownload|openReleaseDownload/);
assert.match(indexSource, /pendingGlobalInputFilter/);
assert.match(indexSource, /config:\s*buildNativeShortcutConfig\(\)/);
assert.match(indexSource, /payload:\s*buildMacroPayload\(item\)/);
assert.doesNotMatch(indexSource, /function\s+triggerMacro\s*\(/, "JavaScript must not match runtime macro shortcuts");
assert.match(hooksSource, /impl\s+ShortcutState[\s\S]*fn\s+route\s*\(/);
assert.match(hooksSource, /input::prepare_macro\(&binding\.payload\)/);
assert.match(inputSource, /struct\s+PreparedMacro/);
assert.match(inputSource, /dwExtraInfo:\s*SYNTHETIC_INPUT_MARKER/g);
assert.match(hooksSource, /extra_info\s*==\s*input::SYNTHETIC_INPUT_MARKER/);
assert.match(indexSource, /addEventListener\('keydown',\s*handleKeyInput\)/);
assert.match(indexSource, /addEventListener\('keyup',\s*handleKeyUp\)/);
assert.match(
  indexSource,
  /function\s+handleKeyInput\(e\)[\s\S]{0,500}domBindingInputFromCode\(e\.code,[\s\S]{0,300}captureBindingInput\(input\)/,
  "focused keyboard events must reach the binding state machine",
);
assert.match(mainSource, /fn\s+get_input_diagnostics\s*\(/);
assert.match(indexSource, /if \(isOverlayVisible\) \{[\s\S]*gameSettings\.ovExec/);
assert.match(indexSource, /directionOnly:\s*false/, "direction-only mode must be opt-in");
assert.match(indexSource, /directionOnly:\s*!!gameSettings\.directionOnly/);
assert.match(indexSource, /id="direction-only-off"[^>]*onclick="setDirectionOnly\(false\)"/);
assert.match(indexSource, /autoOpenOverlay:\s*false/, "startup overlay must be opt-in");
assert.match(indexSource, /autoLockOverlay:\s*false/, "overlay auto-lock must be opt-in");
assert.match(
  indexSource,
  /id="auto-open-overlay-off"[^>]*onclick="setAutoOpenOverlay\(false\)"[^>]*>关闭</,
  "the startup overlay setting must render off by default",
);
assert.match(
  indexSource,
  /id="auto-lock-overlay-off"[^>]*onclick="setAutoLockOverlay\(false\)"[^>]*>关闭</,
  "the overlay auto-lock setting must render off by default",
);
assert.match(
  indexSource,
  /if \(gameSettings\.autoOpenOverlay === true\) \{\s*await window\.handleToggleOverlay\(\);/,
  "startup must show the overlay only after an explicit opt-in",
);
assert.match(
  indexSource,
  /if \(gameSettings\.autoLockOverlay === true\) \{[\s\S]{0,300}await window\.electronAPI\.lockOverlay\(\);/,
  "every overlay show must honor the explicit auto-lock setting",
);
assert.match(indexSource, /id="btn-reset-overlay-position"[^>]*onclick="resetOverlayPosition\(\)"/);
assert.match(indexSource, /resetOverlayPosition: "重置位置"/);
assert.match(indexSource, /resetOverlayPosition: "RESET POSITION"/);
assert.match(
  indexSource,
  /window\.resetOverlayPosition = async[\s\S]{0,700}toggleOverlay\(\);[\s\S]{0,400}clearSavedOverlayPosition\(\);[\s\S]{0,600}await window\.handleToggleOverlay\(\);/,
  "the overlay must be hidden before the persisted position is cleared and shown again",
);
assert.match(
  indexSource,
  /window\.setOverlayStyle = \(mode\) => \{[\s\S]{0,600}updateOverlaySettings\(\{ opacity: gameSettings\.ovOpacity, style: gameSettings\.ovStyle \}\);[\s\S]{0,300}updateOverlay\(activeLoadout\);[\s\S]{0,200}updateSelection\(overlaySelectedIndex\);/,
  "switching the hotkey style must persist and push the style together with a fresh render",
);
assert.doesNotMatch(
  overlaySource,
  /onOverlaySettings\(async/,
  "the overlay settings handler must stay synchronous: re-renders are driven by render-overlay events",
);
assert.match(hooksSource, /pressed_inputs:\s*Vec</, "native events must include the held-input snapshot");
assert.match(indexSource, /void checkForStratagemCatalogUpdate\(\)/, "startup notifications must not block UI readiness");
assert.match(indexSource, /id="txt-catalog-update-title">战备数据库已更新</);
assert.match(indexSource, /strat\.enabled !== false/);
assert.match(indexSource, /getElementById\('txt-catalog-update-msg'\)\.textContent =/, "modal text must never be injected as HTML");
assert.doesNotMatch(mainSource, /check_for_updates|open_release_download|notices::|should_show_free_notice|acknowledge_free_notice|load_cached_free_notice|check_free_notice_updates|open_bilibili_page|take_startup_star_reminder|dismiss_star_reminders|open_github_repository/);
assert.match(networkSource, /WinHttpSetTimeouts/);
assert.match(catalogSource, /update\.unsnow\.online/);
assert.match(catalogSource, /Catalog signature verification failed/);
assert.match(catalogSource, /BUNDLED_CATALOG_VERSION:\s*u64\s*=\s*11/);

const overlayToggleStart = indexSource.indexOf("window.handleToggleOverlay = async");
const overlayToggleEnd = indexSource.indexOf("window.unlockOverlaySafely", overlayToggleStart);
assert.notEqual(overlayToggleStart, -1, "could not find overlay toggle handler");
assert.notEqual(overlayToggleEnd, -1, "could not find overlay toggle handler end marker");
const overlayCalls = [];
const overlayToasts = [];
const overlayContext = vm.createContext({
  console: { ...console, error() {} },
  window: {
    electronAPI: {
      async toggleOverlay() { overlayCalls.push("toggle"); return true; },
      async resizeOverlay() { overlayCalls.push("resize"); },
      async updateOverlaySettings() { overlayCalls.push("settings"); },
      async updateOverlay() { overlayCalls.push("data"); },
      async updateSelection() { overlayCalls.push("selection"); },
      async lockOverlay() { overlayCalls.push("lock"); },
    },
  },
});
vm.runInContext(
  `
    let isOverlayVisible = false;
    let overlaySelectedIndex = 0;
    const activeLoadout = [];
    const gameSettings = {
      ovWidth: 300,
      ovHeight: 550,
      ovOpacity: 100,
      ovStyle: "text",
      autoLockOverlay: false
    };
    const currentLang = "en";
    const i18n = { en: { msgOverlayFailed: "Overlay operation failed: {error}" } };
    async function syncGlobalInputFilter() { globalThis.overlayCalls.push("filter"); }
    function showToast(message, isError) { globalThis.overlayToasts.push({ message, isError }); }
    ${indexSource.slice(overlayToggleStart, overlayToggleEnd)}
    globalThis.overlayHarness = {
      toggle: window.handleToggleOverlay,
      settings: gameSettings,
      visible: () => isOverlayVisible
    };
  `,
  Object.assign(overlayContext, { overlayCalls, overlayToasts }),
  { filename: "index.html:overlay-toggle" },
);
await overlayContext.overlayHarness.toggle();
assert.deepEqual(overlayCalls, ["toggle", "filter", "resize", "settings", "data", "selection"]);
overlayCalls.length = 0;
overlayContext.overlayHarness.settings.autoLockOverlay = true;
await overlayContext.overlayHarness.toggle();
assert.deepEqual(overlayCalls, ["toggle", "filter", "resize", "settings", "data", "selection", "lock"]);
overlayCalls.length = 0;
overlayContext.window.electronAPI.lockOverlay = async () => { throw new Error("simulated lock failure"); };
await overlayContext.overlayHarness.toggle();
assert.equal(overlayContext.overlayHarness.visible(), true, "a lock failure must not mark a visible overlay as hidden");
assert.equal(overlayToasts.at(-1).isError, true, "an auto-lock failure must be visible to the user");

const resetStart = indexSource.indexOf("window.resetOverlayPosition = async");
const resetEnd = indexSource.indexOf("function saveCurrentLoadoutToCache", resetStart);
assert.notEqual(resetStart, -1, "could not find the overlay position reset handler");
assert.notEqual(resetEnd, -1, "could not find the overlay position reset handler end marker");
const resetCalls = [];
const resetToasts = [];
let failClear = false;
const resetContext = vm.createContext({
  console: { ...console, error() {} },
  window: { electronAPI: {
    async clearSavedOverlayPosition() {
      resetCalls.push("clear");
      if (failClear) throw new Error("disk full");
    },
    // The native hide persists the live window position, so the saved value
    // only becomes clearable after the overlay is hidden.
    async toggleOverlay() {
      resetCalls.push("toggle");
      const visible = resetCalls.filter((call) => call === "toggle").length % 2 === 1;
      if (!visible) resetContext.resetHarness.settings.overlayPosition = { x: 2439, y: 726 };
      return visible;
    },
  } },
});
vm.runInContext(
  `
    let isOverlayVisible = true;
    const gameSettings = { overlayPosition: { x: 2439, y: 726 } };
    const currentLang = "zh";
    const i18n = { zh: {
      resetOverlayDone: "悬浮窗位置已重置",
      resetOverlayFailed: "重置悬浮窗位置失败: {error}"
    } };
    window.handleToggleOverlay = async () => { resetCalls.push("handleToggleOverlay"); isOverlayVisible = true; };
    function showToast(message, isError) { resetToasts.push({ message, isError }); }
    ${indexSource.slice(resetStart, resetEnd)}
    globalThis.resetHarness = {
      run: window.resetOverlayPosition,
      settings: gameSettings,
      visible: () => isOverlayVisible,
    };
  `,
  Object.assign(resetContext, { resetCalls, resetToasts }),
  { filename: "index.html:overlay-position-reset" },
);
await resetContext.resetHarness.run();
assert.deepEqual(resetCalls, ["toggle", "clear", "handleToggleOverlay"], "the overlay must be hidden (which persists the live position) before the clear runs");
assert.equal(resetContext.resetHarness.settings.overlayPosition, null, "the in-memory position must be cleared after the native save");
assert.equal(resetContext.resetHarness.visible(), true, "the overlay must be shown again after the reset");
assert.equal(resetToasts.at(-1)?.isError ?? false, false, "a successful reset must be confirmed to the user");
assert.match(bridgeSource, /clearSavedOverlayPosition:\s*\(\)\s*=>\s*invoke\("clear_saved_overlay_position"\)/);
assert.match(bridgeSource, /showMainWindow:\s*\(\)\s*=>\s*invoke\("show_main_window"\)/);
assert.match(mainSource, /fn\s+show_main_window\s*\(/);
assert.match(mainSource, /main_window_shown/);
assert.match(
  indexSource,
  /function finishUiStartup\(\)[\s\S]{0,500}showMainWindow\(\)/,
  "the UI-ready handler must reveal the hidden main window",
);

resetCalls.length = 0;
failClear = true;
resetContext.resetHarness.settings.overlayPosition = { x: 2439, y: 726 };
await resetContext.resetHarness.run();
assert.deepEqual(resetCalls, ["toggle", "clear"], "a failed clear may hide the overlay but must never show it with a stale position");
assert.deepEqual(resetContext.resetHarness.settings.overlayPosition, { x: 2439, y: 726 }, "a failed clear must keep the in-memory position");
assert.equal(resetContext.resetHarness.visible(), false, "the overlay must stay hidden when the clear fails");
assert.equal(resetToasts.at(-1).isError, true, "a failed reset must be visible to the user");

const bridgeCalls = [];
let releaseBlockedFlush;
const bridgeContext = vm.createContext({
  window: {
    __TAURI__: {
      core: {
        invoke(command) {
          bridgeCalls.push(command);
          return Promise.resolve();
        },
      },
      event: { listen: () => Promise.resolve(() => {}) },
    },
    flushPendingDataSaves: () => new Promise((resolve) => { releaseBlockedFlush = resolve; }),
  },
});
vm.runInContext(bridgeSource, bridgeContext, { filename: "bridge.js" });
const blockedClose = bridgeContext.window.electronAPI.close();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(bridgeCalls, ["begin_exit"], "native exit watchdog must start before save flushing");
releaseBlockedFlush();
await blockedClose;
assert.deepEqual(bridgeCalls, ["begin_exit", "window_close"]);

const rejectedBridgeCalls = [];
const rejectedBridgeContext = vm.createContext({
  window: {
    __TAURI__: {
      core: {
        invoke(command, argumentsObject) {
          rejectedBridgeCalls.push({ command, argumentsObject });
          return command === "toggle_overlay"
            ? Promise.reject(new Error("private raw failure text"))
            : Promise.resolve();
        },
      },
      event: { listen: () => Promise.resolve(() => {}) },
    },
  },
});
vm.runInContext(bridgeSource, rejectedBridgeContext, { filename: "bridge.js:failure-tracking" });
await assert.rejects(rejectedBridgeContext.window.electronAPI.toggleOverlay(), /private raw failure text/);
assert.deepEqual(
  JSON.parse(JSON.stringify(rejectedBridgeCalls)),
  [
    { command: "toggle_overlay" },
  ],
  "rejected native operations must preserve the original error without diagnostics IPC",
);

await import("./library-favorites-regression.mjs");
console.log(`UI, native-window, and ${new Set(bundledIcons).size} icon regression tests passed.`);
