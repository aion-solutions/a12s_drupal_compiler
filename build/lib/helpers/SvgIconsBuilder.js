const fs = require('fs');
const path = require('path');
const { config: getConfig } = require("./../config/Configuration");
const gulp = require("gulp");
const svgSprite = require("gulp-svg-sprite");

class SvgIconsBuilder {

  /**
   * @type {Map<string, SvgIcon>}
   */
  icons;

  /**
   * @type {Map<string, object>}
   */
  modes;

  /**
   * @type {{ height: string, width: string}|null}
   */
  dimensions = null;

  constructor(rootDir, sourcesDir, dest, svgSpriteConfig, verbose = false) {
    this.rootDir = rootDir;
    this.sourcesDir = sourcesDir;
    this.dest = dest;
    this.svgSpriteDest = svgSpriteConfig.dest;
    this.verbose = verbose;
    this.icons = new Map();
    this.modes = new Map();

    if (svgSpriteConfig.shape?.spacing?.box === 'icon') {
      const height = svgSpriteConfig.shape?.dimension?.maxHeight;
      const width = svgSpriteConfig.shape?.dimension?.maxWidth;
      this.dimensions = this.normalizeDimensions(height, width);
    }

    svgSpriteConfig.shape.transform.push({icons: (shape, SVGSpriterConfig, callback) => {
      this.addIcon(shape);
      callback(null, shape);
    }});

    if (typeof svgSpriteConfig.mode === 'object') {
      for (const [key, modeConfig] of Object.entries(svgSpriteConfig.mode)) {
        this.checkMode(key, modeConfig);
      }
    }

    // Add some extra variables for the "mustache" template used by svg-sprite.
    // @see https://github.com/svg-sprite/svg-sprite/blob/main/docs/templating.md#sprite--shape-variables
    svgSpriteConfig.variables = svgSpriteConfig.variables || {};

    // @todo find a way to use dynamic variable name in mustache.
    //   Unfortunately, {{this[mode].cssBaseClass}} or similar approaches do
    //   not work. So we can only handle one icon sprite at a time.
    if (this.modes.size > 0) {
      const [key, iconsConfig] = this.modes.entries().next().value;
      svgSpriteConfig.variables.icons = {key, ...iconsConfig};
    }
  }

  addIcon(shape) {
    this.icons.set(shape.id, new SvgIcon(shape));
  }

