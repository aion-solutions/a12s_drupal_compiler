import Configuration from "./services/Configuration";
import {Webpack} from "./services/Webpack";
import {Styles} from "./services/Styles";
import {Icons} from "./services/Icons";
import * as gulp from "gulp";
// @ts-ignore
//import * as watch from "gulp-watch";
import {Command} from "commander";
import {Configuration as ConfigurationDefinition} from "./types";
import * as path from "path";

const icons = new Icons();
const styles = new Styles();
const webpack = new Webpack();

const program = new Command();
program
  .allowUnknownOption()
  .option("-p, --paths [PATH...]", "The paths to process", [])
  .option("-t, --types [TYPES...]", "The tasks to process, for example 'js', 'css', 'icons'", ['js', 'css', 'icons']);
program.parse();

gulp.task('parse-configuration', Configuration.get);
gulp.task('icons-generate', icons.generate.bind(icons));
gulp.task('styles-generate', styles.generate.bind(styles));
gulp.task('webpack-generate', webpack.generate.bind(webpack));

const types = program.getOptionValue("types");
const buildSeriesArgs: any[] = ['parse-configuration'];
const buildParallelArgs = [];

if (types.includes('icons')) {
  buildSeriesArgs.push('icons-generate');
}

if (types.includes('js')) {
  buildParallelArgs.push('webpack-generate');
}

// Note that this task may depend on 'icons-generate', at least for the first run.
if (types.includes('css')) {
  buildParallelArgs.push('styles-generate');
}

if (buildParallelArgs.length) {
  buildSeriesArgs.push(gulp.parallel(...buildParallelArgs));
}

gulp.task('help', function(done) {
  program.outputHelp();
  done();
});

const build = gulp.series(...buildSeriesArgs);
gulp.task('build', build);

const watchFiles = async function() {
  const config = await Configuration.get();

  await config.loopOverComponents(async (name: string, { icons, scss, webpack, componentPath }: ConfigurationDefinition.Partial) => {
    let globs: string[] = [];

    if (types.includes('styles-generate') && scss !== undefined && scss.enabled) {
      // Fix the source path with the root path.
      scss.src.forEach((src, k) => {
        globs.push(path.resolve(componentPath, src));
      })

      scss.excludesWatch.forEach(p => {
        globs.push('!' + path.resolve(componentPath, p));
      })

      gulp.watch(
        globs,
        {}, gulp.series('parse-configuration', 'styles-generate'));
    }

    if (types.includes('webpack-generate') && webpack !== undefined && webpack.enabled) {
      if (typeof webpack.entries !== "undefined") {
        for (const [sourceDir, options] of Object.entries(webpack.entries)) {
          // Fix the source path with the root path.
          globs.push(path.resolve(componentPath, sourceDir));
        }
      }

      gulp.watch(
        globs,
        {}, gulp.series('parse-configuration', 'webpack-generate'));
    }

    if (types.includes('icons-generate') && icons !== undefined && icons.enabled) {
      if (typeof icons.src !== "undefined") {
        // Fix the source path with the root path.
        globs.push(path.resolve(componentPath, icons.src));
      }

      gulp.watch(
        globs,
        {}, gulp.series('parse-configuration', 'icons-generate'));
    }
  });
}
gulp.task('watch-files', watchFiles);

export { build as default, program };
