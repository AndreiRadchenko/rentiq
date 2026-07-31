export type Result<T, E> = Ok<T> | Err<E>;

export class Ok<T> {
  readonly _tag = 'Ok' as const;

  constructor(readonly value: T) {}

  isOk(): this is Ok<T> {
    return true;
  }

  isErr(): this is never {
    return false;
  }

  unwrap(): T {
    return this.value;
  }

  map<U>(fn: (value: T) => U): Result<U, never> {
    return new Ok(fn(this.value));
  }

  flatMap<U, F>(fn: (value: T) => Result<U, F>): Result<U, F> {
    return fn(this.value);
  }
}

export class Err<E> {
  readonly _tag = 'Err' as const;

  constructor(readonly error: E) {}

  isOk(): this is never {
    return false;
  }

  isErr(): this is Err<E> {
    return true;
  }

  unwrap(): never {
    throw new Error(`Called unwrap on Err: ${this.error}`);
  }

  map<U>(_fn: (value: never) => U): Result<U, E> {
    return new Err(this.error);
  }

  flatMap<U, F>(_fn: (value: never) => Result<U, F>): Result<never, E | F> {
    return new Err(this.error);
  }
}

export function ok<T>(value: T): Ok<T> {
  return new Ok(value);
}

export function err<E>(error: E): Err<E> {
  return new Err(error);
}
