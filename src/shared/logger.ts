type Details = Record<string, string | number | boolean | undefined>;
type Level = 'info' | 'warn' | 'error';
type Sink = Pick<Console, Level>;

export interface Logger {
  info(event: string, details?: Details): void;
  warn(event: string, details?: Details): void;
  error(event: string, details?: Details): void;
}

export function createLogger(
  sink: Sink = console,
  quiet: () => boolean = () => process.env.NODE_ENV === 'test' || process.execArgv.includes('--test'),
): Logger {
  const write = (level: Level, event: string, details?: Details): void => {
    if (quiet()) return;
    const context = details ? ` ${JSON.stringify(details)}` : '';
    sink[level](`${new Date().toISOString()} ${level.toUpperCase()} ${event}${context}`);
  };
  return {
    info: (event, details) => write('info', event, details),
    warn: (event, details) => write('warn', event, details),
    error: (event, details) => write('error', event, details),
  };
}

export const logger = createLogger();
