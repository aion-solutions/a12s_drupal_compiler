const gulp = require('gulp');
const svgSprite = require('gulp-svg-sprite');
const { config: getConfig } = require("./../config/Configuration");
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

      if (typeof svgSpriteConfig.mode === 'object') {
        for (const [key, modeConfig] of Object.entries(svgSpriteConfig.mode)) {
          svgIconsBuilder.checkMode(key, modeConfig);
        }
      }

      svgSpriteConfig.shape.transform.push({icons: (shape, SVGSpriterConfig, callback) => {
        svgIconsBuilder.addIcon(shape);
        callback(null, shape);
      }});

      // Add some extra variables for the "mustache" template used by svg-sprite.
      // @see https://github.com/svg-sprite/svg-sprite/blob/main/docs/templating.md#sprite--shape-variables
      svgSpriteConfig.variables = svgSpriteConfig.variables || {};

      // @todo find a way to use dynamic variable name in mustache.
      //   Unfortunately, {{this[mode].cssBaseClass}} or similar approaches do
      //   not work. So we can only handle one icon sprite at a time.
      if (svgIconsBuilder.modes.size > 0) {
        const [key, iconsConfig] = svgIconsBuilder.modes.entries().next().value;
        svgSpriteConfig.variables.icons = {key, ...iconsConfig};
      }

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

class SvgIcon {

  /**
   * @param {SVGShape} shape SVG shape object
   * @param {SVGSpriterConfig} spriterConfig
   */
  constructor(shape) {
    this.shape = shape;
  }

  get id() {
    return this.shape.id;
  }

  get width() {
    return this.shape.width;
  }

  get height() {
    return this.shape.height;
  }

  get data() {
    const viewBox = this.shape.getViewbox();
    const { width, height } = this.shape.getDimensions();
    const { top, right, bottom, left } = this.shape.config.spacing.padding;
    return {
      name: this.shape.id,
      base: this.shape.base,
      master: this.shape.master ? this.shape.master.id : null,
      viewBox: viewBox,
      width: {
        inner: width - right - left,
        outer: width
      },
      height: {
        inner: height - top - bottom,
        outer: height
      }
    };
  }

}

class SvgIconsBuilder {

  /**
   * @type {Map<string, SvgIcon>}
   */
  icons;

  /**
   * @type {Map<string, object>}
   */
  modes;

  constructor(rootDir, sourcesDir, dest, svgSpriteConfig, verbose = false) {
    this.rootDir = rootDir;
    this.sourcesDir = sourcesDir;
    this.dest = dest;
    this.svgSpriteDest = svgSpriteConfig.dest;
    this.verbose = verbose;
    this.icons = new Map();
    this.modes = new Map();
  }

  addIcon(shape) {
    this.icons.set(shape.id, new SvgIcon(shape));
  }

  checkMode(key, modeConfig) {
    // @todo use mode to define the default mustache template for building the
    //   example file.
    //let mode = modeConfig.mode || key;

    if ('icons' in modeConfig) {
      if ((modeConfig.mode || key) !== 'stack') {
        throw new Error(`Invalid mode "${modeConfig.mode || key}" for SVG Icon Builder. Only "stack" mode is currently supported.`);
      }

      if (modeConfig.icons === true) {
        modeConfig.icons = {};
      }

      if (typeof modeConfig.icons === 'object') {
        try {
          const iconsConfig = this.buildConfig(key, modeConfig);
          this.modes.set(key, iconsConfig);
        }
        catch (error) {
          if (this.verbose) {
            console.error('Error building SVG Icon Builder configuration:', error);
          }
        }
      }
    }
  }

