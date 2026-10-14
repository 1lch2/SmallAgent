import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { executeCommand } from '../core/commands';
import type { SlashCommand } from '../core/commands';

/** 受控输入值、提交回调及用于菜单和执行的命令列表。 */
export interface CommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  commands: readonly SlashCommand[];
}

/** 带斜杠命令菜单的受控终端输入栏。 */
export function CommandInput({
  value,
  onChange,
  onSubmit,
  commands,
}: CommandInputProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inputRevision, setInputRevision] = useState(0);
  const menuVisible = value.startsWith('/') && !/\s/.test(value);
  const matchingCommands = commands.filter((command) => command.name.startsWith(value));

  function completeCommand() {
    const command = matchingCommands[selectedIndex];
    if (!command) return;
    onChange(`${command.name} `);
    // 重新挂载输入控件，让其内部光标跟随补全文本移动到末尾。
    setInputRevision((revision) => revision + 1);
    setSelectedIndex(0);
  }

  useInput(
    (_input, key) => {
      if (key.upArrow) {
        setSelectedIndex((index) => (index + matchingCommands.length - 1) % matchingCommands.length);
      } else if (key.downArrow) {
        setSelectedIndex((index) => (index + 1) % matchingCommands.length);
      } else if (key.tab) {
        completeCommand();
      }
    },
    { isActive: menuVisible && matchingCommands.length > 0 },
  );

  return (
    <Box flexDirection='column'>
      <Box borderStyle='round' borderColor='gray' paddingX={1}>
        <Text color='green'>{'> '}</Text>
        <TextInput
          key={inputRevision}
          value={value}
          onChange={(nextValue) => {
            setSelectedIndex(0);
            onChange(nextValue);
          }}
          onSubmit={(text) => {
            if (menuVisible) completeCommand();
            else if (!executeCommand(commands, text)) onSubmit(text);
            else onChange('');
          }}
          showCursor
        />
      </Box>
      {menuVisible && (
        <Box flexDirection='column' paddingX={2}>
          {matchingCommands.map((command, index) => (
            <Text key={command.name} color={index === selectedIndex ? 'cyan' : undefined}>
              <Text bold={index === selectedIndex}>
                {index === selectedIndex ? '❯ ' : '  '}
                {command.name.padEnd(12)}
              </Text>
              <Text dimColor={index !== selectedIndex}>{command.description}</Text>
            </Text>
          ))}
          <Text dimColor>{matchingCommands.length > 0 ? '↑↓ 选择 · Tab / Enter 补全' : '无匹配命令'}</Text>
        </Box>
      )}
    </Box>
  );
}
