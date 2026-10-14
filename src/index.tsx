import { render } from 'ink';
import { App } from './ui/App';
import { ProviderSession } from './ui/ProviderSession';

if (process.stdout.isTTY) {
  // 进入界面时清除可见内容和历史缓冲区，并将光标移到左上角。
  process.stdout.write('\u001B[2J\u001B[3J\u001B[H');
}
render(
  <ProviderSession>
    <App />
  </ProviderSession>,
);
