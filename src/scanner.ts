import { SPOTIFY_INSTALLER_BASE_URL } from "~/constants";
import { CheckUrlResult, Version } from "~/types";

import JSZip from "jszip";
import pLimit from "p-limit";

const platforms: Version[] = [
  {
    arch: "x64",
    channel: "Official",
    os: "Windows",
    url: "win32-x86_64/spotify_installer-{0}-{1}.exe",
    version: ""
  },
  {
    arch: "arm64",
    channel: "Official",
    os: "Windows",
    url: "win32-arm64/spotify_installer-{0}-{1}.exe",
    version: ""
  },
  {
    arch: "x86/x64",
    channel: "Official",
    os: "MacOS",
    url: "osx-x86_64/spotify-autoupdate-{0}-{1}.tbz",
    version: ""
  },
  {
    arch: "arm64",
    channel: "Official",
    os: "MacOS",
    url: "osx-arm64/spotify-autoupdate-{0}-{1}.tbz",
    version: ""
  }
];

export async function scanInstallers(appx: Blob): Promise<Version[]> {
  const fullVersion = await getFullVersion(appx);
  if (fullVersion === null) {
    console.error("Couldn't retreive full version from AppX archive");
    return [];
  }

  console.log(`Found full version ${fullVersion}`);

  let start = 0,
    end = 1000,
    step = 1000,
    maxTries = 10;
  let found: Version[] = [];

  console.log("Starting crawler...");

  while (maxTries--) {
    const tasks: Promise<Version | null>[] = [];

    const limit = pLimit(10);

    for (const platform of platforms) {
      if (found.find((v) => v?.os === platform.os && v?.arch === platform.arch)) {
        continue;
      }

      platform.url = `${SPOTIFY_INSTALLER_BASE_URL}/${platform.url.replace("{0}", fullVersion)}`;

      for (let i = start; i <= end; i++) {
        tasks.push(limit(() => checkUrl(platform, i)));
      }

      if (platform.version.length === 0) {
        platform.version = fullVersion;
      }
    }

    const results = await Promise.all(tasks);
    found.push(...results.filter((v) => v !== null));

    const first = getFirst(found);
    if (Object.keys(first).length === Object.keys(platforms).length) {
      break;
    }

    start = end + 1;
    end += step;
  }

  console.log("Done crawling");
  return getFirst(found);
}

async function getFullVersion(appx: Blob): Promise<string | null> {
  const zip = await JSZip.loadAsync(await appx.bytes());
  const match = (await zip.file("Spotify.exe")?.async("string"))?.match(/(?<![\w\-])(\d+)\.(\d+)\.(\d+)\.(\d+)\.(g[0-9a-f]{8})(?![\w\-])/);
  return match ? match[0] : null;
}

async function checkUrl(platform: Version, num: number): Promise<Version | null> {
  try {
    const url = platform.url.replace("{1}", num.toString());
    const res = await fetch(url, { method: "HEAD" });

    if (res.ok) {
      platform.url = url;
      return platform;
    }
  } catch (e) {
    console.error(e);
  }
  return null;
}

function getFirst(found: Version[]): Version[] {
  const result: Version[] = [];
  for (const item of found) {
    if (!result.find((v) => v.os === item.os && v.arch === item.arch)) {
      result.push(item);
    }
  }
  return result;
}
