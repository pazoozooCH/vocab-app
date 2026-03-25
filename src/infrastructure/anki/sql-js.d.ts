declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new () => Database
  }
  interface Database {
    run(sql: string, params?: unknown[]): void
    export(): ArrayBuffer
    close(): void
  }
  interface InitSqlJsOptions {
    locateFile?: (file: string) => string
  }
  export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>
}
