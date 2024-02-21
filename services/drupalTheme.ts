import {glob} from "glob";
import * as path from "path";

let infoFile: string;

function getThemeInfoFile(rootPath: string) {
  if (typeof infoFile === "undefined") {
    [infoFile = null] = glob.sync(rootPath + "/*.info.yml");
  }

  return Promise.resolve(infoFile);
}

async function getModuleOrThemeName(rootPath: string) {
  infoFile = await getThemeInfoFile(rootPath);
  if (infoFile) {
    const matches = path.basename(infoFile).match(/^(.+)\.info\.yml$/);

    if (matches) {
      infoFile = undefined;
      return matches[1];
    }
  }
}

async function getThemeSassDefinitionFile(rootPath: string) {
  const name = await getModuleOrThemeName(rootPath);

  if (name) {
    const [sassFile = null] = glob.sync(rootPath + `/${name}.sass.yml`);
    return sassFile;
  }
}

export { getThemeInfoFile as default, getModuleOrThemeName, getThemeSassDefinitionFile };
