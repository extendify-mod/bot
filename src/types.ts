export type Checker = "windows" | "linux" | "android" | "macos";

export type TranslationPlatform = "desktop" | "mobile";

export type VersionComparison = "equal" | "older" | "newer";

export type Version = {
  os: string;
  arch: string;
  channel: string;
  version: string;
  url: string;
};

export type CheckUrlResult = {
  os: string;
  arch: string;
  url: string;
};

export type Pair<A, B> = { left: A; right: B };

export type DiffResult = {
  added: Record<string, string>;
  removed: Record<string, string>;
  changed: Record<string, Pair<string, string>>;
};
