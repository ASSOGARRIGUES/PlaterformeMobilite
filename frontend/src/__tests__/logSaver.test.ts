import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import logSaver from '../logSaver';

describe('LogSaver', () => {
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalLog = console.log;
    originalError = console.error;
    originalWarn = console.warn;
    logSaver.logs = [];
    logSaver.isOverriden = false;
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  it('starts with empty logs', () => {
    expect(logSaver.getLogs()).toEqual([]);
    expect(logSaver.hasLogs()).toBe(false);
  });

  it('overrideConsole captures console.log', () => {
    logSaver.overrideConsole();
    console.log('hello');
    expect(logSaver.hasLogs()).toBe(true);
    expect(logSaver.getLogs()[0]).toContain('[LOG]');
    expect(logSaver.getLogs()[0]).toContain('hello');
  });

  it('overrideConsole captures console.error', () => {
    logSaver.overrideConsole();
    console.error('oops');
    expect(logSaver.getLogs()[0]).toContain('[ERROR]');
    expect(logSaver.getLogs()[0]).toContain('oops');
  });

  it('overrideConsole captures console.warn', () => {
    logSaver.overrideConsole();
    console.warn('careful');
    expect(logSaver.getLogs()[0]).toContain('[WARN]');
    expect(logSaver.getLogs()[0]).toContain('careful');
  });

  it('overrideConsole is idempotent', () => {
    logSaver.overrideConsole();
    const logAfterFirst = console.log;
    logSaver.overrideConsole();
    expect(console.log).toBe(logAfterFirst);
  });

  it('accumulates multiple log entries', () => {
    logSaver.overrideConsole();
    console.log('first');
    console.log('second');
    expect(logSaver.getLogs()).toHaveLength(2);
  });

  it('getLogsAsFile returns a Blob with text/plain type', () => {
    logSaver.overrideConsole();
    console.log('test');
    const blob = logSaver.getLogsAsFile();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('text/plain');
  });
});
