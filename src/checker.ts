import { ADGUARD_URL, APTOIDE_URL, COMMON_FETCH_OPTS, DATA_PATH, SPOTIFY_REPO_BASE_URL } from "~/constants";
import { parsePackages } from "~/package";
import { Checker, CheckerFunction, Version } from "~/types";
import { compareVersionString, isSimilar } from "~/version";

import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";

const checkers: Record<Checker, CheckerFunction> = {
  android: {
    async callback() {
      const response = await fetch(APTOIDE_URL, {
        method: "GET",
        ...COMMON_FETCH_OPTS
      });

      if (!response.ok) {
        console.log("Couldn't retreive latest app info for Android");
        this.ratelimited = true;
        return [];
      }

      const data: any = await response.json();
      const [app] = data?.datalist?.list ?? [];

      if (!app) {
        console.log("No results found for Spotify app");
        this.ratelimited = true;
        return [];
      }

      console.log(`Added new Android version ${app.file.vername} from Aptoide`);

      return [
        {
          arch: "AnyCPU",
          channel: "Aptoide",
          os: "Android",
          url: app.file.path,
          version: app.file.vername
        }
      ];
    }
  },
  linux: {
    async callback() {
      const result: Version[] = [];

      for (const channel of ["stable", "testing"]) {
        for (const arch of ["amd64", "i386"]) {
          const url = `${SPOTIFY_REPO_BASE_URL}/dists/${channel}/non-free/binary-${arch}/Packages`;
          const response = await fetch(url, {
            method: "GET",
            ...COMMON_FETCH_OPTS
          });

          if (!response.ok) {
            console.log(`Couldn't retreive latest app info for Linux (channel ${channel}, arch ${arch})`);
            this.ratelimited = true;
            continue;
          }

          const pkg = parsePackages(await response.text()).filter((v) => v.package === "spotify-client")[0];
          if (!pkg) {
            console.log(`Empty package at channel ${channel} for arch ${arch}`);
            continue;
          }

          const version = pkg.version.split(":")[1];
          result.push({
            arch,
            channel,
            os: "Linux",
            url: `${SPOTIFY_REPO_BASE_URL}/${pkg.filename}`,
            version
          });

          console.log(`Added new Linux version ${version} at channel ${channel} for arch ${arch}`);
        }
      }

      return result;
    }
  },
  windows: {
    async callback() {
      const result: Version[] = [];

      const response = await fetch(ADGUARD_URL, {
        headers: {
          accept: "*/*",
          "accept-language": "en-US,en;q=0.8",
          "content-type": "application/x-www-form-urlencoded",
          priority: "u=1, i",
          "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
          "sec-ch-ua-arch": '"x86"',
          "sec-ch-ua-bitness": '"64"',
          "sec-ch-ua-full-version-list": '"Not)A;Brand";v="8.0.0.0", "Chromium";v="138.0.0.0", "Brave";v="138.0.0.0"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-model": '""',
          "sec-ch-ua-platform": '"Windows"',
          "sec-ch-ua-platform-version": '"19.0.0"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "sec-gpc": "1",
          Referer: "https://store.rg-adguard.net/"
        },
        method: "POST",
        body: new URLSearchParams({
          type: "url",
          url: "https://apps.microsoft.com/detail/9ncbcszsjrsb",
          ring: "RP",
          lang: "en-US"
        }).toString(),
        ...COMMON_FETCH_OPTS
      });

      if (!response.ok) {
        console.log("Couldn't retreive MS Store info from AdGuard");
        this.ratelimited = true;
        return [];
      }

      const content = await response.text();
      if (content.includes("The server returned an empty list")) {
        console.log("Ratelimited by AdGuard");
        this.ratelimited = true;
        return [];
      }

      const matches = content.matchAll(/<a\s+href="([^"]+)"[^>]*>SpotifyAB.SpotifyMusic_(.+?)_(arm64|x64)__[^<]+?\.appx/g);

      for (const [_, url, version, arch] of Array.from(matches)) {
        const previous = result.find((v) => v.arch === arch);
        if (previous && compareVersionString(version, previous.version) === "newer") {
          continue;
        }

        result.push({
          arch,
          channel: "MS Store",
          os: "Windows",
          url,
          version
        });

        console.log(`Added new Windows version ${version} from MS Store for arch ${arch}`);
      }

      return result;
    }
  },
  macos: {
    async callback() {
      return [];
    }
  }
};

function getPreviousBatch(checker: Checker): Version[] {
  const batchPath = path.join(DATA_PATH, checker + "_batch.json");
  if (!existsSync(batchPath)) {
    return [];
  }
  return JSON.parse(readFileSync(batchPath).toString("utf-8"));
}

function saveBatch(checker: Checker, batch: Version[]) {
  const batchPath = path.join(DATA_PATH, checker + "_batch.json");
  writeFileSync(batchPath, JSON.stringify(batch));
}

export async function getNewVersions(): Promise<Record<Checker, Version[]>> {
  const result: Record<Checker, Version[]> = {
    windows: [],
    linux: [],
    android: [],
    macos: []
  };

  for (const checkerId in checkers) {
    const checker: CheckerFunction = checkers[checkerId];

    try {
      const batch = await checker.callback();

      if (checker.ratelimited) {
        if (!checker.timeout) {
          console.log(`Started ratelimit protection for ${checkerId}`);
          checker.timeout = setTimeout(
            () => {
              checker.ratelimited = false;
              checker.timeout = undefined;
            },
            120.1 * 60 * 1000
          );
        }
        continue;
      }

      const newVersions: Version[] = [];
      const previousBatch = getPreviousBatch(checkerId as Checker);
      const newBatch: Version[] = [];

      if (batch.length === 0) {
        continue;
      }

      for (const version of batch) {
        let isNewer = false;
        let foundAny = false;

        for (const oldVersion of previousBatch) {
          if (!isSimilar(version, oldVersion)) {
            continue;
          }

          const comparison = compareVersionString(version.version, oldVersion.version);
          isNewer = comparison === "newer";
          if (!isNewer) {
            newBatch.push(oldVersion);
          }

          foundAny = true;
          break;
        }

        if (isNewer || !foundAny) {
          newVersions.push(version);
          newBatch.push(version);
        }
      }

      saveBatch(checkerId as Checker, newBatch);

      result[checkerId] = newVersions;
    } catch (e) {
      console.error(`Error while running checker ${checkerId}:`, (e as Error).message);
    }
  }

  return result;
}
