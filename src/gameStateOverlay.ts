import { Container, Graphics, Text, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { GameState, TeamGroup } from "./logic/gamestate";


export class GameStateOverlay {

    static teamGroupToColorSet(group: TeamGroup) {
        switch (group) {
            case TeamGroup.Red:
                return { bg: 0xCC3333, fg: 0xBB5555 }
            default:
                return { bg: 0xCC00CC, fg: 0x111111 }
        }
    }

    public readonly physicsSamples: number[] = [];
    private readonly text: Text;
    private readonly tickerFn: (dt: Ticker) => void;
    private readonly gfx: Graphics;
    private previousStateIteration = -1;

    constructor(
        private readonly ticker: Ticker,
        private readonly stage: Container,
        private readonly gameState: GameState,
        private readonly screenWidth: number,
        private readonly screenHeight: number,
    ) {
        this.text = new Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 20,
                fill: 0xFFFFFF,
                align: 'center',
            },
        });
        this.gfx = new Graphics();
        this.tickerFn = this.update.bind(this);
        this.stage.addChild(this.text);
        this.stage.addChild(this.gfx);
        this.ticker.add(this.tickerFn, undefined, UPDATE_PRIORITY.UTILITY);
    }

    private update(dt: Ticker) {
        if (this.previousStateIteration === this.gameState.iteration) {
            return;
        }
        this.previousStateIteration = this.gameState.iteration;
        const centerX = this.screenWidth / 2;
        const bottomY = (this.screenHeight / 10) * 9;
        this.gfx.clear();

        // For each team:
        // TODO: Sort by health and group
        // TODO: Evenly space.
        for (const team of this.gameState.getActiveTeams()) {
            const teamHealthPercentage = Math.ceil(team.worms.map(w => w.health).reduce((a,b) => a + b) / team.worms.map(w => w.maxHealth).reduce((a,b) => a + b) * 100)/100;

            console.log('Redrawing game UI', teamHealthPercentage, this.gameState.iteration);
            // TODO: Draw team name.
            this.gfx.setStrokeStyle({
                width: 5,
                color: 0xBB5555,
                cap: 'butt',
                join: 'round',
            }).setFillStyle({ color: 0xCC3333}).rect(centerX - 100, bottomY, 200 * teamHealthPercentage, 20).fill().stroke();
            this.gfx.setStrokeStyle({
                width: 2,
                color: 0xAAAAAA,
                cap: 'butt',
                join: 'round',
            }).setFillStyle({ color: 0xAAAAAA, alpha: 0.1}).rect(centerX - 102, bottomY-2, 204, 24).stroke().fill() 
        }
    }
}