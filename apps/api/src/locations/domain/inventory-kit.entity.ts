export interface InventoryKitState {
  id: string;
  stationId: string;
  lockerId: string | null;
  name: string;
  kitType: string;
  createdAt: Date;
}

export interface CreateInventoryKitInput {
  id: string;
  stationId: string;
  name: string;
  kitType: string;
}

export class InventoryKit {
  private constructor(private readonly state: InventoryKitState) {}

  static create(input: CreateInventoryKitInput): InventoryKit {
    if (!input.name.trim()) throw new Error('InventoryKit name must not be empty');
    if (!input.kitType.trim()) throw new Error('InventoryKit kitType must not be empty');
    return new InventoryKit({
      id: input.id,
      stationId: input.stationId,
      lockerId: null,
      name: input.name.trim(),
      kitType: input.kitType.trim(),
      createdAt: new Date(),
    });
  }

  static reconstitute(state: InventoryKitState): InventoryKit {
    return new InventoryKit({ ...state });
  }

  get id(): string {
    return this.state.id;
  }

  get stationId(): string {
    return this.state.stationId;
  }

  get currentState(): InventoryKitState {
    return { ...this.state };
  }

  get kitType(): string {
    return this.state.kitType;
  }

  get lockerId(): string | null {
    return this.state.lockerId;
  }

  reassignTo(lockerId: string | null): void {
    this.state.lockerId = lockerId;
  }

  update(patch: Partial<Pick<InventoryKitState, 'name' | 'kitType'>>): void {
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new Error('InventoryKit name must not be empty');
      this.state.name = patch.name.trim();
    }
    if (patch.kitType !== undefined) {
      if (!patch.kitType.trim()) throw new Error('InventoryKit kitType must not be empty');
      this.state.kitType = patch.kitType.trim();
    }
  }

  retire(): void {
    this.state.lockerId = null;
  }
}
