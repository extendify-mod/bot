import { MESSAGE_CHAR_LIMIT } from "~/constants";
import { DiffResult, Version } from "~/types";

export function formatReleaseMessage(versions: Version[]): string {
  let content = "## New versions available!\n";
  for (const version of versions) {
    content += `- ${version.channel}/${version.version}: ${version.arch} (${version.os}) [[**Download**]](<${version.url}>)\n`;
  }
  return content;
}

function splitMessage(title: string, lines: string[]) {
  const parts: string[] = [];
  let current = `**${title}**\n\`\`\`diff\n`;

  for (const line of lines) {
    const add = line + "\n\n";
    if ((current + add).length > MESSAGE_CHAR_LIMIT - 3) {
      parts.push(current + "```");
      current = "```diff\n" + add;
    } else {
      current += add;
    }
  }

  if (current !== "```diff\n") {
    parts.push(current + "```");
  }

  return parts;
}

export function formatDiffMessage(diff: DiffResult): string[] {
  let messages: string[] = [];

  if (Object.keys(diff.added).length !== 0) {
    const lines = Object.entries(diff.added).map((e) => `+ ${e[0]}: ${e[1]}`);
    messages = messages.concat(splitMessage("Added", lines));
  }

  if (Object.keys(diff.removed).length !== 0) {
    const lines = Object.entries(diff.removed).map((e) => `- ${e[0]}: ${e[1]}`);
    messages = messages.concat(splitMessage("Removed", lines));
  }

  if (Object.keys(diff.changed).length !== 0) {
    const lines = Object.entries(diff.changed).map((e) => `- ${e[0]}: ${e[1].left}\n+ ${e[0]}: ${e[1].right}`);
    messages = messages.concat(splitMessage("Changed", lines));
  }

  return messages;
}
