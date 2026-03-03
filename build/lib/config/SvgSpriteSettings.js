const path = require('path');
const fs = require('fs');

/**
 * @typedef {object} SvgSpriteSettings~options
 * Configuration for SVG sprite generation.
 *
 * @property {boolean} enabled
 *   Whether SVG sprite generation is enabled or not.
 * @property {string} source
 *   Source directory containing SVG files.
 * @property {string} dest
 *   Destination directory for generated sprite.
 * @property {object} svgo
 *   SVGO optimization options.
 * @property {object} config
 *   The gulp-svg-sprite configuration.
 */

class SvgSpriteSettings {

  /**
   * Whether SVG sprite generation is enabled or not.
   * @type {boolean}
   */
  #enabled;

  /**
   * The SVG source.
   * @type {string}
   */
  #source;

  /**
   * The SVG destination.
   * @type {string}
   */
  #dest;

  /**
   * The gulp-svg-sprite configuration.
   * @type {object}
   * @see https://github.com/svg-sprite/gulp-svg-sprite
   * @see https://github.com/svg-sprite/svg-sprite
   */
  #config;

  /**
   * Default configuration.
   *
   * @type {SvgSpriteSettings~options}
   */
  static DEFAULT_CONFIG = {
    enabled: true,
    srcDir: './src/icons',
    destDir: './dist/sprites',
    config: {
      mode: 'stack',
    },
  };

  /**
   * Constructor.
   *
   * @param {Partial<SvgSpriteSettings~options>} userConfig
   *   User-provided configuration, merged with defaults.
   */
  constructor(userConfig) {
    /** @type {SvgSpriteSettings~options} */
    const config = {
      ...SvgSpriteSettings.DEFAULT_CONFIG,
      ...userConfig,
    };

    this.#enabled = !!(config.enabled || false);
    this.#source = config.source;
    this.#dest = config.dest;
    this.#config = config.config;
  }

  /**
   * Whether SVG sprite generation is enabled or not.
   * @return {boolean}
   */
  get enabled() {
    return this.#enabled;
  }

  /**
   * Get the source directory.
   *
   * @return {string}
   */
  get source() {
    return this.#source;
  }

  /**
   * Get the destination directory.
   *
   * @return {string}
   */
  get dest() {
    return this.#dest;
  }

  /**
   * Get the Gulp SVG Sprite configuration.
   * @return {Object}
   */
  get config() {
    return this.#config;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return {
      enabled: this.#enabled,
      source: this.#source,
      dest: this.#dest,
      config: this.#config,
    };
  }

}

module.exports = SvgSpriteSettings;
