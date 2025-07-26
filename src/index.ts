import { getNewVersions } from "~/checker";
import { DEVELOPMENT } from "~/constants";
import { formatDiffMessage, formatReleaseMessage } from "~/formatter";
import { scanInstallers } from "~/scanner";
import { diffTranslations } from "~/strings";
import { Checker, DiffResult, TranslationPlatform, Version } from "~/types";
import { downloadVersionFile } from "~/version";

import { AnyTextableGuildChannel, Client } from "oceanic.js";

const client = new Client({
  auth: `Bot ${process.env.DISCORD_TOKEN}`,
  gateway: {
    intents: 0,
    compress: false
  }
});
let interval: NodeJS.Timeout | null = null;

client.on("ready", () => {
  console.log("Ready");

  if (!interval) {
    sendMessages();
    interval = setInterval(sendMessages, (DEVELOPMENT ? 1 : 60) * 60 * 1000);
  }
});

client.connect();

async function sendReleaseMessage(checker: Checker, batch: Version[]) {
  if (batch.length === 0) {
    return;
  }

  const channel = await client.rest.channels.get<AnyTextableGuildChannel>(process.env[`${checker.toUpperCase()}_RELEASE_CHANNEL`]!);
  if (!channel) {
    console.error(`No release channel found for ${checker}`);
    return;
  }

  const role = process.env[`${checker.toUpperCase()}_PING_ROLE`];

  await channel.createMessage({
    content: `${formatReleaseMessage(batch)}\n<@&${role}>`
  });
}

async function sendDiffMessage(platform: TranslationPlatform, diff: DiffResult) {
  const channel = await client.rest.channels.get<AnyTextableGuildChannel>(process.env[`${platform.toUpperCase()}_STRINGS_CHANNEL`]!);
  if (!channel) {
    console.error(`No strings channel found for ${platform}`);
    return;
  }

  const role = process.env[`${platform.toUpperCase()}_STRINGS_ROLE`];
  const messages = [`## New Strings Available!\n<@&${role}>`, ...formatDiffMessage(diff)];

  for (const message of messages) {
    await channel.createMessage({
      content: message
    });
  }
}

async function sendMessages() {
  const versions = await getNewVersions();

  for (const checker in versions) {
    const batch = versions[checker];
    await sendReleaseMessage(checker as Checker, batch);
  }

  if (versions.windows.length > 0) {
    const windowsFile = await downloadVersionFile(versions.windows[0]);
    if (windowsFile) {
      const installers = await scanInstallers(windowsFile);
      const versions = installers.reduce<Record<Checker, Version[]>>(
        (acc, version) => {
          const os = version.os.toLowerCase() as Checker;
          if (!acc[os]) {
            acc[os] = [];
          }
          acc[os].push(version);
          return acc;
        },
        {
          windows: [],
          linux: [],
          android: [],
          macos: []
        }
      );

      for (const checker in versions) {
        await sendReleaseMessage(checker as Checker, versions[checker]);
      }

      const translations = await diffTranslations("desktop", windowsFile);
      if (translations) {
        await sendDiffMessage("desktop", translations);
      }
    }
  }

  if (versions.android.length > 0) {
    const androidFile = await downloadVersionFile(versions.android[0]);
    if (androidFile) {
      const translations = await diffTranslations("mobile", androidFile);
      if (translations) {
        await sendDiffMessage("mobile", translations);
      }
    }
  }
}
