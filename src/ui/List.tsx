import { Box, Text, useInput } from 'ink';

/** 通用选择列表中的标识与显示文本。 */
export interface ListItem {
  id: string;
  label: string;
}

/** 通用列表的选项、受控选中位置及交互回调。 */
export interface ListProps {
  items: readonly ListItem[];
  selectedIndex: number;
  onChange: (index: number) => void;
  onSelect: (item: ListItem) => void;
  active?: boolean;
}

/** 展示通用列表，支持上下键循环选择和回车确认。 */
export function List({ items, selectedIndex, onChange, onSelect, active = true }: ListProps) {
  useInput(
    (_input, key) => {
      if (key.upArrow) onChange((selectedIndex + items.length - 1) % items.length);
      else if (key.downArrow) onChange((selectedIndex + 1) % items.length);
      else if (key.return) onSelect(items[selectedIndex]!);
    },
    { isActive: active && items.length > 0 }
  );

  return (
    <Box flexDirection="column" marginY={1}>
      {items.map((item, index) => (
        <Text key={item.id} color={index === selectedIndex ? 'cyan' : undefined}>
          {index === selectedIndex ? '❯ ' : '  '}
          {item.label}
        </Text>
      ))}
    </Box>
  );
}
