<?php

namespace A12s\DrupalCompiler;

use A12s\DrupalCompiler\Command\CheckRequirements;
use A12s\DrupalCompiler\Command\CompileSass;
use Composer\Plugin\Capability\CommandProvider as CommandProviderCapability;

class CommandProvider implements CommandProviderCapability
{

  public function getCommands()
  {
    return [
      new CheckRequirements(),
      new CompileSass()
    ];
  }

}
