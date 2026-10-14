import { render } from 'ink';
import { App } from './ui/App';
import { ProviderSession } from './ui/ProviderSession';

if (process.stdout.isTTY) {
  // 进入界面时清除可见内容和历史缓冲区，并将光标移到左上角。
  process.stdout.write('\u001B[2J\u001B[3J\u001B[H');
}
const app = render(
  <ProviderSession>
    <App />
  </ProviderSession>
);

try {
  await app.waitUntilExit();
} finally {
  // Ink 卸载后停止输入读取，避免 Windows 终端继续等待下一次回车。
  process.stdin.pause();
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  // 最后一帧由 Ink 保留，清理完成并刷新输出后再交还终端。
  await new Promise<void>(resolve => {
    process.stdout.write(process.stdout.isTTY ? '\u001B[2J\u001B[3J\u001B[H\u001B[?25h' : '', () =>
      resolve()
    );
  });
}

// 退出 CLI 不再等待模型请求或其他活动句柄，终端无需额外输入即可显示提示符。
process.exit(process.exitCode ?? 0);
