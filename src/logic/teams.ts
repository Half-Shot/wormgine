import { ColorSource } from "pixi.js";

export interface WormIdentity {
    uuid?: string;
    name: string;
    health: number;
    maxHealth: number;
}

export enum TeamGroup {
    Red,
    Blue,
    Green,
    Yellow,
    Purple,
    Orange,
}

export interface Team {
    name: string;
    group: TeamGroup;
    worms: WormIdentity[]
    // For net games only
    playerUserId: string|null,
}

export function teamGroupToColorSet(group: TeamGroup): {bg: ColorSource, fg: ColorSource } {
    switch (group) {
        case TeamGroup.Red:
            return { bg: 0xCC3333, fg: 0xBB5555 };
        case TeamGroup.Blue:
            return { bg: 0x2244CC, fg: 0x3366CC };
        default:
            return { bg: 0xCC00CC, fg: 0x111111 };
    }
}

/**
 * Instance of a worm, keeping track of it's status.
 */
export class WormInstance {
    public readonly uuid;
    constructor(private readonly identity: WormIdentity, public readonly team: Team, private readonly onHealthUpdated: () => void) {
        this.uuid = identity.uuid ?? globalThis.crypto.randomUUID();
    }


    get name() {
        return this.identity.name;
    }

    get maxHealth() {
        return this.identity.maxHealth;
    }

    get health() {
        return this.identity.health;
    }

    set health(health: number) {
        this.identity.health = health;
        this.onHealthUpdated();
    }
}