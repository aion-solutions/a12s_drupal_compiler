const sourcemaps = require("gulp-sourcemaps");
const { config: getConfig } = require("./../config/Configuration");
const sassGlob = require("gulp-sass-glob");
const sass = require("gulp-dart-sass");
const path = require("path");
const YAML = require("yaml");
const gulp = require("gulp");
const os = require("os");
const fs = require("fs");

module.exports = class Styles {

  /**
   * Gulp task; generate the styles.
   *
   * @return {Promise}
   */
  async generate() {
    const config = getConfig();

    if (config.scss.enabled) {
      await this.clean(config);
      await this.compile(config);
    }
  }

  /**
   * Write the sass comments.
   *
   * @return {string}
   */
  writeSassComments(key, item) {
    const comments = ['//', `// ${item.label || key}`, '//'];

    if (item.hasOwnProperty('description') && item.description) {
      comments.push(`// ${item.description}`, '//');
    }

    comments.push('', '');
    return comments.join(os.EOL);
  }

  /**
   * Create a sass variables.
   *
   * @return {string}
   */
  variablesToSass(variables, options = {}, level = 0) {
    const isArray = Array.isArray(variables);
    Object.assign(options, {prefix: '$', indent: '  '});
    const indent = options.indent.repeat(level);

    if (isArray && level === 0) {
      return '';
    }

    return Object.entries(variables).reduce((result, [key, value]) => {
      let string = level === 0 ? `${options.prefix}${key}: ` : (isArray ? '' : `"${key}": `);
      // @todo should we analyse the value to add quote around when it is pure text?
      string += typeof value === "object" ? '(' + os.EOL + this.variablesToSass(value, options, (level + 1)) + indent + ')' : value;
      return result + indent + string + (level === 0 ? ';' : ',') + os.EOL;
    }, '');
  }

  /**
   * Write the sass variables.
   *
   * @return {string}
   */
  writeVariables(item, title = '', level = 0) {
    let content = os.EOL + title;

    if (typeof item === "object" && item.hasOwnProperty('variables') && typeof item.variables === "object") {
      content += this.variablesToSass(item.variables);
    }

    if (level < 1) {
      for (const [key, entry] of Object.entries(item)) {
        if (['variables', 'types', 'label', 'dependencies'].includes(key)) {
          continue;
        }

        content += this.writeVariables(entry, this.writeSassComments(key, entry), (level + 1));
      }
    }

    return content;
  }

  /**
   * Generate the variables file.
   *
   * @param {Configuration} config - The configuration object.
   * @param {string} src - The path to the source directory.
   * @param {definitionFile: string, targetDir: string} definition - The definition object.
   */
  async createVariables(config, src, definition) {
    const definitionFile = path.resolve(src, definition.definitionFile);

    if (fs.existsSync(definitionFile)) {
      const targetDir = path.resolve(src, definition.targetDir);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Write parent index file.
      await config.writeFileFromTemplate(
        path.resolve(targetDir, '../_index.scss'),
        '_index.scss',
        {
          iconsEnabled: config.icons?.enabled || false,
        }
      );

      // Make sure the "_root.scss" file exist.
      const file = await fs.createWriteStream(path.resolve(targetDir, '_root.scss'));
      file.end();

      const indexFile = await fs.createWriteStream(path.resolve(targetDir, '_index.scss'));
      // @todo: create interface for parsed
      const parsed = YAML.parse(fs.readFileSync(definitionFile, 'utf8'), {merge: true});
      let itemRootType = [];

      for (const [name, item] of Object.entries(parsed)) {
        if (typeof item === "object" && item.hasOwnProperty('types')) {
          const file = await fs.createWriteStream(path.resolve(targetDir, `_${name}.scss`));
          file.write(this.writeSassComments(name, item))
          if (item.types.includes('group')) {
            indexFile.write(`@forward "${name}";` + os.EOL);
          }

          if (item.types.includes('root')) {
            itemRootType.push(name);
          }

          if (item.hasOwnProperty('dependencies') && Array.isArray(item.dependencies)) {
            item.dependencies.forEach((dependency) => {
              file.write(`@use "${dependency}";` + os.EOL);
            });
          }

          const content = this.writeVariables(item);
          file.write(content);
          file.end();
        }
      }

      indexFile.end();

      // Create a root file with components that have root type.
      config.writeFileFromTemplate(
        path.resolve(src, '_root.scss'),
        '_root.scss',
        {itemRootType: itemRootType}
      );
    }
  }

  /**
   * Compile Sass files.
   *
   * @param {Configuration} config - The configuration object.
   *
   * @returns {Promise}
   */
  async compile(config) {
    if (config.scss.enabled) {
      const autoprefixer = (await import('gulp-autoprefixer')).default;

      const compileTasks = config.scss.dirs.map(async (dir) => {
        // Fix the source path with the root path.
        const src = path.resolve(config.rootDir, config.sourcesDir, dir.source);
        // If dest is null then the destination path is that of the source.
        const dest = path.resolve(config.rootDir, config.sourcesDir, dir.dest || dir.source);

        if (dir.variables) {
          await this.createVariables(config, src, dir.variables);
        }

        return gulp
          .src(src + '/**/*.scss')
          .pipe(sassGlob())
          .pipe(sourcemaps.init({
            debug: config.getOption('debug'),
          }))
          .pipe(sass({
            outputStyle: config.scss.outputStyle,
            sourceComments: config.scss.sourceComments,
            includePaths: config.scss.includePaths,
            silenceDeprecations: ["legacy-js-api",/* "global-builtin","color-functions",*/ "if-function"],
          }))

          // The sass pipe for version 2.0 when ready for gulp.
          //.pipe(
          //  sass.pipe(sass.compile({
          //    outputStyle: config.scss.outputStyle,
          //    sourceComments: config.scss.sourceComments,
          //    includePaths: config.scss.includePaths,
          //  }), { errorHandler: sass.logError }))

          .pipe(autoprefixer(config.scss.autoPrefixerBrowsers, { cascade: true }))
          .pipe(await sourcemaps.write((config.scss.sourceMapEmbed) ? null : './'))
          .pipe(gulp.dest(dest))
        ;
      });

      return await Promise.all(compileTasks);
    }

    return;
  }

  /**
   * Cleaning up generated files automatically
   *
   * @param {Configuration} config
   *   The configuration object.
   */
  async clean(config) {
    const { deleteAsync } = await import('del');

    config.scss.dirs.forEach(async (dir) => {
      // If destination is null then the destination path is that of the source.
      const dest = dir.dest || dir.source;
      const pattern = dir.cleanPattern || config.scss.defaultCleanPattern;

      await deleteAsync(path.resolve(config.rootDir, dest) + pattern, {force: true})

      if (dir.variables) {
        await deleteAsync(path.resolve(config.rootDir, dest, dir.variables.targetDir), '../_index.scss', {force: true})
      }
    })

    //await deleteAsync(path.resolve(config.rootDir, '/components') + pattern, {force: true})
  }

}
