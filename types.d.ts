export declare namespace Configuration {

  interface Parsed {

    default: Partial;

    components: Map<string, Partial>;

  }

  interface Scss {

    enabled: boolean;

    src: string[];

    dest: string;

    variablesPath?: string;

    scssPath: string|null;

    // @todo: set type
    debug: any;

    flattenDestOutput: boolean;

    lint: {
      enabled: boolean;
      failOnError: boolean;
      // in addition to linting `css.src`, this is added.
      extraSrc: string[];
    },

    // enables additional debugging information in the output file as CSS
    // comments - only use when necessary
    sourceComments: boolean;
    sourceMapEmbed: boolean;

    // tell the compiler whether you want 'expanded' or 'compressed' output code
    outputStyle: string;

    // https://github.com/ai/browserslist#queries
    // noinspection SpellCheckingInspection
    autoPrefixerBrowsers: string[];

    includePaths: string[];

  }

  interface Icons {

    enabled: boolean;

    src: string;

    dest: string;

    iconName: string;

    fontPathPrefix: string;

    classNamePrefix: string;

    // noinspection SpellCheckingInspection
    autohint: boolean;

    normalize: boolean;

    useTimestamp?: boolean;

    templates: {
      enabled: boolean;

      css: {
        src: string;
        dest: string;
      }
    }

    formats: string[];
  }

  interface Partial {

    drupalRoot?: string;

    paths: string[];

    componentPath?: string;

    scss?: Scss;

    icons?: Icons;

  }

}
