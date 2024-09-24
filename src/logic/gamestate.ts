export interface WormIdentity {
    name: string;
    health: number;
    maxHealth: number;
}

export enum TeamGroup {
    Red = 1,
    Blue = 2,
    Green = 3,
    Yellow = 4,
    Purple = 5,
    Orange = 6,
}

export interface Team {
    name: string;
    group: TeamGroup;
    worms: WormIdentity[]
    // player
}

interface GameRules {
    winWhenOneGroupRemains: boolean;
}

export class WormInstance {
    constructor(private readonly identity: WormIdentity, private readonly onHealthUpdated: () => void) {

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
            worms: team.worms.map(w => new WormInstance(w, () => this.stateIteration++))
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