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
import {merge, replace} from "lodash";
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

  public async populateEntries(drupalRoot: string, rootPath: string, sourceDir: string, options: any) {
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
        } else {
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
      let webpackConfig = config.config;

      webpackConfig.context = rootPath;

      // Parse the defined folders to populate the Webpack "entry" configuration.
      if (typeof config.entries !== "undefined") {
        for (const [sourceDir, options] of Object.entries(config.entries)) {
          const entries = await this.populateEntries(drupalRoot, rootPath, sourceDir, options);

          // Entries defined manually in webpackConfig.entry should take precedence.
          webpackConfig.entry = merge(entries, webpackConfig.entry);
        }
      }

      if (config.debug) {
        console.log(config.config);
      }

      if (typeof webpackConfig.mode === 'undefined') {
        webpackConfig.mode = config.debug ? 'development' : 'production';
      }

      return webpack(webpackConfig, (err, stats) => {
        if (err) {
          console.log('Webpack', err);
        }

        if (config.debug) {
          console.log(stats.toString());
        }
      });
    }

    return;
  }

}
