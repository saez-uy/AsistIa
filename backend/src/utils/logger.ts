import { env } from '../config/env.js';

// Pino-compatible logger interface (formato JSON en producción, pretty en dev)
const isDev = env.NODE_ENV === 'development';

function formatArgs(args: unknown[]): string {
  return args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
}

export const logger = {
  info:  (...args: unknown[]) => console.log(JSON.stringify({ level: 'info',  msg: formatArgs(args), time: Date.now() })),
  warn:  (...args: unknown[]) => console.warn(JSON.stringify({ level: 'warn',  msg: formatArgs(args), time: Date.now() })),
  error: (...args: unknown[]) => console.error(JSON.stringify({ level: 'error', msg: formatArgs(args), time: Date.now() })),
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(JSON.stringify({ level: 'debug', msg: formatArgs(args), time: Date.now() }));
  },
};
