import { Box, Text, useInput } from 'ink';

/** 通用选择列表中的标识、标签、可选说明与当前值。 */
export interface ListItem {
  id: string;
  label: string;
  comment?: string;
  value?: string;
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
  const hasValues = items.some(item => item.value !== undefined);
  useInput(
    (_input, key) => {
      if (key.upArrow) onChange((selectedIndex + items.length - 1) % items.length);
      else if (key.downArrow) onChange((selectedIndex + 1) % items.length);
      else if (key.return) onSelect(items[selectedIndex]!);
    },
    { isActive: active && items.length > 0 }
  );

  return (
    <Box marginY={1}>
      <Box
        flexDirection="column"
        width={hasValues ? 100 : '100%'}
        flexShrink={1}
        paddingRight={hasValues ? 2 : 0}
      >
        {items.map((item, index) => (
          <Box key={item.id} justifyContent="space-between" columnGap={2}>
            <Text color={index === selectedIndex ? 'cyan' : undefined}>
              {index === selectedIndex ? '❯ ' : '  '}
              {item.label}
              {item.comment !== undefined && <Text color="gray"> {item.comment}</Text>}
            </Text>
            {item.value !== undefined && (
              <Box flexShrink={0}>
                <Text color={index === selectedIndex ? 'cyan' : undefined}>{item.value}</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
