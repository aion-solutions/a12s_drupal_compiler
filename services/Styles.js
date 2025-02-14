const { getThemeSassDefinitionFile } = require("./drupalTheme");
const sourcemaps = require("gulp-sourcemaps");
const Configuration = require("./Configuration");
const prefix = require("gulp-autoprefixer");
const sassGlob = require("gulp-sass-glob");
const sass = require("gulp-dart-sass");
const { merge } = require("lodash");
const ejs = require("ejs");
const path = require("path");
const YAML = require("yaml");
const gulp = require("gulp");
const del = require("del");
const os = require("os");
const fs = require("fs");

class Styles {

  /**
   * Gulp task; generate the styles.
   *
   * @return {Promise}
   */
  async generate() {
    const config = await Configuration.get();
    await config.loopOverComponents(async (name, componentConfig) => {
      if (componentConfig.scss !== undefined && componentConfig.scss.enabled) {
        await this.clean(componentConfig.componentPath, componentConfig.scss);
        await this.compile(componentConfig.componentPath, componentConfig.scss, componentConfig);
      }
    });

    return;
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
    options = merge(options, {prefix: '$', indent: '  '});
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
   * Generate the variable of the theme.
   *
   * @return {Promise<void>}
   */
  async createVariablesFromTheme(rootPath, config) {
    const sassFile = await getThemeSassDefinitionFile(rootPath);
    const destinationDir = path.resolve(rootPath, config.variablesPath);

    // Make sure the "_root.scss" file exist.
    const file = await fs.createWriteStream(path.resolve(destinationDir, '_root.scss'));
    file.end();

    if (sassFile) {
      if (!fs.existsSync(destinationDir)){
        fs.mkdirSync(destinationDir, { recursive: true });
      }

      const indexFile = await fs.createWriteStream(path.resolve(destinationDir, '_index.scss'));
      // @todo: create interface for parsed
      const parsed = YAML.parse(fs.readFileSync(sassFile, 'utf8'), {merge: true});
      let itemRootType = [];

      for (const [name, item] of Object.entries(parsed)) {
        if (typeof item === "object" && item.hasOwnProperty('types')) {
          const file = await fs.createWriteStream(path.resolve(destinationDir, `_${name}.scss`));
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
      const rootFile = await fs.createWriteStream(path.resolve(rootPath, config.scssPath, '_root.scss'));
      let content = fs.readFileSync('./templates/_root.default.scss.ejs', 'utf8');

      rootFile.write(ejs.render(content, {itemRootType: itemRootType}));
      rootFile.end();
    }

    return;
  }

  /**
   * Compile Sass files
   *
   * @returns {Promise}
   */
  async compile(rootPath, config, fullConfig) {
    if (config.enabled) {
      if (config.variablesPath) {
        const indexFilePath = path.resolve(rootPath, config.variablesPath, '../_index.scss');
        const indexFile = await fs.createWriteStream(indexFilePath);
        let content = fs.readFileSync('./templates/_index.scss.ejs', 'utf8');
        const indexContext = {
          iconsEnabled: fullConfig.icons?.enabled || false,
        };

        indexFile.write(ejs.render(content, indexContext));
        indexFile.end();

        await this.createVariablesFromTheme(rootPath, config);
      }

      // Fix the source path with the root path.
      config.src.forEach((src, k) => {
        config.src[k] = path.resolve(rootPath, src);
      })

      return await gulp
        .src(config.src)
        .pipe(sassGlob())
        .pipe(sourcemaps.init({
          debug: config.debug,
        }))
        .pipe(sass({
          outputStyle: config.outputStyle,
          sourceComments: config.sourceComments,
          includePaths: config.includePaths,
        }))
        .pipe(prefix(config.autoPrefixerBrowsers, { cascade: true }))
        .pipe(await sourcemaps.write((config.sourceMapEmbed) ? null : './'))
        //.pipe(await gulp.dest((file) => {
        .pipe(gulp.dest((file) => {
          const rootFolder = path.resolve(rootPath, file.base);
          let dest = '';

          // If config.dest is null then the destination path is that of the source.
          if (config.dest === null) {
            for (let currentPath of config.src) {
              if (currentPath.match(rootFolder.replace(rootPath, ''))) {
                dest = path.resolve(rootPath, currentPath.match('^(.*?)\\/\\*\\*\\/\\*\\.scss')[1]);
              }
            }
          }
          else {
            dest = path.resolve(rootPath, config.dest)
          }

          return rootFolder.match('[a-z A-Z]+\/[a-z A-Z]+$') !== null && rootFolder.match('[a-z A-Z]+\/[a-z A-Z]+$')[0] === 'templates/patterns' ? rootFolder : path.resolve(rootPath, dest);
        }))
    }

    return;
  }

  /**
   * Cleaning up generated files automatically
   *
   * @returns {Promise<void>}
   */
  async clean(rootPath, config) {
    const pattern = '/**/*.{css,css.map}';

    // If config.dest is null then the destination path is that of the source.
    if (config.dest === null) {
      for (let currentPath of config.src) {
        await del(path.resolve(rootPath, currentPath.match('^(.*?)\\/\\*\\*\\/\\*\\.scss')[1] + pattern), {force: true})
      }
    }
    else {
      await del(path.resolve(rootPath, config.dest) + pattern, {force: true})
    }

    if (config.variablesPath) {
      await del(path.resolve(rootPath, config.variablesPath, '../_index.scss'), {force: true})
    }

    await del(path.resolve(rootPath, '/components') + pattern, {force: true})

    return;
  }

}
