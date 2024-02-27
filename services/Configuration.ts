import {Configuration as ConfigurationDefinition} from "../types";
import {merge} from "lodash";
import * as path from "path";
import {glob} from "glob";
import * as fs from "fs";
import {program} from "../index";

export default class Configuration {

  readonly GLOB_PATTERN: string = "/**/**/drupalCompiler.config.json";

  readonly GLOB_PARSE_IGNORE: string[] = ["**/node_modules/**", "**/vendor/**"];

  protected static instance: Configuration;

  protected configuration: ConfigurationDefinition.Parsed;

  protected constructor() {}

  public static get(): Promise<Configuration> {
    return new Promise(async (resolve, reject) => {
      if (!Configuration.instance) {
        Configuration.instance = new Configuration();
        await Configuration.instance.parseConfiguration();
      }

      resolve(Configuration.instance);
    });
  }

  protected async parseConfiguration() {
    // Define the default configuration.
    const config: ConfigurationDefinition.Parsed = {
      default: require("../config.default"),
      components: new Map(),
    }

    const customConfigFile = path.resolve(config.default.drupalRoot, 'drupalCompiler.build.ts');

    return new Promise((resolve) => {
      fs.open(customConfigFile, 'r', (error) => {
        if (!error) {
          const customConfig = require(customConfigFile);
          merge(config.default, customConfig);
        }

        // Get the value of "paths" option.
        config.default.paths = (program.getOptionValue('paths') || config.default.paths || []).map((path: string) => path.trim());

        try {
          // Explore the different paths.
          config.default.paths.forEach(p => {
            glob.sync(path.resolve(config.default.drupalRoot, p) + this.GLOB_PATTERN, {ignore: this.GLOB_PARSE_IGNORE}).map(file => {
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

  public async loopOverComponents(callback: (name: string, config: ConfigurationDefinition.Partial) => Promise<void>) {
    for (let [name, componentConfig] of this.configuration.components) {
      const config = merge({}, this.configuration.default, componentConfig);
      await callback(name, config);
    }
  }

}
