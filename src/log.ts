export enum LogLevels {
  Verbose = 0,
  Debug = 1,
  Info = 2,
  Warning = 3,
  Error = 4,
}

export default class Logger {
  public static LogLevel = LogLevels.Verbose;
  constructor(private readonly moduleName: string) {}

  public verbose(...info: unknown[]) {
    if (Logger.LogLevel > LogLevels.Verbose) {
      return;
    }
    console.debug(
      `%c[${this.moduleName}]`,
      "color: yellow; background-color: black; font-weight: 600;",
      ...info,
    );
  }

  public debug(...info: unknown[]) {
    if (Logger.LogLevel > LogLevels.Debug) {
      return;
    }
    console.debug(
      `%c[${this.moduleName}]`,
      "color: lightblue; background-color: black; font-weight: 600;",
      ...info,
    );
  }

  public info(...info: unknown[]) {
    if (Logger.LogLevel > LogLevels.Info) {
      return;
    }
    console.debug(
      `%c[${this.moduleName}]`,
      "color: green; background-color: black; font-weight: 600;",
      ...info,
    );
  }

  public warning(...info: unknown[]) {
    if (Logger.LogLevel > LogLevels.Warning) {
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
