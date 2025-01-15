import { GameRules, GameState, RoundState } from "../logic/gamestate";
import { StateRecorder } from "../state/recorder";
import { GameWorld } from "../world";
import { Team } from "../logic/teams";
import { StateRecordWormGameState } from "../state/model";

export class NetGameState extends GameState {
    get clientActive() {
        return this.activeTeam?.playerUserId === this.myUserId;
    }

    get peekNextTeam() {
        for (let index = 0; index < this.nextTeamStack.length; index++) {
            const nextTeam = this.nextTeamStack[index];
            if (nextTeam.group === this.currentTeam?.group) {
              continue;
            }
            if (nextTeam.worms.some((w) => w.health > 0)) {
              return nextTeam;
            }
        }
        return null;
    }

    get peekNextPlayer() {
        return this.peekNextTeam?.playerUserId;
    }

    constructor(teams: Team[], world: GameWorld, rules: GameRules, private readonly recorder: StateRecorder, private readonly myUserId: string) {
        super(teams, world, rules);
    }

    protected networkSelectNextTeam() {
        if (!this.currentTeam) {
            const [firstTeam] = this.nextTeamStack.splice(0, 1);
            this.currentTeam = firstTeam;
            return;
        }
        const previousTeam = this.currentTeam;
        this.nextTeamStack.push(previousTeam);

        for (let index = 0; index < this.nextTeamStack.length; index++) {
            const nextTeam = this.nextTeamStack[index];
            if (nextTeam.group === previousTeam.group) {
                continue;
            }
            if (nextTeam.worms.some((w) => w.health > 0)) {
                this.nextTeamStack.splice(index, 1);
                this.currentTeam = nextTeam;
            }
        }
    }

    public applyGameStateUpdate(stateUpdate: StateRecordWormGameState["data"]) {
        let index = -1;
        for (const teamData of stateUpdate.teams) {
            index++;
            const teamWormSet = this.teams.get(teamData.uuid)?.worms;
            if (!teamWormSet) {
                throw new Error(`Missing local team data for team ${teamData.uuid}`);
            }
            for (const wormData of teamData.worms) {
                const foundWorm = teamWormSet.find((w) => w.uuid === wormData.uuid);
                if (foundWorm) {
                    foundWorm.health = wormData.health;
                }
            }
        }
        if (this.roundState !== RoundState.Preround && stateUpdate.round_state === RoundState.Preround) {
            this.remainingRoundTimeMs = 5000;
        }
        this.roundState = stateUpdate.round_state;
        console.log("beep >", stateUpdate.round_state);
        this.wind = stateUpdate.wind;
        if (this.roundState === RoundState.WaitingToBegin) {
            this.networkSelectNextTeam();
        }
    }

    protected recordGameStare() {
        if (!this.clientActive) {
            console.log("Not active client");
            return;
        }
        const iteration = this.iteration;
        const teams = this.getTeams();
        this.recorder.recordGameState({
            round_state: this.roundState,
            iteration: iteration,
            wind: this.currentWind,
            teams: teams.map((t) => ({
                uuid: t.uuid,
                worms: t.worms.map((w) => ({
                    uuid: w.uuid,
                    name: w.name,
                    health: w.health,
                    maxHealth: w.maxHealth,
                })),
                ammo: t.ammo,
            })),
        });
    }
}