  checkMode(key, modeConfig) {
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
    iconsConfig.defineDimensionsInRootVariables = iconsConfig.defineDimensionsInRootVariables && iconsConfig.useRootVariables;

    if (iconsConfig.dimensions !== false) {
      if (iconsConfig.dimensions !== null && typeof iconsConfig.dimensions === 'object' && (iconsConfig.dimensions.hasOwnProperty('height') || iconsConfig.dimensions.hasOwnProperty('width'))) {
        const { height = '', width = '' } = iconsConfig.dimensions;
        iconsConfig.dimensions = this.normalizeDimensions(height, width)
      }

      if (!iconsConfig.dimensions && this.dimensions) {
        iconsConfig.dimensions = this.dimensions;
      }
    }

    // Process file paths.
    ['scssSettingsfile', 'scssRootfile', 'scssMixinsfile', 'scssIconsfile'].forEach(fileKey => {
      if (typeof iconsConfig[fileKey] === 'string') {
        const filePath = this.replacePatterns(iconsConfig[fileKey], replacements);
        iconsConfig[fileKey] = path.resolve(filePath);
      }
      else {
        throw new Error(`Missing configuration for ${fileKey}: must be a string`);
      }
    });

    // Define some relative paths to help linking SCSS files altogether.
    const spriteRelativePath = path.relative(path.dirname(iconsConfig.scssIconsfile), iconsConfig.dest);

    iconsConfig.relativePaths = {
      root: {
        toSpriteDir: spriteRelativePath.length ? spriteRelativePath + '/' : './',
      },
      mixins: {
        toSettings: this.scssRelativePath(iconsConfig.scssMixinsfile, iconsConfig.scssSettingsfile),
      },
      icons: {
        toMixins: this.scssRelativePath(iconsConfig.scssIconsfile, iconsConfig.scssMixinsfile),
        toSettings: this.scssRelativePath(iconsConfig.scssIconsfile, iconsConfig.scssSettingsfile),
        toRoot: this.scssRelativePath(iconsConfig.scssIconsfile, iconsConfig.scssRootfile),
      },
    };

    // Define the module namespaces for SCSS @use.
    iconsConfig.modules = {
      settings: path.basename(iconsConfig.scssSettingsfile, path.extname(iconsConfig.scssSettingsfile)).replace(/^_/, ''),
      mixins: path.basename(iconsConfig.scssMixinsfile, path.extname(iconsConfig.scssMixinsfile)).replace(/^_/, ''),
    };

    // Process prefix replacements.
    iconsConfig.prefix = this.replacePatterns(iconsConfig.prefix, replacements);
    iconsConfig.cssBaseClass = this.replacePatterns(iconsConfig.cssBaseClass, replacements);

    // Fill default values according to svg-sprite documentation.
    // @see https://github.com/svg-sprite/svg-sprite/blob/main/docs/configuration.md#common-mode-properties
    if (iconsConfig.example === true) {
      iconsConfig.example = {
        template: `${iconsConfig.mode}/sprite.html`, // Not really necessary for us at the moment.
        dest: `sprite.${iconsConfig.mode}.html`,
      }
    }

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
   * @return {object}
   */
  getConfigDefaults(key, modeConfig) {
    return {
      bust: modeConfig.bust || false,
      bustInQueryString: true,
      sprite: modeConfig.sprite || 'sprite.svg',
      prefix: '%mode%-icons',
      example: modeConfig.example || false,
      scssSettingsfile:  '%destDir%/_%mode%-icons.variables.scss',
      scssRootfile: '%destDir%/_%mode%-icons.root.scss',
      scssMixinsfile: '%destDir%/_%mode%-icons.mixins.scss',
      scssIconsfile: '%destDir%/%mode%-icons.scss',
      useRootVariables: true,
      dimensions: null,
      defineDimensionsInRootVariables: false,
      includeRootInMainFile: true,
      defineDimensionsInClasses: true,
      cssBaseClass: '%mode%-icon',
    };
  }

  /**
   * Converts a mixed value to a string containing a number and a unit.
   *
   * @param {*} mixed
   * @returns Normalized string (e.g., "100px", "50.5em") or null if invalid
   */
  checkDimensionValue(mixed, unitDefault = 'px') {
    if (mixed === null || mixed === undefined) {
      return null;
    }

    let unit = unitDefault;
    let value;

    if (typeof mixed === 'number') {
      value = mixed;
    }
    else if (typeof mixed === 'string') {
      const trimmed = mixed.trim();
      if (!trimmed) {
        return null;
      }

      // Check for special "auto" value.
      if (trimmed === 'auto') {
        return trimmed;
      }

      // Extract number and unit using regex
      const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
      if (!match) {
        return null;
      }

      value = parseFloat(match[1]);
      unit = match[2] || unitDefault;
    }
    else {
      return null;
    }

    // Validate value is greater than 0
    if (!isFinite(value) || value <= 0) {
      return null;
    }

    // Format the number (remove unnecessary decimals)
    const formattedValue = Number.isInteger(value) ? value.toString() : value.toString();
    return `${formattedValue}${unit}`;
  }

  /**
   * Normalize the dimensions.
   * @param {*} height
   * @param {*} width
   * @return {{height: string, width: string}|null}
   */
  normalizeDimensions(height, width) {
    height = this.checkDimensionValue(height);
    width = this.checkDimensionValue(width);

    if (height && width) {
      return {height, width};
    }
    else if (height) {
      return {height, width: 'auto'}
    }
    else if (width) {
      return {height: 'auto', width}
    }

    return null;
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
   * Get the relative path from a SASS module to another, ready for inclusion.
   * @param {string} from
   * @param {string} to
   * @return {string}
   */
  scssRelativePath(from, to) {
    // Remove extension and use lookahead to match the starting underscore in
    // the last part of the path.
    return path.relative(path.dirname(from), to).replace(/\.scss$/g, '').replace(/(^|\/)_(?!.*(^|\/)_)/, '$1');
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
      let spriteHash;

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

        // Alters the generated sprite name as we need to keep a consistent file
        // name; the way svg-prite uses to add the bust hash to the sprite file
        // name cannot work when its URL is used in user content.
        if (iconsConfig.bustInQueryString && spriteFile) {
          // Extract the hash part from the filename.
          const hashMatch = spriteFile.match(new RegExp(`^${baseName}-([a-f0-9]+)${ext.replace('.', '\\.')}$`));
          spriteHash = hashMatch ? hashMatch[1] : '';
          // Rename the file to its original name without the hash.
          fs.renameSync(path.join(iconsConfig.dest, spriteFile), path.join(iconsConfig.dest, spriteFileName));
          spriteFileName += '?' + spriteHash;

          // Replace the sprite name in the generated example file if applicable.
          if (iconsConfig.example?.dest) {
            const exampleFile = path.join(iconsConfig.dest, iconsConfig.example.dest);

            if (fs.existsSync(exampleFile)) {
              const exampleFileContent = fs.readFileSync(exampleFile, 'utf8');
              const updatedContent = exampleFileContent.replace(new RegExp(spriteFile.replace('.', '\\.'), 'g'), spriteFileName);
              fs.writeFileSync(exampleFile, updatedContent, 'utf8');
            }
          }
        }
        else {
          spriteFileName = spriteFile || iconsConfig.sprite;
        }
      }

      if (this.verbose) {
        console.log(`Sprite file for ${key}: ${spriteFileName}`);
      }

      let spritePath = path.resolve(iconsConfig.dest, spriteFileName);
      spritePath = path.relative(path.dirname(iconsConfig.scssIconsfile), spritePath);

      const context = {...iconsConfig, spriteFileName, icons, spritePath, dimensions: this.dimensions};

      config.writeFileFromTemplate(iconsConfig.scssSettingsfile, `icons/${iconsConfig.mode}/_settings.scss`, {
        ...context,
        // The prefix is mandatory for the Sass variables, so we force a default value.
        prefix: iconsConfig.prefix || key + '-icons',
      });

      if (iconsConfig.useRootVariables) {
        config.writeFileFromTemplate(iconsConfig.scssRootfile, `icons/${iconsConfig.mode}/_root.scss`, context);
      }

      config.writeFileFromTemplate(iconsConfig.scssMixinsfile, `icons/${iconsConfig.mode}/_mixins.scss`, context);
      config.writeFileFromTemplate(iconsConfig.scssIconsfile, `icons/${iconsConfig.mode}/icons.scss`, context);
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

module.exports = {
  SvgIcon,
  SvgIconsBuilder,
};
