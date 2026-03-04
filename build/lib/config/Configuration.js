const ejs = require("ejs");
const fs = require("fs");
const path = require("path");
const ScssSettings = require("./ScssSettings");
const SvgSpriteSettings = require("./SvgSpriteSettings");
const YAML = require("yaml");

/**
 * @typedef {object} Configuration~options
 *   Options used for building the configuration.
 * @property {string} configFile
 *   Path to the custom configuration file. Defaults to './a12s-compiler.yml'.
 * @property {boolean} debug
 *   Enable source maps. Defaults to false.
 * @property {string} rootDir
 *   Root directory of the project.
 * @property {string} sourcesDir
 *   Directory containing the sources to be processed. Defaults to './sources'.
 * @property {string[]} types
 *   List of types to generate.
 * @property {boolean} verbose
 *   Display verbose output.
 */

/**
 * @typedef {object} Configuration~settings
 *   The processed settings.
 * @property {ScssSettings} scss
 *   The SCSS settings.
 * @property {SvgSpriteSettings} svgSprite
 *   The SVG Sprite settings.
 */

class Configuration {

  /**
   * @type {Configuration~settings}
   */
  #settings;

  /**
   * The options used for building the configuration.
   * @type {Configuration~options}
   */
  #options = {};

  /**
   * Options used for building the configuration.
   *
   * @type {Configuration~options}
   */
  static defaultOptions = {
    configFile: './a12s-compiler.yml',
    debug: false,
    rootDir: '.',
    sourcesDir: './sources',
    types: ['svg-sprite', 'css'],
    verbose: false,
  };

  static #instance;

  /**
   * The configuration instance.
   *
   * @param {Partial<Configuration~options>} options
   */
  constructor(options) {
    // @todo merge recursively, except for some specific properties.
    Object.assign(this.#options, Configuration.defaultOptions, options);

    if (this.getOption('verbose')) {
      console.log(this.#options, 'Configuration options');
    }
  }

  /**
   * Get the current options.
   *
   * @return {Configuration~options}
   */
  get options() {
    return this.#options;
  }

  /**
   * Get an option value.
   */
  getOption(name) {
    return this.#options[name] || null;
  }

  /**
   * Read the given configuration file.
   *
   * @param {string} filePath - Path to the Yaml file.
   * @return {*}
   */
  readConfig(filePath) {
    const verbose = this.getOption('verbose');

    if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
      try {
        return YAML.parse(fs.readFileSync(filePath).toString('utf8'));
      }
      catch (err) {
        if (verbose) {
          console.error(err);
        }
      }
    }
    else {
      if (verbose) {
        console.log(`Custom config file not found at ${filePath}`);
      }
    }

    return null;
  }

  /**
   * Parse the configuration from Yaml files.
   *
   * @return {Promise<unknown>}
   */
  async parseConfiguration() {
    let rawConfiguration = this.readConfig("./config.default.yml");
    const verbose = this.getOption('verbose');

    return new Promise((resolve) => {
      const configFile = this.getOption('configFile');
      const sourceDir = this.getOption('sourcesDir');

      if (typeof configFile === 'string' && configFile.length > 0 && configFile.match(/\.ya?ml$/i)) {
        // Try to find a custom config file, first in the "sources" directory...
        let configPath = path.resolve(this.rootDir, sourceDir, configFile);
        let extraConfig = this.readConfig(configPath);

        // Then in the root directory if none was found.
        if (extraConfig === null || typeof extraConfig !== 'object') {
          configPath = path.resolve(this.rootDir, configFile);
          extraConfig = this.readConfig(configPath);
        }

        if (extraConfig && typeof extraConfig === 'object' && Object.keys(extraConfig).length > 0) {
          rawConfiguration = this.deepMerge(rawConfiguration, extraConfig);

          if (verbose) {
            console.log(`Using config file: ${configPath}`);
          }
        }
      }

      this.#settings = {
        scss: new ScssSettings(rawConfiguration.scss || {}),
        svgSprite: new SvgSpriteSettings(rawConfiguration.svgSprite || {}),
      };

      if (verbose) {
        console.log(this.#settings, 'Parsed configuration');
      }

      resolve();
    });
  }

  /**
   * Get the project root directory.
   *
   * This is simply a shortcut as this option may be used quite often.
   *
   * @return {string}
   */
  get rootDir() {
    return this.getOption('rootDir');
  }

  /**
   * Get the sources directory.
   * @return {string}
   */
  get sourcesDir() {
    return this.getOption('sourcesDir');
  }

  /**
   * Get the settings.
   * @return {Configuration~settings}
   */
  get settings() {
    return this.#settings;
  }

  /**
   * Get SCSS settings.
   * @return {ScssSettings}
   */
  get scss() {
    return this.#settings.scss;
  }

  /**
   * Get SVG Sprite configuration.
   * @return {SvgSpriteSettings}
   */
  get svgSprite() {
    return this.#settings.svgSprite;
  }

  /**
   * Load a given template file.
   *
   * @param {string} name
   *   The template name, without the '.ejs' extension.
   *
   * @return {null|string}
   *   The template content or null if the file does not exist.
   */
  loadTemplate(name) {
    const templatePath = path.resolve(this.rootDir, 'templates/', name + '.ejs');

    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, 'utf8');
    }

