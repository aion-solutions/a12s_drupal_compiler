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

  protected function configure(): void
  {
    $this
      ->setName('a12s-compile-sass')
      ->setDescription('Compiles SASS files using a Docker container.')
      ->setDefinition([
        new InputArgument('sources-path', InputArgument::OPTIONAL, 'The path to the folder containing the sources to compile'),
        new InputOption('package-manager', null, InputOption::VALUE_REQUIRED, 'The package manager to use (npm, yarn, pnpm)', 'yarn'),
        new InputOption('nodejs-version', null, InputOption::VALUE_REQUIRED, 'The Node.js version to use', 'lts'),
        new InputOption('base-image', null, InputOption::VALUE_REQUIRED, 'The base Docker image variant (alpine, slim, bullseye, bookworm)', 'alpine'),
        new InputOption('node-modules-path', null, InputOption::VALUE_REQUIRED, 'The path to the node_modules directory'),
      ])
      ->setHelp($this->getHelp())
    ;
  }

  protected function execute(InputInterface $input, OutputInterface $output): int
  {
    $composer = $this->requireComposer();

    $extra = $composer->getPackage()->getExtra();
    $rootDir = $this->getApplication()->getInitialWorkingDirectory();

    // Get options
    $packageManager = $input->getOption('package-manager');
    $nodejsVersion = $input->getOption('nodejs-version');
    $baseImage = $input->getOption('base-image');

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
    if (!$nodeModulesPath) {
      if (isset($extra['a12s_compiler']['node-modules-path'])) {
        $nodeModulesPath = realpath($extra['a12s_compiler']['node-modules-path']);
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

    // Build Docker command
    $dockerCommand = [
      'docker', 'run', '--rm',
      '-v', "{$a12sCompileDir}/builder:/app",
      '-v', "{$absoluteSourcesPath}:/app/sources",
      '-v', "{$absoluteNodeModulesPath}:/app/node_modules",
      '-w', '/app',
      $imageTag,
      '/bin/sh', '-c',
      "{$packageManager} install && {$packageManager} run build",
    ];

    $output->writeln('<info>Executing Docker command:</info>');
    $output->writeln(\implode(' ', \array_map('escapeshellarg', $dockerCommand)));
    $output->writeln('');

    // Execute Docker command
    $process = new Process($dockerCommand, $rootDir);
    $process->setTty(true);
    $exitCode = $process->run(function ($type, $buffer) use ($output) {
      $output->write($buffer);
    });

    return $exitCode;
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
