import { ColorSource, Container, Graphics, Text, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { GameState } from "../logic/gamestate";
import { applyGenericBoxStyle, DefaultTextStyle } from "../mixins/styles";
import { teamGroupToColorSet } from "../logic/teams";
import { GameWorld, MAX_WIND } from "../world";

interface Toast {
    text: string;
    timer: number;
    color: ColorSource;
    interruptable: boolean;
}


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
    private currentToastIsInterruptable = true;
    private toaster: Toast[] = [];
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
                ...DefaultTextStyle,
                fontSize: 64,
                align: 'center',
            },
        });
        this.toastBox = new Text({
            text: '',
            style: {
                ...DefaultTextStyle,
                fontSize: 48,
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
     * @param text The text notice.
     * @param timer How long should the notice be displayed.
     * @param color The colour of the text.
     * @param interruptable Should the toast be interrupted by the next notice?
     */
    public addNewToast(text: string, timer = 5000, color: ColorSource = '#FFFFFF', interruptable = false) {
        this.toaster.splice(0,0, { text, timer, color, interruptable });
    }

    private update(dt: Ticker) {
        const centerX = this.screenWidth / 2;
        if (this.healthChangeTensionTimer && !this.gameWorld.areEntitiesMoving()) {
            this.healthChangeTensionTimer -= dt.deltaTime;
        }

        const shouldChangeTeamHealth = this.healthChangeTensionTimer !== null && this.healthChangeTensionTimer <= 0;

        const shouldInterrupt = this.currentToastIsInterruptable && this.toaster.length;
        if (!this.toastBox.text || shouldInterrupt) {
            const newToast = this.toaster.pop();
            if (newToast) {
                this.toastGfx.clear();
                this.toastBox.text = newToast.text;
                this.toastBox.style.fill = newToast.color;
                this.toastTime = newToast.timer;
                this.currentToastIsInterruptable = newToast.interruptable;
                this.toastGfx.position.set(
                    (this.screenWidth / 2) - (this.toastBox.width /2) - 6,
                    (this.screenHeight / 20) - (this.toastBox.height/2) - 4,
                )
                applyGenericBoxStyle(this.toastGfx).roundRect(0, 0, this.toastBox.width + 12, this.toastBox.height + 8, 4).stroke().fill();
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


        this.roundTimer.text = Math.floor(this.gameState.remainingRoundTime/1000);
        const bottomY = (this.screenHeight / 10) * 9;
        this.gfx.clear();

        // Remove any previous text.
        this.gfx.removeChildren(0, this.gfx.children.length);
        const currentTeamColors = this.gameState.activeTeam ? teamGroupToColorSet(this.gameState.activeTeam?.group) : { fg: 0xAAAAAA };

        // Round timer
        applyGenericBoxStyle(this.gfx, currentTeamColors.fg).roundRect(this.roundTimer.x - 8, this.roundTimer.y - 8, this.roundTimer.width + 16, this.roundTimer.height + 16, 4).stroke().fill();

        // Wind
        const windX = ((this.screenWidth / 20) * 16) + 14;
        const windY = ((this.screenHeight / 10) * 9) + 12;
        applyGenericBoxStyle(this.gfx).roundRect(
            windX, 
            windY,
            200,
            25,
            4
        ).stroke().fill();

        const windScale = this.gameWorld.wind / MAX_WIND;
        applyGenericBoxStyle(this.gfx).roundRect(
            (windScale >= 0 ? (windX + 100) : ((windX + 100) + (100*windScale))) + 2, 
            windY + 2,
            96 * Math.abs(windScale),
            21,
            4
        ).fill({ color: windScale > 0 ? 0xEE3333 : 0x3333EE });

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
                    ...DefaultTextStyle,
                    fontSize: 28,
                    align: 'center',
                }
            });
            const border = team === this.gameState.activeTeam ? 0xFFFFFF : undefined;
            const nameTagStartX = centerX - nameTag.width - 120;
            applyGenericBoxStyle(this.gfx, border).roundRect(nameTagStartX - 3, teamBottomY-2, nameTag.width + 6, nameTag.height + 4, 4).stroke().fill();
            nameTag.position.set(nameTagStartX, teamBottomY);
            applyGenericBoxStyle(this.gfx, border).roundRect(centerX - 102, teamBottomY-2, 204, 24, 4).stroke().fill();
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