import { DATA_PATH } from "~/constants";
import { DiffResult, TranslationPlatform } from "~/types";

import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import JSZip from "jszip";
import path from "path";

function saveTranslations(platform: TranslationPlatform, translations: Record<string, string>) {
  const translationsPath = path.join(DATA_PATH, platform + "_translations.json");
  writeFileSync(translationsPath, JSON.stringify(translations));
  console.log(`Saved ${platform} translations file`);
}

function loadTranslations(platform: TranslationPlatform): Record<string, string> {
  const translationsPath = path.join(DATA_PATH, platform + "_translations.json");
  if (!existsSync(translationsPath)) {
    return {};
  }
  return JSON.parse(readFileSync(translationsPath).toString());
}

export async function diffTranslations(platform: TranslationPlatform, blob: Blob): Promise<DiffResult | null> {
  const oldStrings = loadTranslations(platform);
  const strings = platform === "desktop" ? await readWindowsStrings(blob) : await readAndroidStrings(blob);
  saveTranslations(platform, strings);

  if (Object.keys(oldStrings).length > 0 && Object.keys(strings).length > 0) {
    return diffObjects(oldStrings, strings);
  }

  return null;
}

function diffObjects(a: Record<string, string>, b: Record<string, string>): DiffResult | null {
  const diff: DiffResult = {
    added: {},
    removed: {},
    changed: {}
  };

  const oldKeys = Object.keys(a),
    newKeys = Object.keys(b);
  const keys = oldKeys.concat(newKeys);
  for (const key of keys) {
    const oldVal = oldKeys.includes(key) ? a[key] : null;
    const newVal = newKeys.includes(key) ? b[key] : null;

    if (newVal && oldVal === null) {
      diff.added[key] = newVal;
    } else if (oldVal && newVal === null) {
      diff.removed[key] = oldVal;
    } else if (oldVal && newVal && oldVal !== newVal) {
      diff.changed[key] = {
        left: oldVal,
        right: newVal
      };
    }
  }

  if (Object.keys(diff.added).concat(Object.keys(diff.removed)).concat(Object.keys(diff.changed)).length === 0) {
    return null;
  }

  return diff;
}

async function readWindowsStrings(appx: Blob): Promise<Record<string, string>> {
  const zip = await JSZip.loadAsync(await appx.bytes());
  const strings = {};

  for (const app of ["login", "xpui"]) {
    const bundle = zip.file(`Apps/${app}.spa`);
    if (!bundle) {
      console.error(`Couldn't find app ${app} in AppX archive`);
      continue;
    }

    const appArchive = await JSZip.loadAsync(await bundle.async("uint8array"));
    const translation = appArchive.file("i18n/en.json");
    if (!translation) {
      console.log("Couldn't find translation file in SPA archive");
      continue;
    }

    const content = JSON.parse(await translation.async("string"));
    for (const key in content) {
      const value = content[key];
      if (typeof value === "string") {
        strings[key] = value;
      } else if (typeof value === "object") {
        for (const child in value) {
          strings[`${key}.${child}`] = value[child];
        }
      } else {
        console.warn(`Didn't save translation item of type ${typeof value}`);
      }
    }
  }

  return strings;
}

async function readAndroidStrings(apkBlob: Blob): Promise<Record<string, string>> {
  const apk = await JSZip.loadAsync(await apkBlob.bytes());
  const arsc = apk.file("resources.arsc");
  if (!arsc) {
    console.error("Couldn't find ARSC file in APK archive");
    return {};
  }

  const resourcesPath = path.join(process.cwd(), "data/resources.arsc");
  const translationsPath = path.join(process.cwd(), "data/mobile_translations.json");
  writeFileSync(resourcesPath, await arsc.async("uint8array"));

  return new Promise((resolve) => {
    const extractor = spawn(
      process.env.JAVA_EXECUTABLE ?? "java",
      [
        "-jar",
        process.env.STRING_EXTRACTOR_PATH ?? path.join(process.cwd(), "data/arscstringextractor.jar"),
        resourcesPath,
        translationsPath
      ],
      {
        stdio: "inherit"
      }
    );
    extractor.on("close", () => {
      resolve(JSON.parse(readFileSync(translationsPath).toString()));
    });
  });
}
