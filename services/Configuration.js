const { merge } = require("lodash");
const path = require("path");
const { glob } = require("glob");
const fs = require("fs");

class Configuration {

  GLOB_PATTERN = "/**/**/drupalCompiler.config.json";

  GLOB_PARSE_IGNORE = ["**/node_modules/**", "**/vendor/**"];

  static instance;

  constructor() {}

  static get() {
    return new Promise(async (resolve, reject) => {
      if (!Configuration.instance) {
        Configuration.instance = new Configuration();
        await Configuration.instance.parseConfiguration();
      }

      resolve(Configuration.instance);
    });
  }

  async parseConfiguration() {
    // Define the default configuration.
    const config = {
      default: require("../config.default"),
      components: new Map(),
    };

    const customConfigFile = path.resolve(config.default.drupalRoot, 'drupalCompiler.build.ts');

    return new Promise((resolve) => {
      fs.open(customConfigFile, 'r', (error) => {
        if (!error) {
          const customConfig = require(customConfigFile);
          merge(config.default, customConfig);
        }

        try {
          // Explore the different paths.
          config.default.paths.forEach(p => {
            glob.sync(path.resolve(config.default.drupalRoot, p) + this.GLOB_PATTERN, { ignore: this.GLOB_PARSE_IGNORE }).map(file => {
              const contentFile = JSON.parse(fs.readFileSync(file).toString('utf8'));
              contentFile.componentPath = path.dirname(file);
              config.components.set(path.basename(contentFile.componentPath), contentFile);
            });
          });
        }
        catch (err) {
          console.error(err);
        }

        this.configuration = config;
        resolve(config);
      });
    });
  }

  async loopOverComponents(callback) {
    for (let [name, componentConfig] of this.configuration.components) {
      const config = merge({}, this.configuration.default, componentConfig);
      await callback(name, config);
    }
  }
}

module.exports = Configuration;
