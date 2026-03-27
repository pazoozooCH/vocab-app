declare module 'sql.js' {
  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number>) => Database
  }
  interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }
  interface Database {
    run(sql: string, params?: unknown[]): void
    exec(sql: string): QueryExecResult[]
    export(): ArrayBuffer
    close(): void
  }
  interface InitSqlJsOptions {
    locateFile?: (file: string) => string
  }
  export default function initSqlJs(options?: InitSqlJsOptions): Promise<SqlJsStatic>
}
