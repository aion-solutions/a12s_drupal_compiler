<?php

declare(strict_types=1);

namespace A12s\DrupalCompiler\Command;

use Composer\Command\BaseCommand;
use Composer\Console\Input\InputArgument;
use Composer\Console\Input\InputOption;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

class CheckRequirements extends BaseCommand
{

  protected function configure(): void
  {
    $this
      ->setName('a12s-compiler-check')
      ->setDescription('Checks that required dependencies are installed.')
      ->setDefinition([
        new InputArgument('sources-path', InputArgument::OPTIONAL, 'The path to the folder containing the sources to compile'),
        new InputOption('package-manager', null, InputOption::VALUE_REQUIRED, 'The package manager to use (npm, yarn, pnpm)', 'yarn'),
        new InputOption('nodejs-version', null, InputOption::VALUE_REQUIRED, 'The Node.js version to use', 'lts'),
        new InputOption('base-image', null, InputOption::VALUE_REQUIRED, 'The base Docker image variant (alpine, slim, bullseye, bookworm)', 'alpine'),
        new InputOption('node-modules-path', null, InputOption::VALUE_REQUIRED, 'The path to the node_modules directory'),
      ])
    ;
  }

  protected function execute(InputInterface $input, OutputInterface $output): int
  {
    $output->writeln('Executing');
    $composer = $this->requireComposer();

    $extra = $composer->getPackage()->getExtra();
    $rootDir = $this->getApplication()->getInitialWorkingDirectory();

    $packageManager = $input->getOption('package-manager');
    $nodejsVersion = $input->getOption('nodejs-version');
    $baseImage = $input->getOption('base-image');

    // Validate package manager
    if (!\in_array($packageManager, ['npm', 'yarn', 'pnpm'], true)) {
      $output->writeln("<error>Invalid package manager: $packageManager. Allowed options: npm, yarn, pnpm</error>");
      return 1;
    }

    // Validate base image (basic validation - must exist on Docker Hub)
    $validImages = ['alpine', 'slim', 'bullseye', 'bookworm'];
    if (!\in_array($baseImage, $validImages, true)) {
      $output->writeln("<error>Invalid base image: $baseImage. Available options: " . \implode(', ', $validImages) . "</error>");
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
      $nodeModulesPath = $rootDir . '/node_modules';
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

    // Build Docker command
    $dockerCommand = [
      'docker', 'run', '--rm',
      '-v', "{$absoluteSourcesPath}:/sources",
      '-v', "{$absoluteNodeModulesPath}:/sources/node_modules",
      '-w', '/sources',
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
}
