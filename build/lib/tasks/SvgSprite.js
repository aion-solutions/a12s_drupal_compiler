const gulp = require('gulp');
const svgSprite = require('gulp-svg-sprite');
const { config: getConfig } = require("./../config/Configuration");
const { SvgIconsBuilder } = require('./../helpers/SvgIconsBuilder');
const fs = require('fs');
const path = require('path');

/**
 * SVG Sprite generation task.
 *
 * Generates optimized SVG sprites from individual SVG files with symbol support.
 */
module.exports = class SvgSprite {

  /**
   * Generate the SVG sprite.
   *
   * @return {Promise<void>}
   */
  async generate() {
    const config = getConfig();
    const svgSpriteSettings = config.svgSprite;
    const verbose = config.getOption('verbose');

    if (svgSpriteSettings.enabled) {
      const source = path.resolve(config.rootDir, config.sourcesDir, svgSpriteSettings.source);
      const dest = path.resolve(config.rootDir, config.sourcesDir, svgSpriteSettings.dest);

      if (verbose) {
        console.log(`Generating SVG Sprite from ${source} to ${dest}`);
      }

      const svgSpriteConfig = svgSpriteSettings.config;
      this.normalizeConfig(svgSpriteConfig);
      const svgIconsBuilder = new SvgIconsBuilder(config.rootDir, config.sourcesDir, dest, svgSpriteConfig, verbose);

      return new Promise((resolve, reject) => {
        if (fs.existsSync(dest)) {
          fs.rmSync(dest, { recursive: true, force: true });
        }

        gulp.src(path.join(source, '**/*.svg'))
          .pipe(svgSprite(svgSpriteConfig))
          .pipe(gulp.dest(dest))
          .on('end', () => {
            svgIconsBuilder.generateIconsScss();
            resolve();
          })
          .on('error', (error) => {
            console.error('SVG Sprite generation failed:', error);
            reject(error);
          });
      });
    }

    return Promise.resolve();
  }

  /**
   * Normalize the SVG Sprite configuration.
   *
   * @param {object} svgSpriteConfig - The gulp-svg-sprite configuration.
   */
  normalizeConfig(svgSpriteConfig) {
    // Use the default svg-sprite configuration as fallback (@see the constant
    // "defaultShapeTransform" in svg-sprite/lib/svg-sprite/config.js).
    svgSpriteConfig.shape = svgSpriteConfig.shape || {};
    svgSpriteConfig.shape.transform = svgSpriteConfig.shape.transform || ['svgo'];

    // Convert transform to array if it's an object. The SVGO plugin expects
    // an array; however, passing an object do not lead the process to fail.
    // But it is no more possible to add our custom transformation.
    // So even if there is an error on the provided configuration, we ensure
    // that the process can continue.
    if (typeof svgSpriteConfig.shape.transform !== 'object' || !Array.isArray(svgSpriteConfig.shape.transform)) {
      const transform = [];

      if (typeof svgSpriteConfig.shape.transform === 'object') {
        for (const key in svgSpriteConfig.shape.transform) {
          if (Object.hasOwnProperty.call(svgSpriteConfig.shape.transform, key)) {
            transform.push({
              [key]: svgSpriteConfig.shape.transform[key]
            });
          }
        }
      }
      else if (typeof svgSpriteConfig.shape.transform === 'string') {
        transform.push(svgSpriteConfig.shape.transform);
      }

      svgSpriteConfig.shape.transform = transform;
    }
  }

}
