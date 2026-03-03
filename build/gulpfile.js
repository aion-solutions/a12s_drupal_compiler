const { load: initConfig, defaultOptions } = require("./lib/config/Configuration");
const Styles = require("./lib/tasks/Styles");
const SvgSprite = require("./lib/tasks/SvgSprite");
const gulp = require("gulp");
const { Command } = require("commander");
const styles = new Styles();
const svgSprite = new SvgSprite();

const program = new Command();
program
  .allowUnknownOption()
  .allowExcessArguments()
  .option("-t, --types [TYPES...]", "The tasks to process, for example 'css', 'icons'", defaultOptions.types)
  .option("-c, --config-file [PATH]", "Allows you to define the configuration file to use. By default, a file named `./a12s-compiler.yml` is used.", defaultOptions.configFile)
  .option("-r, --sources-dir [PATH]", "The directory containing the sources to be processed.", defaultOptions.sourcesDir)
  .option("-v, --verbose", "Whether verbose output should be enabled.", defaultOptions.verbose)
  .option("--debug", "Whether the debug mode is active.", defaultOptions.debug);
program.parse();

gulp.task('init-configuration', async () => {
  try {
    await initConfig({ ...program.opts(), rootDir: process.cwd() });
  }
  catch (error) {
    console.error('Configuration parsing failed:', error);
    process.exit(1);
  }
});
gulp.task('svg-sprite-generate', async () => svgSprite.generate());
gulp.task('styles-generate', async () => styles.generate());

const types = program.getOptionValue("types");
let buildSeriesArgs = ['init-configuration'];
let buildParallelArgs = [];

if (types.includes('svg-sprite')) {
  buildSeriesArgs.push('svg-sprite-generate');
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

exports.help = gulp.series('help');
exports.default = build;
