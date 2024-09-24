export interface WormIdentity {
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
    // player
}

export function teamGroupToColorSet(group: TeamGroup) {
    switch (group) {
        case TeamGroup.Red:
            return { bg: 0xCC3333, fg: 0xBB5555 };
        case TeamGroup.Blue:
            return { bg: 0x2244CC, fg: 0x3366CC };
        default:
            return { bg: 0xCC00CC, fg: 0x111111 };
    }
}


interface GameRules {
    winWhenOneGroupRemains: boolean;
}

export class WormInstance {
    constructor(private readonly identity: WormIdentity, public readonly team: Team, private readonly onHealthUpdated: () => void) {

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

interface InternalTeam extends Team {
    worms: WormInstance[];
}

export class GameState {
    private currentTeam: InternalTeam;
    private readonly teams: InternalTeam[];
    private nextTeamStack: InternalTeam[];

    private stateIteration = 0;
    
    constructor(teams: Team[], private readonly rules: GameRules = { winWhenOneGroupRemains: false }) {
        if (teams.length < 1) {
            throw Error('Must have at least one team');
        }
        this.teams = teams.map((team) => ({
            ...team,
            worms: team.worms.map(w => new WormInstance(w, team, () => this.stateIteration++))
        }));
        this.nextTeamStack = [...this.teams.slice(1)];
        this.currentTeam = this.teams[0];
    }

    public getTeamByIndex(index: number) {
        return this.teams[index];
    }

    public getActiveTeams() {
        return this.teams.filter(t => t.worms.some(w => w.health > 0));
    }

    public get iteration(): number {
        return this.stateIteration;
    }

    public advanceRound(): {nextTeam: InternalTeam}|{winningTeams: InternalTeam[]} {
        const previousTeam = this.currentTeam;
        this.nextTeamStack.push(previousTeam);

        for (let index = 0; index < this.nextTeamStack.length; index++) {
            const nextTeam = this.nextTeamStack[index];
            if (nextTeam.group === previousTeam.group) {
                continue;
            }
            if (nextTeam.worms.some(w => w.health > 0)) {
                this.nextTeamStack.splice(index, 1);
                this.currentTeam = nextTeam;
            }
        }
        // We wrapped around.
        if (this.currentTeam === previousTeam) {
            if (this.rules.winWhenOneGroupRemains) {
                this.stateIteration++;
                // All remaining teams are part of the same group
                return { 
                    winningTeams: this.getActiveTeams(),
                }
            }
        }
        this.stateIteration++;

        return {
            nextTeam: this.currentTeam,
        }
    }

}