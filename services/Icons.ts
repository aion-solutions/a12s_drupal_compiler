// @ts-ignore
import * as iconfont from "gulp-iconfont";
import * as gulp from "gulp";
import * as path from "path";
import * as _ from "lodash";
// @ts-ignore
import * as ejs from "ejs";
import * as del from 'del';
import * as fs from "fs";
import Configuration from "./Configuration";
import {PathLike} from "fs";
import {Configuration as ConfigurationDefinition} from "../types";
import { Stream } from 'stream';

export class Icons {

  readonly runTimestamp = Math.round(Date.now() / 1000);

  /**
   * Gulp task; generate icon font.
   *
   * @return {Promise}
   */
  public async generate(): Promise<any> {
    const config = await Configuration.get();

    await config.loopOverComponents(async (name: string, { icons, componentPath }: ConfigurationDefinition.Partial) => {
      if (icons !== undefined && icons.enabled) {
        const iconName = icons.iconName || 'icons';
        await this.clean(componentPath, iconName, icons);
        await this.create(componentPath, iconName, icons);
      }
    });
  }

  /**
   * Create the icon font.
   *
   * @return {Promise}
   */
  public async create(rootPath: string, iconName: string, config: ConfigurationDefinition.Icons): Promise<any> {
    if (config.enabled && config.src) {
      const src = path.resolve(rootPath, config.src);

      // noinspection SpellCheckingInspection
      const stream = gulp.src(src).pipe(iconfont({
          fontName: iconName,
          appendUniconde: true,
          formats: config.formats,
          timestamp: config.useTimestamp ? this.runTimestamp : 0,
          autohint: config.autohint,
          normalize: config.normalize
        }));

      if (config.templates.enabled) {
        const srcFile = config.templates.css.src;
        const destDir = path.resolve(rootPath, config.templates.css.dest);

        if (!fs.existsSync(srcFile)) {
          console.error(`The source directory ${srcFile} does not exist.`);
          return;
        }

        if (!fs.existsSync(destDir)) {
          console.error(`The target directory ${destDir} does not exist.`);
          return;
        }

        await this.writeGlyphs(stream, srcFile, destDir, {
          fontName: iconName,
          fontPath: config.fontPathPrefix,
          classNamePrefix: config.classNamePrefix,
        });
      }

      const dest = path.resolve(rootPath, config.dest);
      return stream.pipe(gulp.dest(dest));
    }

    return;
  }

  protected async writeGlyphs(stream: Stream, srcFile: string, destDir: string, settings: any) {
    return new Promise((resolve, reject) => {
      stream.on('glyphs', (glyphs: any) => {
        const iconData = _.merge({}, settings, {
          glyphs: glyphs.map((glyph: any) => ({
            name: glyph.name,
            content: glyph.unicode[0].toString(16).toUpperCase(),
          })),
        });

        const srcFileContents = fs.readFileSync(srcFile, 'utf8');

        if (!srcFileContents) {
          resolve(`The template ${srcFile} for icon settings was not found or is empty.`);
          return;
        }

        const result = ejs.render(srcFileContents, iconData);
        const destFile = path.join(destDir, path.basename(srcFile.replace('.ejs', '')));

        fs.writeFileSync(destFile, result);
        resolve(`Icons settings written to file ${destFile}.`);
      });
    })
  }

  /**
   * Clean the old files.
   *
   * @return {Promise}
   */
  public async clean(rootPath: string, iconName: string, config: ConfigurationDefinition.Icons): Promise<any> {
    const dest = path.resolve(rootPath, config.dest);
    const toClean = [path.join(dest, `${iconName}.*`)];

    if (config.templates.enabled) {
      const srcFile = config.templates.css.src;
      const destDir = path.resolve(rootPath, config.templates.css.dest);
      const cssTemplateFilename: PathLike = _.last(srcFile.split('/'));

      if (fs.existsSync(cssTemplateFilename)) {
        toClean.push(`${destDir}${cssTemplateFilename}`);
      }
    }

    await del(toClean, { force: true });
  }
}
