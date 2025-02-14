const Configuration = require("./services/Configuration");
const Styles = require("./services/Styles");
const Icons = require("./services/Icons");
const gulp = require("gulp");
const { Command } = require("commander");

const icons = new Icons();
const styles = new Styles();

const program = new Command();
program
  .allowUnknownOption()
    .option("-t, --types [TYPES...]", "The tasks to process, for example 'css', 'icons'", ['css', 'icons'])
    .option("-c, --config-file [PATH]", "Allows you to define the configuration file to use. By default, a file named `./a12s-drupal-compiler.yml` is used.", './a12s-drupal-compiler.yml');
program.parse();

gulp.task('parse-configuration', Configuration.get);
gulp.task('icons-generate', icons.generate.bind(icons));
gulp.task('styles-generate', styles.generate.bind(styles));

const types = program.getOptionValue("types");
let buildSeriesArgs = ['parse-configuration'];
let buildParallelArgs = [];

if (types.includes('icons')) {
  buildSeriesArgs.push('icons-generate');
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

module.exports = build;
module.exports.program = program;

