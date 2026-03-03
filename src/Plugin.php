<?php

declare(strict_types=1);

namespace A12s\DrupalCompiler;

use Composer\Composer;
use Composer\IO\IOInterface;
use Composer\Plugin\Capable;
use Composer\Plugin\PluginInterface;

/**
 * Composer plugin providing helpers for Drupal themes and modules.
 */
class Plugin implements PluginInterface, Capable
{

  /**
   * @inheritDoc
   */
  public function activate(Composer $composer, IOInterface $io) {}

  /**
   * @inheritDoc
   */
  public function deactivate(Composer $composer, IOInterface $io) {}

  /**
   * @inheritDoc
   */
  public function uninstall(Composer $composer, IOInterface $io)
  {
    // @todo remove "node_modules" directory.
  }

  /**
   * @inheritDoc
   */
  public function getCapabilities()
  {
    return [
      'Composer\Plugin\Capability\CommandProvider' => 'A12s\DrupalCompiler\CommandProvider',
    ];
  }

}
