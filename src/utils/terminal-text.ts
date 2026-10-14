import { stripVTControlCharacters } from 'node:util';

/** 清除文本自带的终端控制序列，将残留控制字符显示为转义文本，保留换行与制表符。 */
export function sanitizeTerminalText(text: string): string {
  return stripVTControlCharacters(text.replace(/\r\n/g, '\n')).replace(
    /[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}
