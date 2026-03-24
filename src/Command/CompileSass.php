<?php

declare(strict_types=1);

namespace A12s\DrupalCompiler\Command;

use Composer\Command\BaseCommand;
use Composer\Console\Input\InputArgument;
use Composer\Console\Input\InputOption;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Process\Process;

class CompileSass extends BaseCommand
{

  /**
   * @inheritDoc
   */
  protected function configure(): void
  {
    $this
      ->setName('a12s-compile-sass')
      ->setDescription('Compiles SASS files using a Docker container.')
      ->setDefinition([
        new InputArgument('sources-path', InputArgument::OPTIONAL, 'The path to the folder containing the sources to compile'),
        new InputOption('package-manager', 'pm', InputOption::VALUE_REQUIRED, 'The package manager to use (npm, yarn, pnpm)', 'yarn'),
        new InputOption('nodejs-version', 'njs', InputOption::VALUE_REQUIRED, 'The Node.js version to use', 'lts'),
        new InputOption('base-image', 'i', InputOption::VALUE_REQUIRED, 'The base Docker image variant (alpine, slim, bullseye, bookworm)', 'alpine'),
        new InputOption('node-modules-path', 'p', InputOption::VALUE_REQUIRED, 'The path to the node_modules directory'),
        new InputOption('remove-docker-image', 'rmi', InputOption::VALUE_REQUIRED, 'Whether to remove the Docker image after processing', false),
        new InputOption('color-output', 'c', InputOption::VALUE_REQUIRED, 'Whether to enable color output', true),
      ])
      ->setHelp($this->getHelp())
    ;
  }

  /**
   * @inheritdoc
   */
  protected function execute(InputInterface $input, OutputInterface $output): int
  {
    $composer = $this->requireComposer();

    $extra = $composer->getPackage()->getExtra();
    $rootDir = $this->getApplication()->getInitialWorkingDirectory();

    // Get options
    $packageManager = $input->getOption('package-manager');
    $nodejsVersion = $input->getOption('nodejs-version');
    $baseImage = $input->getOption('base-image');
    $removeDockerImage = $input->getOption('remove-docker-image');
    $colorOutput = $input->getOption('color-output');

    // Validate package manager
    if (!\in_array($packageManager, ['npm', 'yarn', 'pnpm'], true)) {
      $output->writeln("<error>Invalid package manager: $packageManager. Allowed options: npm, yarn, pnpm</error>");
      return 1;
    }

    // Get sources path (from argument or config)
    $sourcesPath = $input->getArgument('sources-path');
    if (!$sourcesPath) {
      if (isset($extra['a12s_compiler']['sources-path'])) {
        $sourcesPath = $extra['a12s_compiler']['sources-path'];
      }
      else {
        $output->writeln('<error>The sources-path argument is required and not found in composer.json extra.a12s_compiler</error>');
        return 1;
      }
    }

    // Get node_modules path
    $nodeModulesPath = $input->getOption('node-modules-path');

    // @todo Generate a hash based on the required packages and allow extending
    //   the package.json in the a12s_compiler.
    if (!$nodeModulesPath) {
      if (isset($extra['a12s_compiler']['node-modules-path'])) {
        $nodeModulesPath = $extra['a12s_compiler']['node-modules-path'];

        if (!file_exists($nodeModulesPath)) {
          if (!mkdir($nodeModulesPath, 0755, true) && !is_dir($nodeModulesPath)) {
            $output->writeln("<error>Failed to create directory: {$nodeModulesPath}</error>");
            return 1;
          }
        }

        $nodeModulesPath = realpath($nodeModulesPath);
      }
      else {
        $nodeModulesPath = $rootDir . '/node_modules';
      }
    }

    // Validate base image (basic validation - must exist on Docker Hub)
    $validImages = ['alpine', 'slim', 'bullseye', 'bookworm'];
    if (!\in_array($baseImage, $validImages, true)) {
      $output->writeln("<error>Invalid base image: $baseImage. Available options: " . \implode(', ', $validImages) . "</error>");
      return 1;
    }

    // Build Docker image tag
    $imageTag = "node:{$nodejsVersion}-{$baseImage}";

    // Prepare absolute paths
    $absoluteSourcesPath = $this->resolveAbsolutePath($sourcesPath, $rootDir);
    $absoluteNodeModulesPath = $this->resolveAbsolutePath($nodeModulesPath, $rootDir);

    // Ensure node_modules directory exists
    if (!\file_exists($absoluteNodeModulesPath)) {
      @\mkdir($absoluteNodeModulesPath, 0755, true);
    }

    $a12sCompileDir = realpath(dirname(dirname(__DIR__)));
    $output->writeln('<info>$a12sCompileDir:</info> ' . $a12sCompileDir);

    // @todo manage optional parameters for:
    //   - build-dev
    //   - build-css
    //   - ...

    // Define a random container name to be able to remove it if the "docker
    // run" command exits with an error.
    $containerName = 'a12s-build-' . \substr(\sha1($imageTag . microtime(true)), 0, 12);

    // Build Docker command
    $dockerCommand = [
      'docker', 'run', '--rm',
      '--name', $containerName,
      '-v', "{$a12sCompileDir}/build:/app",
      '-v', "{$absoluteSourcesPath}:/app/sources",
      '-v', "{$absoluteNodeModulesPath}:/app/node_modules",
      '-w', '/app',
      ];

    $this->appendToDockerCommandIf($colorOutput, $dockerCommand, [
      '-e', 'FORCE_COLOR=1',
      '-e', 'TERM=xterm-256color',
    ]);

    $this->appendToDockerCommand($dockerCommand, [
      $imageTag,
      '/bin/sh', '-c',
      "{$packageManager} install && {$packageManager} run build",
    ]);

    $output->writeln('<info>Executing Docker command:</info>');
    $output->writeln(\implode(' ', \array_map('escapeshellarg', $dockerCommand)));
    $output->writeln('');

    // Execute Docker command
    $process = new Process($dockerCommand, $rootDir);
    $process->setTty(true);
    $exitCode = 1;

    try {
      $exitCode = $process->run(function ($type, $buffer) use ($output) {
        $output->write($buffer, false, OutputInterface::OUTPUT_RAW);
      });
    }
    finally {
      if ($exitCode !== 0) {
        $output->writeln('<info>Removing Docker container after failure</info>');
        $cleanupCommand = ['docker', 'rm', '-f', $containerName];
        $cleanupProcess = new Process($cleanupCommand, $rootDir);
        $cleanupProcess->setTty(false);
        $cleanupProcess->run();
      }

      if (!empty($removeDockerImage)) {
        $output->writeln('<info>Removing Docker image:</info>', $imageTag);
        $removeImageCommand = ['docker', 'image', 'rm', '-f', $imageTag];
        $removeImageProcess = new Process($removeImageCommand, $rootDir);
        $removeImageProcess->setTty(false);
        $removeImageProcess->run();
      }
    }

    return $exitCode;
  }

