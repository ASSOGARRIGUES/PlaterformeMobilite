
class LogSaver {
    logs: string[] = [];
    isOverriden: boolean = false;

    constructor() {
        this.logs = [];
        this.isOverriden = false;
    }


    overrideConsole() {
        if(this.isOverriden) return;

        this.isOverriden = true;

        const originalConsoleLog = console.log;
        console.log = (...args: any[]) => {
            originalConsoleLog.apply(console, args);
            this.logs.push("[LOG]:"+args.map(arg => JSON.stringify(arg)).join(' '));
        }

        const originalConsoleError = console.error;
        console.error = (...args: any[]) => {
            originalConsoleError.apply(console, args);
            this.logs.push("[ERROR]:"+args.map(arg => JSON.stringify(arg)).join(' '));
        }

        const originalConsoleWarn = console.warn;
        console.warn = (...args: any[]) => {
            originalConsoleWarn.apply(console, args);
            this.logs.push("[WARN]:"+args.map(arg => JSON.stringify(arg)).join(' '));
        }
    }

    getLogs() {
        return this.logs;
    }

    getLogsAsFile() {
        return new Blob([this.logs.join('\n')], {type: 'text/plain'});
    }

    hasLogs() {
        return this.logs.length > 0;
    }
}

const logSaver = new LogSaver();

export default logSaver;
