import path from "path";

export const DEVELOPMENT = process.argv.includes("dev");
export const WRITE_NEW_TRANSLATIONS = new Boolean(process.env.WRITE_NEW_TRANSLATIONS ?? true);

export const DATA_PATH = path.join(process.cwd(), "data");
export const MESSAGE_CHAR_LIMIT = 2000;

export const APTOID_URL = "https://ws2-cache.aptoide.com/api/7/apps/search?cdn=web&query=spotify&limit=1&offset=0&store_name=aptoide-web";
export const SPOTIFY_REPO_BASE_URL = "https://repository-origin.spotify.com";
export const ADGUARD_URL = "https://store.rg-adguard.net/api/GetFiles";
export const SPOTIFY_INSTALLER_BASE_URL = "https://upgrade.scdn.co/upgrade/client";

export const MS_STORE_SPOTIFY_ID = "9ncbcszsjrsb";

export const COMMON_FETCH_OPTS: RequestInit = {
  cache: "no-cache",
  redirect: "follow"
};
