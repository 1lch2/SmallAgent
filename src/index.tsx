import 'dotenv/config';
import { render } from 'ink';
import { Agent } from './core/agent';
import { OpenAILLM } from './openai-llm';
import { errorMessage } from './utils/error';
import { App } from './ui/app';

try {
  const baseURL = process.env.OPENAI_BASE_URL;
  const model = process.env.SMALLAGENT_MODEL;
  if (!baseURL) {
    throw new Error('OPENAI_BASE_URL is required. Set it in .env or as an environment variable.');
  }
  if (!model) {
    throw new Error('SMALLAGENT_MODEL is required. Set it in .env or as an environment variable.');
  }

  const llm = new OpenAILLM({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL,
    model,
  });
  const agent = new Agent({
    llm,
    cwd: process.cwd(),
  });
  render(<App agent={agent} model={model} />);
} catch (err) {
  console.error(errorMessage(err));
  process.exit(1);
}
