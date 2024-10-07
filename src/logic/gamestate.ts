import { Ticker } from "pixi.js";
import { Team, WormInstance } from "./teams";

interface GameRules {
    winWhenOneGroupRemains: boolean;
}

const PreRoundMs = 5000;
const RoundTimerMs = 60000;

export class InternalTeam implements Team {
    public readonly worms: WormInstance[];
    private nextWormStack: WormInstance[];

    constructor(private readonly team: Team, onHealthChange: () => void) {
        this.worms = team.worms.map(w => new WormInstance(w, team, onHealthChange));
        this.nextWormStack = [...this.worms];
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
    
    public popNextWorm(): WormInstance {
        // Clear any dead worms
        this.nextWormStack = this.nextWormStack.filter(w => w.health > 0);
        const [next] = this.nextWormStack.splice(0, 1);
        if (!next) {
            throw Error('Exhausted all worms from team');
        }
        this.nextWormStack.push(next);
        return next;
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

    private currentTeam?: InternalTeam;
    private readonly teams: InternalTeam[];
    private nextTeamStack: InternalTeam[];
    private remainingRoundTimeMs = 0;

    private roundOverAtTs = 0;
    private preRoundOverAtTs = 0;

    private stateIteration = 0;

    get remainingRoundTime() {
        return this.remainingRoundTimeMs;
    }

    get isPreRound() {
        return this.preRoundOverAtTs !== 0;
    }
    
    get activeTeam() {
        return this.currentTeam;
    }
    
    constructor(teams: Team[], private readonly rules: GameRules = { winWhenOneGroupRemains: false }) {
        if (teams.length < 1) {
            throw Error('Must have at least one team');
        }
        this.teams = teams.map((team) => new InternalTeam(team, () => {
            this.stateIteration++;
        }));
        this.nextTeamStack = [...this.teams];
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

    public update(ticker: Ticker) {
        if (this.remainingRoundTimeMs) {
            this.remainingRoundTimeMs = Math.min(0, this.remainingRoundTimeMs - ticker.deltaMS);
        }
        if (this.remainingRoundTimeMs === 0 && this.preRoundOverAtTs) {
            // Timer expired.
            this.preRoundOverAtTs = 0;
            this.roundOverAtTs = Date.now() + RoundTimerMs;
            this.remainingRoundTimeMs = RoundTimerMs;
        }
    }

    public advanceRound(): {nextTeam: InternalTeam, nextWorm: WormInstance}|{winningTeams: InternalTeam[]} {
        if (!this.currentTeam) {
            const [firstTeam] = this.nextTeamStack.splice(0, 1);
            this.currentTeam = firstTeam;
            return {
                nextTeam: this.currentTeam,
                // Team *should* have at least one healthy worm.
                nextWorm: this.currentTeam.popNextWorm(),
            }
        }
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
            } else if (this.currentTeam.health === 0) {
                // This is a draw
                return {
                    winningTeams: [],
                }
            }
        }
        this.stateIteration++;
        this.preRoundOverAtTs = Date.now() + PreRoundMs;

        return {
            nextTeam: this.currentTeam,
            // We should have already validated that this team has healthy worms.
            nextWorm: this.currentTeam.popNextWorm(),
        }
    }
}