    return null;
  }

  /**
   * Render a template with the given context.
   *
   * @param {string} name
   *   The template name, without the '.ejs' extension.
   * @param context
   *   The context to use for rendering.
   * @return {String|Promise<String>|null}
   */
  renderTemplate(name, context) {
    const template = this.loadTemplate(name);
    return template ? ejs.render(template, context) : null;
  }

  /**
   * Write a file from a template.
   *
   * @param filePath
   *   The path of the file to be written.
   * @param templateName
   *   The name of the template to use, without the '.ejs' extension.
   * @param context
   *   The context to use for rendering.
   *
   * @return {Promise<boolean>}
   */
  async writeFileFromTemplate(filePath, templateName, context) {
    const content = this.renderTemplate(templateName, context);

    if (content !== null) {
      const file = await fs.createWriteStream(filePath);
      file.write(content);
      file.end();
      return true;
    }

    return false;
  }

  /**
   * Deep merge utility function.
   *
   * This is very specific as only the 2nd level of objects needs to be merged.
   *
   * @param {object} source
   *   The source object. Only properties of this object are merged.
   * @param {object} target
   *   The target object. Properties of this object which does not exist in the
   *   source object are ignored.
   * @return {object}
   */
  deepMerge(source, target, currentLevel = 1, maxLevel = 2) {
    if (currentLevel > maxLevel || typeof source !== 'object') {
      return target;
    }

    const result = {};

    for (const [key, sourceValue] of Object.entries(source)) {
      if (key in target) {
        if (typeof sourceValue === 'object' && typeof target[key] === 'object') {
          result[key] = this.deepMerge(sourceValue, target[key], currentLevel + 1, maxLevel);
        }
        else {
          result[key] = target[key];
        }
      }
      else {
        result[key] = sourceValue;
      }
    }

    return result;
  }

}

let instance = null;
let loading = null;

/**
 * Get the configuration instance.
 * Throws an error if the configuration hasn't been loaded yet.
 *
 * @return {Configuration}
 * @throws {Error} If configuration hasn't been loaded
 */
function config() {
  if (!instance) {
    throw new Error('Configuration not loaded. Call load() first.');
  }
  return instance;
}

/**
 * Load and initialize the configuration.
 *
 * @param {Partial<Configuration~options>} options
 * @return {Promise<Configuration>}
 */
async function load(options) {
  if (!instance) {
    if (!loading) {
      loading = (async () => {
        instance = new Configuration(options);
        await instance.parseConfiguration();
      })();
    }
    await loading;
  }

  return instance;
}

module.exports = {
  defaultOptions: Configuration.defaultOptions,
  config,
  load,
};
