import {Configuration as ConfigurationDefinition} from "../types";
import {getModuleOrThemeName} from "./drupalTheme";
// @ts-ignore
import * as sourcemaps from "gulp-sourcemaps";
// @ts-ignore
import * as prefix from "gulp-autoprefixer";
import Configuration from "./Configuration";
// @ts-ignore
import * as sassGlob from "gulp-sass-glob";
// @ts-ignore
import * as sass from "gulp-dart-sass";
import {clone, merge, replace} from "lodash";
import * as webpack from 'webpack';
import * as path from "path";
import {glob} from "glob";

export class Webpack {

  /**
   * Gulp task; generate the styles.
   *
   * @return {Promise}
   */
  public async generate() {
    const config = await Configuration.get();

    await config.loopOverComponents(async (name: string, { drupalRoot, webpack, componentPath }: ConfigurationDefinition.Partial) => {
      if (webpack !== undefined && webpack.enabled) {
        await this.scripts(drupalRoot, componentPath, webpack);
      }
    });
  }

  public async populateEntries(drupalRoot: string, rootPath: string, sourceDir: string, options: any): Promise<{[key: string]: string}> {
    const sourcePath = path.resolve(rootPath, sourceDir);
    const pattern = options.pattern || '**/*.{es6.js,ts}';
    const entries = {};
    let moduleOrThemeName = await getModuleOrThemeName(rootPath) || 'my-theme';

    glob.sync(sourcePath + '/' + pattern).forEach((jsFile) => {
      if (!jsFile.match(/\.(d|module)\.ts$/)) {
        let filename = replace(options.filename || '[name]', '[name]', path.basename(jsFile));
        // @ts-ignore
        filename = replace(filename, '[moduleOrThemeName]', moduleOrThemeName);
        filename = replace(filename, /\.(es6\.js|ts)$/, '.js');

        if (sourceDir === options.destination) {
          // @ts-ignore
          entries[replace(path.relative(drupalRoot, path.resolve(sourcePath, jsFile)), /\.(es6\.js|ts)$/, '.js')] = './' + path.relative(rootPath, path.resolve(sourcePath, jsFile));
        }
        else {
          options.destination = path.resolve(rootPath, options.destination);
          // @ts-ignore
          entries[path.relative(drupalRoot, options.destination + '/' + filename)] = './' + path.relative(rootPath, path.resolve(sourcePath, jsFile));
        }
      }
    });

    return Promise.resolve(entries);
  }

  public async scripts(drupalRoot: string, rootPath: string, config: ConfigurationDefinition.Webpack) {
    if (config.enabled) {
      const webpackConfig: webpack.Configuration[] = [];

      // Parse the defined folders to populate the Webpack "entry" configuration.
      if (typeof config.entries !== "undefined") {
        for (const [sourceDir, options] of Object.entries(config.entries)) {
          const currentConfig = clone(config.config);
          currentConfig.context = rootPath;

          if ("library" in options) {
            // Ensure library is an array, so we can concat it further with the
            // JS file name.
            // @todo Avoid this and concat only if the options.library is an
            //    array?
            if (typeof options.library === "string") {
              currentConfig.output.library = [options.library];
            }
            else if (Array.isArray(options.library)) {
              currentConfig.output.library = options.library;
            }
            else {
              delete options.library;
            }

            if ("library" in options) {
              currentConfig.output.libraryTarget = "libraryTarget" in options && typeof options.libraryTarget === "string" ? options.libraryTarget : "umd";
              currentConfig.output.libraryExport = "libraryExport" in options && typeof options.libraryExport === "string" ? options.libraryExport : "default";
            }
          }

          if (typeof config.config.mode === "undefined") {
            currentConfig.mode = config.debug ? "development" : "production";
          }

          const entries = await this.populateEntries(drupalRoot, rootPath, sourceDir, options);

          if (!("library" in options)) {
            currentConfig.entry = entries;
            webpackConfig.push(currentConfig);
          }
          else {
            Object.entries(entries).forEach(([target, jsFile]) => {
              const libraryConfig = clone(currentConfig);

              if (Array.isArray(libraryConfig.output.library)) {
                const filename = replace(path.basename(jsFile), /\.(es6\.js|ts)$/, '');
                libraryConfig.output.library = libraryConfig.output.library.concat([filename]);
              }

              libraryConfig.entry = {};
              libraryConfig.entry[target] = jsFile;
              webpackConfig.push(libraryConfig);
            });
          }
        }
      }

      if (config.debug) {
        console.log(webpackConfig);
      }

      return webpack(webpackConfig, (err, multiStats: webpack.MultiStats) => {
        multiStats.stats.forEach(stats => {
          if (stats.compilation.errors.length) {
            console.log('Webpack', stats.compilation.errors);
          }

          if (config.debug) {
            console.log(stats.toString());
          }
        });
      });
    }

    return;
  }

}
