import { COMMON_FETCH_OPTS, DATA_PATH } from "~/constants";
import { Version, VersionComparison } from "~/types";

import { existsSync, openAsBlob, rmSync, writeFileSync } from "fs";
import path from "path";

export function getFilename(v: Version): string {
  return (v.os + "_" + v.arch + "_" + v.channel + "_" + v.version).replaceAll(" ", "-").toLowerCase() + ".download";
}

export async function downloadVersionFile(v: Version): Promise<Blob | null> {
  const filename = getFilename(v);
  const downloadPath = path.join(DATA_PATH, filename);

  if (existsSync(downloadPath)) {
    console.log(`Version ${filename} already downloaded, using cached path`);
    return await openAsBlob(downloadPath);
  }

  console.log(`Downloading file ${filename}...`);

  const response = await fetch(v.url, {
    method: "GET",
    ...COMMON_FETCH_OPTS
  });
  if (!response) {
    console.error(`Couldn't download file ${filename}`);
    return null;
  }

  const blob = await response.blob();
  writeFileSync(downloadPath, await blob.bytes());

  console.log(`Finished downloading file ${filename}`);

  setTimeout(
    () => {
      rmSync(downloadPath, { force: true });
      console.log(`Deleted downloaded file ${filename}`);
    },
    10 * 60 * 1000
  );

  return blob;
}

export function isSimilar(a: Version, b: Version): boolean {
  return a.arch === b.arch && a.channel === b.channel && a.os === b.os;
}

function parseVersion(s: string): number[] {
  return s
    .split(".")
    .map((v) => {
      try {
        return Number.parseInt(v);
      } catch {
        return undefined;
      }
    })
    .filter((v) => typeof v === "number");
}

/**
 * Compares two version strings relative to the first argument.
 * @returns "newer" if version a (first argument) has a higher value than version b (second argument).
 *          "older" if version a (first argument) has a lower value than version b (second argument).
 *          "equal" if version a (first argument) has the same value as version b (second argument).
 */
export function compareVersionString(a: string, b: string): VersionComparison {
  const [va, vb] = [parseVersion(a), parseVersion(b)];
  if (va.length > vb.length) {
    return "newer";
  } else if (va.length < vb.length) {
    return "older";
  }

  for (let i = 0; i < va.length; i++) {
    if (va[i] > vb[i]) {
      return "newer";
    } else if (va[i] < vb[i]) {
      return "older";
    }
  }

  return "equal";
}
