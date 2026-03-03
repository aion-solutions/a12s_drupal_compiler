const ScssMapConfig = require('./ScssMapConfig');

/**
 * Represents the settings for SCSS processing.
 */
class ScssSettings {

  /**
   * Whether SCSS processing is enabled or not.
   * @type {boolean}
   */
  #enabled;

  /**
   * The browsers to target for the autoprefixer.
   * @type {string[]}
   */
  #autoPrefixerBrowsers;

  /**
   * The SCSS directories to process.
   * @type {ScssMapConfig[]}
   */
  #dirs;

  /**
   * The paths to include in the SCSS import search path.
   * @type {Array<string>}
   */
  #includePaths;

  /**
   * The output style for the generated CSS ("expanded" or "compressed").
   * @type {string}
   */
  #outputStyle;

  /**
   * Whether to include source comments in the generated CSS.
   * @type {boolean}
   */
  #sourceComments;

  /**
   * Whether to embed the source map in the generated CSS.
   * @type {boolean}
   */
  #sourceMapEmbed;

  constructor(configData) {
    this.#enabled = !!(configData.enabled || false);

    if (typeof configData.dirs === 'string') {
      this.#dirs = [new ScssMapConfig(configData.dirs)];
    }
    else if (Array.isArray(configData.dirs)) {
      this.#dirs = configData.dirs.map((dirConfig) => new ScssMapConfig(dirConfig));
    }

    this.#autoPrefixerBrowsers = configData.autoPrefixerBrowsers || [];
    this.#includePaths = configData.includePaths || [];
    this.#outputStyle = configData.outputStyle || 'expanded';
    this.#sourceComments = configData.sourceComments || false;
    this.#sourceMapEmbed = configData.sourceMapEmbed || false;
  }

  get enabled() {
    return this.#enabled;
  }

  get autoPrefixerBrowsers() {
    return this.#autoPrefixerBrowsers;
  }

  get dirs() {
    return this.#dirs;
  }

  get includePaths() {
    return this.#includePaths;
  }

  get outputStyle() {
    return this.#outputStyle;
  }

  get sourceComments() {
    return this.#sourceComments;
  }

  get sourceMapEmbed() {
    return this.#sourceMapEmbed;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return {
      enabled: this.#enabled,
      autoPrefixerBrowsers: this.#autoPrefixerBrowsers,
      dirs: this.#dirs,
      includePaths: this.#includePaths,
      outputStyle: this.#outputStyle,
      sourceComments: this.#sourceComments,
      sourceMapEmbed: this.#sourceMapEmbed
    };
  }

}

module.exports = ScssSettings;
