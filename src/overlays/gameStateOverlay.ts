import { ColorSource, Container, Graphics, Text, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { GameState } from "../logic/gamestate";
import { applyGenericBoxStyle } from "../mixins/styles";
import { teamGroupToColorSet } from "../logic/teams";
import { GameWorld } from "../world";


export class GameStateOverlay {
    public readonly physicsSamples: number[] = [];
    private readonly roundTimer: Text;
    private readonly tickerFn: (dt: Ticker) => void;
    private readonly toastGfx: Graphics;
    private readonly gfx: Graphics;
    private previousStateIteration = -1;
    private visibleTeamHealth: Record<string, number> = {};
    private healthChangeTensionTimer: number|null = null;
    private readonly largestHealthPool: number;

    private toastTime = 0;
    private toaster: {text: string, timer: number, color: ColorSource}[] = [];
    private readonly toastBox: Text;

    constructor(
        private readonly ticker: Ticker,
        private readonly stage: Container,
        private readonly gameState: GameState,
        private readonly gameWorld: GameWorld,
        private readonly screenWidth: number,
        private readonly screenHeight: number,
    ) {
        const topY = this.screenHeight / 20;
        this.roundTimer = new Text({
            text: '60',
            style: {
                fontFamily: 'Arial',
                fontSize: 48,
                fill: 0xFFFFFF,
                align: 'center',
            },
        });
        this.toastBox = new Text({
            text: '',
            style: {
                fontFamily: 'Arial',
                fontSize: 24,
                fill: 0xFFFFFF,
                align: 'center',
            },
        });
        this.toastBox.position.set(this.screenWidth / 2, topY);
        this.toastBox.anchor.set(0.5, 0.5);
        this.roundTimer.position.set((this.screenWidth / 30) + 14, ((this.screenHeight / 10) * 9) + 12);
        this.gfx = new Graphics();
        this.toastGfx = new Graphics();
        this.stage.addChild(this.gfx);
        this.stage.addChild(this.roundTimer);
        this.stage.addChild(this.toastGfx);
        this.stage.addChild(this.toastBox);
        this.tickerFn = this.update.bind(this);
        this.ticker.add(this.tickerFn, undefined, UPDATE_PRIORITY.UTILITY);
        this.largestHealthPool = this.gameState.getTeams().reduceRight((value, team) => Math.max(value, team.maxHealth) , 0);
        this.gameState.getActiveTeams().forEach((t) => {
            this.visibleTeamHealth[t.name] = t.health;
        });
    }

    /**
     * Adds some text to be displayed at the top of the screen.
     * @param text 
     * @param timer 
     */
    public addNewToast(text: string, timer = 5000, color: ColorSource = '#FFFFFF') {
        this.toaster.splice(0,0, { text, timer, color });
    }

    private update(dt: Ticker) {
        const centerX = this.screenWidth / 2;
        if (this.healthChangeTensionTimer && !this.gameWorld.areEntitiesMoving()) {
            this.healthChangeTensionTimer -= dt.deltaTime;
        }

        const shouldChangeTeamHealth = this.healthChangeTensionTimer !== null && this.healthChangeTensionTimer <= 0;

        if (!this.toastBox.text) {
            const newToast = this.toaster.pop();
            if (newToast) {
                this.toastGfx.clear();
                this.toastBox.text = newToast.text;
                this.toastBox.style.fill = newToast.color;
                this.toastTime = newToast.timer;
                this.toastGfx.position.set(
                    (this.screenWidth / 2) - (this.toastBox.width /2) - 3,
                    (this.screenHeight / 20) - (this.toastBox.height/2) - 2,
                )
                applyGenericBoxStyle(this.toastGfx).roundRect(0, 0, this.toastBox.width + 6, this.toastBox.height + 4, 4).stroke().fill();
            }
        }


        if (this.toastBox.text) {
            // Render toast
            this.toastTime -= dt.deltaMS;
            if (this.toastTime <= 0) {
                this.toastBox.text = '';
                this.toastTime = 0;
                this.toastGfx.clear();
            }
        }
        
        if (this.previousStateIteration === this.gameState.iteration && !shouldChangeTeamHealth) {
            return;
        }
        this.previousStateIteration = this.gameState.iteration;

        // TODO: Could the gameState flag this explicitly.
        // Check for health change.
        if (this.healthChangeTensionTimer === null) {
            for (const team of this.gameState.getTeams()) {
                if (this.visibleTeamHealth[team.name] === undefined) {
                    continue;
                }
                if (this.visibleTeamHealth[team.name] !== team.health) {
                    // TODO: Const, same as the one for Playable.
                    this.healthChangeTensionTimer = 75;
                    return;
                }
            }
        }


        this.roundTimer.text = Math.floor(this.gameState.roundTimer/1000);
        const bottomY = (this.screenHeight / 10) * 9;
        this.gfx.clear();

        // Remove any previous text.
        this.gfx.removeChildren(0, this.gfx.children.length);


        const leftX = (this.screenWidth / 30);

        // Round timer
        applyGenericBoxStyle(this.gfx).roundRect(leftX, bottomY-2, 84, 84, 4).stroke().fill();

        // For each team:
        // TODO: Sort by health and group
        // TODO: Evenly space.
        let allHealthAccurate = true;
        let teamBottomY = bottomY;
        for (const team of this.gameState.getActiveTeams()) {
            if (this.visibleTeamHealth[team.name] > team.health && shouldChangeTeamHealth) {
                this.visibleTeamHealth[team.name] -= 1;
                allHealthAccurate = false;
            }
            const teamHealthPercentage = this.visibleTeamHealth[team.name] / this.largestHealthPool;
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
            applyGenericBoxStyle(this.gfx).roundRect(nameTagStartX - 3, teamBottomY-2, nameTag.width + 6, nameTag.height + 4, 4).stroke().fill();
            nameTag.position.set(nameTagStartX, teamBottomY);
            // TODO: Draw team name.
            applyGenericBoxStyle(this.gfx).roundRect(centerX - 102, teamBottomY-2, 204, 24, 4).stroke().fill();
            this.gfx.setStrokeStyle({
                width: 5,
                color: fg,
                cap: 'butt',
                join: 'round',
            }).setFillStyle({ color: bg }).roundRect(centerX - 100, teamBottomY, 200 * teamHealthPercentage, 20, 4).fill();
            this.gfx.addChild(nameTag);
            teamBottomY += 30;
        }

        if (allHealthAccurate) {
            this.healthChangeTensionTimer = null;
        }
    }
}