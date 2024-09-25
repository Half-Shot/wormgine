import { Team, TeamGroup, WormIdentity, WormInstance } from "./teams";

interface GameRules {
    winWhenOneGroupRemains: boolean;
}

export class InternalTeam implements Team {
    public readonly worms: WormInstance[];

    constructor(private readonly team: Team, onHealthChange: () => void) {
        this.worms = team.worms.map(w => new WormInstance(w, team, onHealthChange));
    }

    get name() {
        return this.team.name;
    }

    get group() {
        return this.team.group;
    }

    get health() {
        return this.worms.map(w => w.health).reduce((a,b) => a + b);
    }

    get maxHealth() {
        return this.worms.map(w => w.maxHealth).reduce((a,b) => a + b);
    }
}
export class GameState {
    static getTeamMaxHealth(team: Team) {
        return  team.worms.map(w => w.maxHealth).reduce((a,b) => a + b);
    }

    static getTeamHealth(team: Team) {
        return team.worms.map(w => w.health).reduce((a,b) => a + b);
    }

    static getTeamHealthPercentage(team: Team) {
        return Math.ceil(team.worms.map(w => w.health).reduce((a,b) => a + b) / team.worms.map(w => w.maxHealth).reduce((a,b) => a + b) * 100)/100;
    }

    private currentTeam: InternalTeam;
    private readonly teams: InternalTeam[];
    private nextTeamStack: InternalTeam[];
    private currentRoundTime = 42000;

    private stateIteration = 0;

    get roundTimer() {
        return this.currentRoundTime;
    }
    
    constructor(teams: Team[], private readonly rules: GameRules = { winWhenOneGroupRemains: false }) {
        if (teams.length < 1) {
            throw Error('Must have at least one team');
        }
        this.teams = teams.map((team) => new InternalTeam(team, () => {
            this.stateIteration++;
        }));
        this.nextTeamStack = [...this.teams.slice(1)];
        this.currentTeam = this.teams[0];
    }

    public getTeamByIndex(index: number) {
        return this.teams[index];
    }

    public getTeams() {
        return this.teams;
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