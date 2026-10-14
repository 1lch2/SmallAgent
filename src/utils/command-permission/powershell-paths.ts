import { execFile } from 'node:child_process';

/** PowerShell 静态分析结果；不包含执行命令产生的数据。 */
export interface PowerShellPathAnalysis {
  valid: boolean;
  paths: string[];
}

// 使用真实语法树和参数绑定解析路径，绝不求值或执行传入的命令。
const parserScript = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
$tokens = $null
$errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseInput($request.command, [ref]$tokens, [ref]$errors)
$paths = [System.Collections.Generic.List[string]]::new()

function Add-Path($value, [bool]$literal) {
  foreach ($item in @($value)) {
    if ($item -isnot [string] -or [string]::IsNullOrWhiteSpace($item)) { throw '动态或空路径' }
    $provider = $null
    $drive = $null
    $resolved = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($item, [ref]$provider, [ref]$drive)
    if ($provider.Name -ne 'FileSystem') { throw '不支持非文件系统路径' }
    $root = [IO.Path]::GetFullPath($request.cwd).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($resolved -ne $root.TrimEnd([IO.Path]::DirectorySeparatorChar) -and -not $resolved.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw '目录外路径' }
    $paths.Add($resolved)
    if (-not $literal -and [System.Management.Automation.WildcardPattern]::ContainsWildcardCharacters($item)) {
      # 同时检查通配符前的目录和每个匹配项，避免目录链接绕过权限。
      $prefix = ($resolved -split '[*?\[]', 2)[0]
      $paths.Add([IO.Path]::GetDirectoryName($prefix))
      foreach ($match in @(Resolve-Path -Path $item -ErrorAction SilentlyContinue)) {
        if ($match.Provider.Name -ne 'FileSystem') { throw '不支持非文件系统路径' }
        $paths.Add($match.ProviderPath)
      }
    }
  }
}

function Read-StaticValue($node) {
  # SafeGetValue 仅允许常量及常量数组，不运行子表达式、变量或命令。
  if ($null -eq $node) { throw '缺少路径值' }
  return $node.SafeGetValue()
}

