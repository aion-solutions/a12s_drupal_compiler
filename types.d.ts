import webpack = require("webpack");

export declare namespace Configuration {

  interface Parsed {

    default: Partial;

    components: Map<string, Partial>;

  }

  interface Webpack {

    enabled: boolean;

    debug: boolean;

    entries: {
      [key: string]: {
        destination: string;
        filename: string;
        pattern: string;
      }
    }

    config: webpack.Configuration;

  }

  interface Scss {

    enabled: boolean;

    src: string[];

    dest: string;

    pathVariables: string;

    excludesWatch: string[];

    pathScss: string;

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

    webpack?: Webpack;

    scss?: Scss;

    icons?: Icons;

  }

}



export declare namespace Configuration {
  interface parsedSassVariables {

    type: string;

    dependencies: object[];

  }

  interface sassVariable {

    type: string;

    dependencies: object[];

  }

  interface sassVariableItem {
    type?: string;
    label?: string;
    grayscale?: {
      type?: string;
      label?: string;
      variables?: {
        white?: string;
        'gray-100'?: string;
        'gray-300'?: string;
        'gray-400'?: string;
        'gray-600'?: string;
        'gray-800'?: string;
        'gray-900'?: string;
        black?: string;
      }
    },
    theme?: {
      type?: string;
      label?: string;
      variables?: {
        primary?: string;
        info?: string;
        error?: string;
        warning?: string;
        success?: string;
        light?: string;
        gray?: string;
        dark?: string;
      }
    },
    variants?: {
      type?: string;
      label?: string;
      description?: string;
      variables?: {
        'border-colors'?: object;
        'background-colors'?: object;
      }
    }

  }

  interface sassOptions {

    prefix: string;

    indent: string;

  }

}
export interface parsedSassVariables {

  type: string;

  dependencies: object[];

}

export interface sassVariable {

  type: string;

  dependencies: object[];

}

export interface sassComment {

  label: string;

  description: string;

}
