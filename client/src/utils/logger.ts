export const logger = {
  info: console.log.bind(console, "[INFO]"),
  error: console.error.bind(console, "[ERROR]"),
  debug: console.debug.bind(console, "[DEBUG]"),
};