  /**
   * Appends commands to the Docker command array.
   *
   * @param array $dockerCommand
   *   The Docker command array to append to.
   * @param array $commands
   *   The commands to append.
   */
  private function appendToDockerCommand(array &$dockerCommand, array $commands): void
  {
    $dockerCommand = \array_merge($dockerCommand, $commands);
  }

  /**
   * Appends commands to the Docker command array if a condition is met.
   *
   * @param bool $condition
   *   The condition to check.
   * @param array $dockerCommand
   *   The Docker command array to append to.
   * @param array $commands
   *   The commands to append if the condition is met.
   *
   * @return void`
   */
  private function appendToDockerCommandIf(bool $condition, array &$dockerCommand, array $commands): void {
    if ($condition) {
      $this->appendToDockerCommand($dockerCommand, $commands);
    }
  }

  /**
   * Resolves an absolute path from a relative path.
   *
   * @param string $path The path to resolve (absolute or relative).
   * @param string $basePath The base directory for relative paths.
   *
   * @return string The absolute path.
   */
  private function resolveAbsolutePath(string $path, string $basePath): string
  {
    if (\str_starts_with($path, '/')) {
      return $path;
    }

    return \rtrim($basePath, '/') . '/' . \ltrim($path, '/');
  }

  /**
   * Gets the help text for this command.
   *
   * @return string
   */
  public function getHelp(): string
  {
    return <<<EOF
The <info>a12s-compile-sass</info> command compiles SASS files using a temporary Docker container.

The command mounts the sources directory and node_modules directory into the container,
runs package manager install, and then executes the build script.

<info>Usage Examples:</info>

  # Compile SASS with default settings (yarn, Node.js LTS, alpine image)
  <comment>composer a12s-compile-sass</comment>

  # Compile SASS with custom sources path
  <comment>composer a12s-compile-sass assets/styles</comment>

  # Use npm instead of yarn
  <comment>composer a12s-compile-sass --package-manager=npm</comment>

  # Use a specific Node.js version
  <comment>composer a12s-compile-sass --nodejs-version=20</comment>

  # Use a different Docker image variant
  <comment>composer a12s-compile-sass --base-image=slim</comment>

  # Combine multiple options
  <comment>composer a12s-compile-sass assets/styles --package-manager=pnpm --nodejs-version=22 --base-image=bookworm</comment>

  # Custom node_modules location
  <comment>composer a12s-compile-sass --node-modules-path=/tmp/node_modules</comment>

<info>Configuration via composer.json:</info>

You can set default values in your composer.json under <comment>extra.a12s_compiler</comment>:

  {
    "extra": {
      "a12s_compiler": {
        "sources-path": "assets/styles"
      }
    }
  }
EOF;
  }

}
