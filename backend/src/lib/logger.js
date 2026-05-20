function timestamp() {
  return new Date().toISOString();
}

// Accepts (message), (domain, message), (domain, message, meta), or (message, meta).
// Determining domain heuristically: short single-token first arg with no spaces is treated as a domain.
function normalize(args) {
  if (args.length === 0) return { domain: null, message: '', meta: undefined };
  if (args.length === 1) return { domain: null, message: args[0], meta: undefined };

  const [a, b, c] = args;
  // (domain, message, meta?) when first arg looks like a domain tag.
  if (typeof a === 'string' && typeof b === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(a)) {
    return { domain: a, message: b, meta: c };
  }
  // (message, meta) — second arg is an Error or object.
  return { domain: null, message: a, meta: b };
}

function stringifyMeta(meta) {
  if (meta === undefined || meta === null) return '';
  if (meta instanceof Error) return ` ${meta.stack || meta.message}`;
  try {
    return ' ' + JSON.stringify(meta);
  } catch {
    return ` [unserializable meta: ${typeof meta}]`;
  }
}

function format(level, args) {
  const { domain, message, meta } = normalize(args);
  const parts = [`[${timestamp()}]`, `[${level}]`];
  if (domain) parts.push(`[${domain}]`);
  parts.push(typeof message === 'string' ? message : String(message));
  return parts.join(' ') + stringifyMeta(meta);
}

const logger = {
  info(...args) { console.log(format('INFO', args)); },
  warn(...args) { console.warn(format('WARN', args)); },
  error(...args) { console.error(format('ERROR', args)); },
  debug(...args) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(format('DEBUG', args));
    }
  },
};

export default logger;
