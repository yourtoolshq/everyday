import { AsyncLocalStorage } from "node:async_hooks";
import type {
  Client,
  InStatement,
  Replicated,
  ResultSet,
  Transaction,
  TransactionMode,
} from "@libsql/client";

export interface ExclusiveAccess {
  close: () => void;
  open: () => Client;
}

// Holds new work while exclusive() runs so the database file can be swapped underneath
// the drizzle instance that wraps this client.
export class PausableClient implements Client {
  readonly protocol = "file";
  closed = false;
  #open: () => Client;
  #client: Client;
  #active = 0;
  #idle: (() => void) | undefined;
  #paused: Promise<void> | undefined;
  #guarded = new AsyncLocalStorage<true>();

  constructor(open: () => Client) {
    this.#open = open;
    this.#client = open();
  }

  execute(stmt: InStatement): Promise<ResultSet> {
    return this.#run((client) => client.execute(stmt));
  }

  batch(stmts: InStatement[], mode?: TransactionMode) {
    return this.#run((client) => client.batch(stmts, mode));
  }

  migrate(stmts: InStatement[]) {
    return this.#run((client) => client.migrate(stmts));
  }

  executeMultiple(sql: string) {
    return this.#run((client) => client.executeMultiple(sql));
  }

  sync(): Promise<Replicated> {
    return this.#run((client) => client.sync());
  }

  async transaction(mode?: TransactionMode): Promise<Transaction> {
    await this.#enter();
    try {
      return this.#track(await this.#client.transaction(mode));
    } catch (error) {
      this.#leave();
      throw error;
    }
  }

  close() {
    this.closed = true;
    this.#client.close();
  }

  // Work started inside guard() is never held by a pause, so exclusive() waits for all of it.
  async guard<T>(work: () => Promise<T>): Promise<T> {
    await this.#enter();
    try {
      return await this.#guarded.run(true, work);
    } finally {
      this.#leave();
    }
  }

  async exclusive<T>(
    fn: (access: ExclusiveAccess) => Promise<T>,
    options: { drainTimeoutMs?: number } = {},
  ): Promise<T> {
    let release!: () => void;
    this.#paused = new Promise((resolve) => (release = resolve));
    try {
      await this.#drain(options.drainTimeoutMs ?? 30_000);
      return await fn({
        close: () => {
          if (!this.#client.closed) this.#client.close();
        },
        open: () => (this.#client = this.#open()),
      });
    } finally {
      if (this.#client.closed) this.#client = this.#open();
      this.#paused = undefined;
      release();
    }
  }

  async #run<T>(fn: (client: Client) => Promise<T>) {
    await this.#enter();
    try {
      return await fn(this.#client);
    } finally {
      this.#leave();
    }
  }

  async #enter() {
    while (this.#paused && !this.#guarded.getStore()) await this.#paused;
    this.#active += 1;
  }

  #leave() {
    this.#active -= 1;
    if (this.#active === 0) this.#idle?.();
  }

  async #drain(timeoutMs: number) {
    if (this.#active === 0) return;
    let timer: NodeJS.Timeout | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        this.#idle = resolve;
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `Timed out after ${timeoutMs} ms waiting for database work to finish`,
              ),
            ),
          timeoutMs,
        );
      });
    } finally {
      clearTimeout(timer);
      this.#idle = undefined;
    }
  }

  #track(tx: Transaction): Transaction {
    let settled = false;
    const settle = () => {
      if (settled || !tx.closed) return;
      settled = true;
      this.#leave();
    };
    return {
      execute: (stmt: InStatement) => tx.execute(stmt),
      batch: (stmts: InStatement[]) => tx.batch(stmts),
      executeMultiple: (sql: string) => tx.executeMultiple(sql),
      async commit() {
        try {
          await tx.commit();
        } finally {
          settle();
        }
      },
      async rollback() {
        try {
          await tx.rollback();
        } finally {
          settle();
        }
      },
      close() {
        try {
          tx.close();
        } finally {
          settle();
        }
      },
      get closed() {
        return tx.closed;
      },
    };
  }
}
