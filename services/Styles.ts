import {Configuration as ConfigurationDefinition} from "../types";
import {getThemeSassDefinitionFile} from "./drupalTheme";
// @ts-ignore
import * as sourcemaps from "gulp-sourcemaps";
import Configuration from "./Configuration";
// @ts-ignore
import * as prefix from "gulp-autoprefixer";
// @ts-ignore
import * as sassGlob from "gulp-sass-glob";
// @ts-ignore
import * as sass from "gulp-dart-sass";
import {merge} from "lodash";
// @ts-ignore
import * as ejs from "ejs";
import * as path from "path";
import * as YAML from "yaml";
import * as gulp from "gulp";
import * as del from "del";
import * as os from "os";
import * as fs from "fs";

export class Styles {

  /**
   * Gulp task; generate the styles.
   *
   * @return {Promise}
   */
  public async generate() {
    const config = await Configuration.get();
    await config.loopOverComponents(async (name: string, componentConfig: ConfigurationDefinition.Partial) => {
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
  public writeSassComments(key: string, item: any) {
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
  public variablesToSass(variables: any, options: any = {}, level: number = 0) {
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
  public writeVariables(item: any, title = '', level = 0) {
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
  public async createVariablesFromTheme(rootPath: string, config: ConfigurationDefinition.Scss) {
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
      const parsed: object = YAML.parse(fs.readFileSync(sassFile, 'utf8'), {merge: true});
      let itemRootType: string[] = [];

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
            item.dependencies.forEach((dependency: string) => {
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
  public async compile(rootPath: string, config: ConfigurationDefinition.Scss, fullConfig: ConfigurationDefinition.Partial) {
    if (config.enabled) {
      if (config.variablesPath) {
        const indexFilePath = path.resolve(rootPath, config.variablesPath, '../_index.scss');
        const indexFile = await fs.createWriteStream(indexFilePath);
        let content = fs.readFileSync('./templates/_index.scss.ejs', 'utf8');
        const indexContext = {
          iconsEnabled: fullConfig.icons?.enabled || false,
          baseThemeVariablesPath: '',
        };

        // @todo Support base theme.
//        if (config.baseTheme) {
//          const baseThemeVariablesPath = config.baseThemeVariablesPath || config.variablesPath;
//          const baseThemeVariablesFile = path.resolve(rootPath, config.baseTheme, baseThemeVariablesPath, '../_index.scss');
//
//          try {
//            fs.accessSync(baseThemeVariablesFile, fs.constants.R_OK);
//            indexContext.baseThemeVariablesPath = path.relative(path.resolve(indexFilePath, '..'), path.resolve(baseThemeVariablesFile, '..'));
//          }
//          catch (err) {
//            console.error(`The base theme file ${baseThemeVariablesFile} cannot be found.`);
//          }
//        }

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
  public async clean(rootPath: string, config: ConfigurationDefinition.Scss) {
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
