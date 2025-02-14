const { merge } = require("lodash");
const path = require("path");
const { glob } = require("glob");
const fs = require("fs");
const {program} = require("../index");
const YAML = require("yaml");

class Configuration {

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
      default: require("../config.default.yml"),
      components: new Map(),
    };

    const customConfigFile = path.resolve(config.default.drupalRoot, program.getOptionValue('config-file'));

    return new Promise((resolve) => {
      try {
        const contentFile = YAML.parse(fs.readFileSync(customConfigFile).toString('utf8'));

        if (!contentFile) {
          merge(config.default, contentFile);
        }
      }
      catch (err) {
        console.error(err);
      }

      console.log(config, 'config');
      this.configuration = config;
      resolve(config);
    });
  }
}

module.exports = Configuration;
