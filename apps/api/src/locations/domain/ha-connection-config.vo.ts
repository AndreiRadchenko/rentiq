export interface HaConnectionConfigState {
  urlOrIp: string;
  token: string;
  autoLockDelaySeconds: number;
}

export class HaConnectionConfig {
  private readonly _urlOrIp: string;
  private readonly _token: string;
  private readonly _autoLockDelaySeconds: number;

  private constructor(urlOrIp: string, token: string, autoLockDelaySeconds: number) {
    this._urlOrIp = urlOrIp;
    this._token = token;
    this._autoLockDelaySeconds = autoLockDelaySeconds;
  }

  static create(state: HaConnectionConfigState): HaConnectionConfig {
    if (!state.urlOrIp || state.urlOrIp.trim().length === 0) {
      throw new Error('HaConnectionConfig: urlOrIp must not be empty');
    }
    if (!state.token || state.token.trim().length === 0) {
      throw new Error('HaConnectionConfig: token must not be empty');
    }
    if (!Number.isInteger(state.autoLockDelaySeconds) || state.autoLockDelaySeconds <= 0) {
      throw new Error('HaConnectionConfig: autoLockDelaySeconds must be a positive integer');
    }
    return new HaConnectionConfig(state.urlOrIp.trim(), state.token.trim(), state.autoLockDelaySeconds);
  }

  get url(): string {
    return this._urlOrIp;
  }

  get token(): string {
    return this._token;
  }

  get autoLockDelaySec(): number {
    return this._autoLockDelaySeconds;
  }

  equals(other: HaConnectionConfig): boolean {
    return (
      this._urlOrIp === other._urlOrIp &&
      this._token === other._token &&
      this._autoLockDelaySeconds === other.autoLockDelaySec
    );
  }

  toState(): HaConnectionConfigState {
    return {
      urlOrIp: this._urlOrIp,
      token: this._token,
      autoLockDelaySeconds: this._autoLockDelaySeconds,
    };
  }
}
