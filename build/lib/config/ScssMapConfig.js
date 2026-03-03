/**
 * @typedef {Object} DirConfig
 * The configuration object of a directory mapping
 *
 * @property {string} source
 *   The source directory (required)
 * @property {string} [dest]
 *   The destination directory
 * @property {string} [pattern]
 *   The pattern for SCSS files
 * @property {string} [cleanPattern]
 *   The clean pattern for generated files
 * @property {Object} [variables]
 *   The variables configuration
 * @property {string} variables.definitionFile
 *   The variables definition file
 * @property {string} variables.targetDir
 *   The target directory for variables
 */

/**
 * Represents a single SCSS directory configuration mapping.
 */
class ScssMapConfig {

  /**
   * The clean pattern for removing generated files.
   * @type {string}
   */
  #cleanPattern = null;

  /**
   * The default clean pattern for generated CSS files.
   * @type {string}
   */
  #cleanPatternDefault = '/**/*.{css,css.map}';

  /**
   * The destination directory for compiled CSS files.
   * @type {string|null}
   */
  #dest = null;

  /**
   * The pattern for SCSS files.
   * @type {string}
   */
  #pattern = null;

  /**
   * The default pattern for SCSS files.
   * @type {string}
   */
  #patternDefault = '**/*.scss';

  /**
   * The source directory for SCSS files.
   * @type {string}
   */
  #source;

  /**
   * The SCSS variables configuration.
   * @type {{definitionFile: string, targetDir: string}|null}
   */
  #variables = null;

  /**
   * @param {string|DirConfig} dirConfig - The directory configuration
   *
   */
  constructor(dirConfig) {
    if (typeof dirConfig === 'string') {
      this.#source = dirConfig;
    }
    else if (typeof dirConfig === 'object') {
      if (typeof dirConfig.source !== 'string') {
        throw new Error('Invalid SCSS directory configuration. Expected a string as "source" property.');
      }

      this.#source = dirConfig.source;

      if ("dest" in dirConfig) {
        if (typeof dirConfig.dest !== 'string') {
          throw new Error('Invalid SCSS directory configuration. Expected either nothing or a string as "dest" property.');
        }

        this.#dest = dirConfig.dest;
      }

      if ("pattern" in dirConfig) {
        if (typeof dirConfig.pattern !== 'string') {
          throw new Error('Invalid SCSS directory configuration. Expected either nothing or a string as "pattern" property.');
        }

        this.#pattern = dirConfig.pattern;
      }

      if ("cleanPattern" in dirConfig) {
        if (typeof dirConfig.cleanPattern !== 'string') {
          throw new Error('Invalid SCSS directory configuration. Expected either nothing or a string as "cleanPattern" property.');
        }

        this.#cleanPattern = dirConfig.cleanPattern;
      }

      if ("variables" in dirConfig) {
        if (typeof dirConfig.variables !== 'object' || !('definitionFile' in dirConfig.variables) || !('targetDir' in dirConfig.variables) ) {
          throw new Error('Invalid SCSS directory configuration. Expected an object with "definitionFile" and "targetDir" properties as "variables" property.');
        }

        this.#variables = dirConfig.variables;
      }
    }
  }

  get source() {
    return this.#source;
  }

  get dest() {
    return this.#dest;
  }

  get pattern() {
    return this.#pattern || this.#patternDefault;
  }

  get cleanPattern() {
    return this.#cleanPattern || this.#cleanPatternDefault;
  }

  get variables() {
    return this.#variables;
  }

  /**
   * Converts the configuration to a plain object.
   * @returns {Object}
   */
  toJSON() {
    const obj = { source: this.#source };

    if (this.#dest !== null) {
      obj.dest = this.#dest;
    }

    if (this.#cleanPattern !== null) {
      obj.cleanPattern = this.#cleanPattern;
    }

    if (this.#variables !== null) {
      obj.variables = this.#variables;
    }

    return obj;
  }

  static createFromConfig(dir) {
    if (typeof dir === 'string') {
      return new ScssMapConfig(dir);
    }
    else if (typeof dir === 'object') {

    }
    else {
      throw new Error('Invalid SCSS directory configuration. Expected either a string or an object.');
    }

    return prepared;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return {
      source: this.#source,
      dest: this.#dest,
      pattern: this.#pattern,
      cleanPattern: this.#cleanPattern,
      variables: this.#variables
    };
  }
}

module.exports = ScssMapConfig;
