import { Container, Graphics, Text, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { GameState } from "../logic/gamestate";
import { applyGenericBoxStyle } from "../mixins/styles";
import { teamGroupToColorSet } from "../logic/teams";


export class GameStateOverlay {
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

    private update() {
        if (this.previousStateIteration === this.gameState.iteration) {
            return;
        }
        this.previousStateIteration = this.gameState.iteration;
        const centerX = this.screenWidth / 2;
        const bottomY = (this.screenHeight / 10) * 9;
        this.gfx.clear();
        this.gfx.removeChildren(0, this.gfx.children.length);

        // For each team:
        // TODO: Sort by health and group
        // TODO: Evenly space.
        for (const team of this.gameState.getActiveTeams()) {
            const teamHealthPercentage = Math.ceil(team.worms.map(w => w.health).reduce((a,b) => a + b) / team.worms.map(w => w.maxHealth).reduce((a,b) => a + b) * 100)/100;
            const {bg, fg} = teamGroupToColorSet(team.group);
            const nameTag = new Text({
                text: team.name,
                style: {
                    fontFamily: 'Arial',
                    fontSize: 18,
                    fill: 0xFFFFFF,
                    align: 'center',
                }
            });
            
            const nameTagStartX = centerX - nameTag.width - 120;
            // const nameTagStartY = bottomY - (nameTag.height / 10);
            applyGenericBoxStyle(this.gfx).roundRect(nameTagStartX - 3, bottomY-2, nameTag.width + 6, nameTag.height + 4, 4).stroke().fill();
            nameTag.position.set(nameTagStartX, bottomY);
            // TODO: Draw team name.
            applyGenericBoxStyle(this.gfx).roundRect(centerX - 102, bottomY-2, 204, 24, 4).stroke().fill();
            this.gfx.setStrokeStyle({
                width: 5,
                color: fg,
                cap: 'butt',
                join: 'round',
            }).setFillStyle({ color: bg }).roundRect(centerX - 100, bottomY, 200 * teamHealthPercentage, 20, 4).fill();
            this.gfx.addChild(nameTag);
        }
    }
}