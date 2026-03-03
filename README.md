# A12s compiler

## Features

- **Docker Container Management**: Creates temporary containers with automatic cleanup (`--rm`)
- **Package Manager Support**: Defaults to `yarn`, but supports `npm` and `pnpm`
- **Node.js Version Flexibility**: Configurable Node.js version (default: ) `lts`
- **Docker Image Variants**: Supports `alpine`, `slim`, `bullseye`, and `bookworm` (default: `alpine`)
- **Volume Mounting**:
  - Mounts sources directory at `/sources` in container
  - Mounts node_modules at `/sources/node_modules` to persist dependencies
- **Configuration via composer.json**: Can define `extra.a12s_compiler.sources-path` as fallback
- **Command Display**: Prints the executed Docker command before running it
- **Comprehensive Help**: Includes usage examples via `setHelp()` in the method `configure()`
- **Error Handling**: Validates options and provides clear error messages
- The command is invoked from the Composer root directory and displays the
  Docker command before execution, making it transparent and debuggable.

### SCSS compilation

### SVG sprite generation

SVG files → SVGO (optimize) → gulp-svg-sprite (create sprite)

The optimization step is optional, but enabled by default.

*Configuration*:

The svg-sprite section includes common SVGO plugins organized by category:
- Metadata Removal - Strips editor info, titles, descriptions
- Cleanup - Removes empty containers and unused definitions
- Optimization - Converts colors, paths, and transforms
- ID Management - Cleans up IDs (set prefixIds: true if you have ID conflicts across sprites)
- Preservation - Keeps viewBox for responsive scaling

Sprite Generation (Modes):
- symbol mode - Best for flexible usage with CSS, <img> tags, and <svg><use> elements
- inline: false - Generates a separate sprite file (recommended for caching)
- example: false - Set to true to generate an HTML preview of available symbols

## Developpment

### Example for testing the help command

```shell
docker run -it \
  -v ./build:/app/ \
  -v ./tests/simple-scss/:/app/sources \
  -w /app \
  node:lts-alpine /bin/sh -c "yarn install && yarn run gulp help"
```

### Example for testing a simple SCSS compilation

```shell
docker run -it \
  -v ./build:/app/ \
  -v ./tests/simple-scss/:/app/sources \
  -w /app \
  node:lts-alpine /bin/sh -c "yarn install && yarn run build"
```

### Example for testing an advanced SCSS compilation

```shell
docker run -it \
  -v ./build:/app/ \
  -v ./tests/advanced-scss/:/app/sources \
  -w /app \
  node:lts-alpine /bin/sh -c "yarn install && yarn run build"
```

### Example for testing the SVG sprite generation

```shell
docker run -it \
  -v ./build:/app/ \
  -v ./tests/advanced-scss/:/app/sources \
  -w /app \
  node:lts-alpine /bin/sh -c "yarn install && yarn run build-svg-sprite"
```
