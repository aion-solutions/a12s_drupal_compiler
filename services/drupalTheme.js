const path = require("path");
const { glob } = require("glob");

let infoFile;

function getThemeInfoFile(rootPath) {
  if (typeof infoFile === "undefined") {
    [infoFile = null] = glob.sync(rootPath + "/*.info.yml");
  }

  return Promise.resolve(infoFile);
}

async function getModuleOrThemeName(rootPath) {
  infoFile = await getThemeInfoFile(rootPath);
  if (infoFile) {
    const matches = path.basename(infoFile).match(/^(.+)\.info\.yml$/);

    if (matches) {
      infoFile = undefined;
      return matches[1];
    }
  }
}

async function getThemeSassDefinitionFile(rootPath) {
  const name = await getModuleOrThemeName(rootPath);

  if (name) {
    const [sassFile = null] = glob.sync(rootPath + `/${name}.sass.yml`);
    return sassFile;
  }
}

export { getThemeInfoFile as default, getModuleOrThemeName, getThemeSassDefinitionFile };