try {
  if ($errors.Count -gt 0) { throw '语法错误' }
  $unsupported = $ast.FindAll({ param($node)
    $node -is [System.Management.Automation.Language.AssignmentStatementAst] -or
    $node -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -or
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -or
    $node -is [System.Management.Automation.Language.UsingStatementAst]
  }, $true)
  if ($unsupported.Count -gt 0) { throw '无法静态确认的执行上下文' }
  foreach ($redirect in $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FileRedirectionAst] }, $true)) {
    Add-Path (Read-StaticValue $redirect.Location) $true
  }
  foreach ($command in $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true)) {
    $name = $command.GetCommandName()
    if (-not $name) { throw '动态命令名' }
    $info = Get-Command -Name $name -CommandType Cmdlet,Alias -ErrorAction SilentlyContinue
    if ($info -is [System.Management.Automation.AliasInfo]) { $info = $info.ResolvedCommand }
    $canonical = if ($info) { $info.Name } else { [IO.Path]::GetFileNameWithoutExtension($name) }
    if ($canonical -in @('Set-Location','Push-Location','Pop-Location','Set-Alias','New-Alias','Import-Alias','Invoke-Expression','Invoke-Command','Start-Process','Start-Job','Start-ThreadJob','Import-Module','New-PSDrive','Remove-PSDrive','Set-Variable','New-Variable','Remove-Variable','pwsh','powershell','cmd','bash','sh')) { throw '无法静态确认的执行上下文' }
    if (-not $info -and ($name -match '[/\\:]' -or $name.StartsWith('.'))) { Add-Path $name $true }
    if ($info -and $info.CommandType -eq 'Cmdlet') {
      $binding = [System.Management.Automation.Language.StaticParameterBinder]::BindCommand($command)
      if ($binding.BindingExceptions.Count -gt 0) { throw '无法绑定参数' }
      if ($binding.BoundParameters.ContainsKey('FollowSymlink')) { throw '无法静态确认递归链接目标' }
      $isLink = $canonical -eq 'New-Item' -and $binding.BoundParameters.ContainsKey('ItemType') -and (Read-StaticValue $binding.BoundParameters['ItemType'].Value) -in @('SymbolicLink', 'Junction', 'HardLink')
      $hasInputPath = $false
      foreach ($entry in $binding.BoundParameters.GetEnumerator()) {
        $key = $entry.Key
        if ($key -match 'Path$|^Destination$|^Target$|^NewName$|^OutFile$|^OutputDirectory$|^RedirectStandard' -or ($isLink -and $key -eq 'Value')) {
          if ($key -in @('Path', 'LiteralPath', 'FilePath')) { $hasInputPath = $true }
          $value = Read-StaticValue $entry.Value.Value
          Add-Path $value ($key -eq 'LiteralPath' -or $key -notmatch 'Path$')
          if ($key -in @('Path', 'LiteralPath') -and $canonical -in @('Copy-Item', 'Move-Item', 'Remove-Item') -and $binding.BoundParameters.ContainsKey('Recurse')) {
            foreach ($source in @($value)) {
              $sourcePaths = if ($key -eq 'LiteralPath') { Resolve-Path -LiteralPath $source } else { Resolve-Path -Path $source }
              foreach ($sourcePath in $sourcePaths) {
                foreach ($child in Get-ChildItem -LiteralPath $sourcePath.ProviderPath -Recurse -Force) { $paths.Add($child.FullName) }
              }
            }
          }
        }
      }
      # 管道中的字符串和对象可能绑定为路径，不能仅检查命令自身的参数。
      $takesPath = $info.Parameters.ContainsKey('Path') -or $info.Parameters.ContainsKey('LiteralPath') -or $info.Parameters.ContainsKey('FilePath')
      if ($takesPath -and -not $hasInputPath -and $command.Parent -is [System.Management.Automation.Language.PipelineAst] -and $command.Parent.PipelineElements[0] -ne $command) { throw '无法静态确认管道路径' }
    } else {
      # 外部程序的选项协议未知，只检查静态参数中的显式路径和现存文件名。
      foreach ($element in @($command.CommandElements | Select-Object -Skip 1)) {
        if ($element -is [System.Management.Automation.Language.CommandParameterAst]) {
          if ($element.Argument) { $value = Read-StaticValue $element.Argument }
          elseif ($element.Extent.Text -match '^--?[\w-]+=') { $value = $element.Extent.Text }
          else { continue }
        } else { $value = Read-StaticValue $element }
        foreach ($argument in @($value)) {
          if ($argument -isnot [string]) { continue }
          $candidate = $argument -replace '^--?[\w-]+=', ''
          if ($candidate -match '^https?://') { continue }
          if ($candidate -match '[/\\:]|^\.{1,2}$|^~' -or (Test-Path -LiteralPath $candidate)) { Add-Path $candidate $true }
        }
      }
    }
  }
  @{ valid = $true; paths = @($paths) } | ConvertTo-Json -Compress
} catch {
  @{ valid = $false; paths = @() } | ConvertTo-Json -Compress
}
`;

/** 调用无配置文件的 PowerShell 解析器，按真实参数语义提取路径。 */
export function getPowerShellPaths(command: string, cwd: string, shellPath: string): Promise<PowerShellPathAnalysis> {
  return new Promise((resolve, reject) => {
    const child = execFile(shellPath, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
      Buffer.from(parserScript, 'utf16le').toString('base64'),
    ], { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024, timeout: 15_000 }, (error, stdout) => {
      if (error) { reject(error); return; }
      try { resolve(JSON.parse(stdout) as PowerShellPathAnalysis); }
      catch (parseError) { reject(parseError); }
    });
    child.stdin?.on('error', reject);
    child.stdin?.end(JSON.stringify({ command, cwd }));
  });
}
