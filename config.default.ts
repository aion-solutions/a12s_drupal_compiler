import * as TerserPlugin from "terser-webpack-plugin";
import * as process from "process";
import * as path from "path";

// noinspection SpellCheckingInspection
module.exports = {

  drupalRoot: "../",

  paths: [
    "web/modules/custom",
    "web/themes/custom"
  ],

  /**
   * Icon font
   *
   * https://github.com/nfroidure/gulp-iconfont
   */
  icons: {
    enabled: true,
    fontPathPrefix: "../font-icon/",
    classNamePrefix: "fi", // Font Icon
    autohint: false,
    normalize: true,
    useTimestamp: false,
    templates: {
      enabled: true,
      css: {
        src: "./templates/_icons-settings.scss.ejs",
        dest: "src/scss/abstract/variables/"
      }
    },
    formats: [
      "ttf",
      "eot",
      "woff",
      "svg"
    ]
  },

  /**
   * SASS.
   */
  scss: {
    enabled: true,
    pathVariables: "src/scss/abstract/variables/theme",
    excludesWatch: [
      "src/scss/abstract/variables/theme/**/*.scss",
      "src/scss/_root.scss",
    ],
    pathScss: "src/scss",
    flattenDestOutput: true,
    lint: {
      enabled: true,
      failOnError: true,
      // in addition to linting `css.src`, this is added.
      extraSrc: []
    },
    // enables additional debugging information in the output file as CSS
    // comments - only use when necessary
    sourceComments: false,
    sourceMapEmbed: false,
    // tell the compiler whether you want "expanded" or "compressed" output code
    outputStyle: "expanded",
    // https://github.com/ai/browserslist#queries
    autoPrefixerBrowsers: [
      "last 2 versions",
      "IE >= 10"
    ],
    includePaths: [
      "./node_modules"
    ]
  },

  /**
   * Webpack.
   */
  webpack: {
    enabled: true,
    config: {
      entry: {},
      output: {
        filename: "[name]",
        path: path.resolve(__dirname, "..")
      },
      externals: {
        "debounce": "window.Drupal.debounce",
        "drupal": "window.Drupal",
        "drupalSettings": "window.drupalSettings",
        "once": "window.once",
      },
      module: {
        rules: [
          {
            test: /\.ts$/,
            exclude: /node_modules/,
            use: ["babel-loader", "ts-loader"]
          },
          {
            test: /\.coffee$/,
            use: [ "coffee-loader" ]
          },
          {
            test: /\.css$/,
            use: [ "css-loader" ]
          }
        ]
      },
      resolve: {
        extensions: [".ts", ".js"]
      },
      optimization: {
        minimize: (process.env.NODE_ENV === "production"),
        minimizer: [
          new TerserPlugin({
            terserOptions: {
              mangle: {
                reserved: ["Drupal"]
              }
            }
          })
        ]
      }
    }
  }
};
