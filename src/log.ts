export enum LogLevel {
  Verbose = 0,
  Debug = 1,
  Info = 2,
  Warning = 3,
  Error = 4,
}

export default class Logger {
  public static parseLogLevel(level: string | null): LogLevel | undefined {
    switch (level?.toLocaleLowerCase()) {
      case "verbose":
        return LogLevel.Verbose;
      case "debug":
        return LogLevel.Verbose;
      case "info":
        return LogLevel.Verbose;
      case "warning":
        return LogLevel.Verbose;
      case "error":
        return LogLevel.Verbose;
      default:
        return undefined;
    }
  }

  public static LogLevel = LogLevel.Info;
  constructor(private readonly moduleName: string) {}

  public verbose(...info: unknown[]) {
    if (Logger.LogLevel > LogLevel.Verbose) {
      return;
    }
    console.debug(
      `%c[${this.moduleName}]`,
      "color: yellow; background-color: black; font-weight: 600;",
      ...info,
    );
  }

  public debug(...info: unknown[]) {
    if (Logger.LogLevel > LogLevel.Debug) {
      return;
    }
    console.debug(
      `%c[${this.moduleName}]`,
      "color: lightblue; background-color: black; font-weight: 600;",
      ...info,
    );
  }

  public info(...info: unknown[]) {
    if (Logger.LogLevel > LogLevel.Info) {
      return;
    }
    console.debug(
      `%c[${this.moduleName}]`,
      "color: green; background-color: black; font-weight: 600;",
      ...info,
    );
  }

  public warning(...info: unknown[]) {
    if (Logger.LogLevel > LogLevel.Warning) {
      return;
    }
    console.warn(
      `%c[${this.moduleName}]`,
      "color: white; background-color: black; font-weight: 600;",
      ...info,
    );
  }

  public error(...info: unknown[]) {
    console.error(
      `%c[${this.moduleName}]`,
      "color: white; background-color: black; font-weight: 600;",
      ...info,
    );
  }
}