  /**
   * Build the SVG Icon Builder configuration.
   *
   * @param {string} key
   * @param {object} modeConfig
   */
  buildConfig(key, modeConfig) {
    const replacements = new Map([
      ['%rootDir%', this.rootDir || ''],
      ['%sourceDir%', this.sourcesDir || ''],
      ['%destDir%', path.resolve((this.dest || ''), modeConfig.dest || modeConfig.mode || key)],
      ['%mode%', modeConfig.mode || key],
      ['%modeId%', key],
    ]);

    const iconsConfig = {
      ...this.getConfigDefaults(key, modeConfig),
      ...modeConfig.icons,
      mode: modeConfig.mode || key,
      dest: path.resolve(this.dest, modeConfig.dest || modeConfig.mode || key),
      bust: modeConfig.bust || false,
      sprite: modeConfig.sprite || 'sprite.svg',
    };

    // Ensure consistency.
    iconsConfig.includeRootInMainFile = iconsConfig.includeRootInMainFile && iconsConfig.useRootVariables;

    // Process file paths.
    ['scssSettingsfile', 'scssRootfile', 'scssIconsfile'].forEach(fileKey => {
      if (typeof iconsConfig[fileKey] === 'string') {
        const filePath = this.replacePatterns(iconsConfig[fileKey], replacements);
        iconsConfig[fileKey] = path.resolve(filePath);
      }
      else {
        throw new Error(`Missing configuration for ${fileKey}: must be a string`);
      }
    });

    // Define some relative paths to help linking SCSS files altogether.
    const sccsIconsDir = path.dirname(iconsConfig.scssIconsfile);
    const spriteRelativePath = path.relative(sccsIconsDir, iconsConfig.dest);

    iconsConfig.spriteRelativePath = spriteRelativePath.length ? spriteRelativePath + '/' : './';
    iconsConfig.settingsRelativePath = path.relative(sccsIconsDir, iconsConfig.scssSettingsfile);

    // Define the module namespace for SCSS @use.
    const settingsExt = path.extname(iconsConfig.scssSettingsfile);
    iconsConfig.settingsBasename = path.basename(iconsConfig.scssSettingsfile, settingsExt).replace(/^_/, '');

    iconsConfig.rootRelativePath = path.relative(sccsIconsDir, iconsConfig.scssRootfile);

    // Process prefix replacements.
    iconsConfig.prefix = this.replacePatterns(iconsConfig.prefix, replacements);
    iconsConfig.cssBaseClass = this.replacePatterns(iconsConfig.cssBaseClass, replacements);

    if (this.verbose) {
      console.log('Icon configuration: ', iconsConfig);
    }

    return iconsConfig;
  }

  /**
   * Get the default configuration for the SVG icons.
   *
   * @param {string} key
   * @param {object} modeConfig
   * @return {{dest: string, bust, sprite, prefix: string, scssSettingsfile: string, scssRootfile: string, scssIconsfile: string, useRootVariables: boolean, defineDimensionsInRootVariables: boolean}}
   */
  getConfigDefaults(key, modeConfig) {
    return {
      bust: modeConfig.bust || false,
      sprite: modeConfig.sprite || 'sprite.svg',
      prefix: '%mode%-icons',
      scssSettingsfile:  '%destDir%/_%mode%-icons.variables.scss',
      scssRootfile: '%destDir%/_%mode%-icons.root.scss',
      scssIconsfile: '%destDir%/%mode%-icons.scss',
      useRootVariables: true,
      defineDimensionsInRootVariables: false,
      includeRootInMainFile: true,
      defineDimensionsInClasses: true,
      cssBaseClass: '%mode%-icon',
    };
  }

  /**
   * Replace patterns in a string.
   *
   * @param {string} string
   * @param {Map<string, string>} patterns
   */
  replacePatterns(string, patterns) {
    patterns.forEach((value, key) => {
      const regex = new RegExp(key, 'g');
      string = string.replace(regex, value);
    });

    return string;
  }

  /**
   * Generate the Sass file for icons.
   *
   * @param {object} iconsConfig
   */
  generateIconsScss() {
    const config = getConfig();
    const icons = this.icons;

    if (!icons) {
      if (this.verbose) {
        console.error('No icons found for SVG sprite generation.');
      }
      return;
    }

    for (const [key, iconsConfig] of this.modes.entries()) {
      let spriteFileName = iconsConfig.sprite;

      if (iconsConfig.bust && fs.existsSync(iconsConfig.dest)) {
        // If bust is true, a random string was added before the extension; we
        // need to find the actual file since the name is dynamic.
        const ext = path.extname(spriteFileName);
        const baseName = path.basename(spriteFileName, ext);
        // Create regex to match: baseName-[hex chars].extension
        const spriteRegex = new RegExp(`^${baseName}-[a-f0-9]+${ext.replace('.', '\\.')}$`);

        // Read the destination directory to find the file matching the pattern
        const files = fs.readdirSync(iconsConfig.dest);
        const spriteFile = files.find(file => spriteRegex.test(file));

        spriteFileName = spriteFile || iconsConfig.sprite;
      }

      if (this.verbose) {
        console.log(`Sprite file for ${key}: ${spriteFileName}`);
      }

      let spritePath = path.resolve(iconsConfig.dest, spriteFileName);
      spritePath = path.relative(path.dirname(iconsConfig.scssIconsfile), spritePath);

      const context = {...iconsConfig, spriteFileName, icons, spritePath};

      config.writeFileFromTemplate(iconsConfig.scssSettingsfile, 'icons/_settings.scss', {
        ...context,
        // The prefix is mandatory for the Sass variables, so we force a default value.
        prefix: iconsConfig.prefix || key + '-icons',
      });

      if (iconsConfig.useRootVariables) {
        config.writeFileFromTemplate(iconsConfig.scssRootfile, 'icons/_root.scss', context);
      }

      config.writeFileFromTemplate(iconsConfig.scssIconsfile, `icons/${iconsConfig.mode}-icons.scss`, context);
    }
  }

}

