import { Container, Graphics, Text, Ticker, UPDATE_PRIORITY } from "pixi.js";
import { GameState } from "../logic/gamestate";
import {
  applyGenericBoxStyle,
  DefaultTextStyle,
  LargeTextStyle,
} from "../mixins/styles";
import { teamGroupToColorSet } from "../logic/teams";
import { GameWorld } from "../world";
import { Toaster } from "./toaster";
import { WindDial } from "./windDial";
import { HEALTH_CHANGE_TENSION_TIMER } from "../consts";
import Logger from "../log";

const logger = new Logger("GameStateOverlay");

const TEAM_HEALTH_WIDTH_PX = 204;

export class GameStateOverlay {
  public readonly physicsSamples: number[] = [];
  private readonly roundTimer: Text;
  private readonly tickerFn: (dt: Ticker) => void;
  private readonly gfx: Graphics;
  private previousStateIteration = -1;
  private visibleTeamHealth: Record<string, number> = {};
  private healthChangeTensionTimer: number | null = null;
  private readonly largestHealthPool: number;

  public readonly toaster: Toaster;
  private readonly winddial: WindDial;
  private readonly bottomOfScreenY;
  private readonly roundTimerWidth;

  constructor(
    private readonly ticker: Ticker,
    private readonly stage: Container,
    private readonly gameState: GameState,
    private readonly gameWorld: GameWorld,
    private readonly screenWidth: number,
    private readonly screenHeight: number,
  ) {
    this.roundTimer = new Text({
      text: "00",
      style: {
        ...LargeTextStyle,
        align: "center",
      },
    });
    this.roundTimerWidth = this.roundTimer.width;
    this.bottomOfScreenY = (this.screenHeight / 10) * 8.75;

    this.toaster = new Toaster(screenWidth, screenHeight);
    this.winddial = new WindDial(
      (this.screenWidth / 30) * 26,
      this.bottomOfScreenY,
      this.gameWorld,
    );

    this.roundTimer.position.set(
      this.screenWidth / 30 + 14,
      this.bottomOfScreenY + 12,
    );
    this.gfx = new Graphics();
    this.stage.addChild(this.toaster.container);
    this.stage.addChild(this.gfx);
    this.stage.addChild(this.roundTimer);
    this.stage.addChild(this.winddial.container);
    this.tickerFn = this.update.bind(this);
    this.ticker.add(this.tickerFn, undefined, UPDATE_PRIORITY.UTILITY);
    this.largestHealthPool = this.gameState
      .getTeams()
      .reduceRight((value, team) => Math.max(value, team.maxHealth), 0);
    this.gameState.getActiveTeams().forEach((t) => {
      this.visibleTeamHealth[t.name] = t.health;
    });
  }

  private update(dt: Ticker) {
    this.toaster.update(dt);
    this.winddial.update();
    const centerX = this.screenWidth / 2;
    if (this.healthChangeTensionTimer && !this.gameWorld.areEntitiesMoving()) {
      this.healthChangeTensionTimer -= dt.deltaTime;
    }

    const shouldChangeTeamHealth =
      this.healthChangeTensionTimer !== null &&
      this.healthChangeTensionTimer <= 0;

    this.roundTimer.text =
      this.gameState.remainingRoundTime === 0
        ? "--"
        : Math.ceil(this.gameState.remainingRoundTime / 1000);

    if (
      this.previousStateIteration === this.gameState.iteration &&
      !shouldChangeTeamHealth
    ) {
      return;
    }
    this.previousStateIteration = this.gameState.iteration;
    logger.debug(`Running update on iteration ${this.gameState.iteration}`);

    // TODO: Could the gameState flag this explicitly.
    // Check for health change.
    if (this.healthChangeTensionTimer === null) {
      for (const team of this.gameState.getTeams()) {
        if (this.visibleTeamHealth[team.name] === undefined) {
          continue;
        }
        if (this.visibleTeamHealth[team.name] !== team.health) {
          // TODO: Const, same as the one for Playable.
          this.healthChangeTensionTimer = HEALTH_CHANGE_TENSION_TIMER;
          return;
        }
      }
    }

    this.gfx.clear();

    // Remove any previous text.
    this.gfx.removeChildren(0, this.gfx.children.length);
    const currentTeamColors =
      !this.gameState.paused && this.gameState.activeTeam
        ? teamGroupToColorSet(this.gameState.activeTeam?.group)
        : { fg: 0xaaaaaa };

    // Round timer
    applyGenericBoxStyle(this.gfx, currentTeamColors.fg)
      .roundRect(
        this.roundTimer.x - 8,
        this.roundTimer.y + 8,
        this.roundTimerWidth + 16,
        this.roundTimer.height,
        4,
      )
      .stroke()
      .fill();

    // For each team:
    // TODO: Sort by health and group
    // TODO: Evenly space.
    let allHealthAccurate = true;
    const activeTeams = this.gameState.getActiveTeams();
    const teamSeperationHeight = 32;
    let teamBottomY =
      this.bottomOfScreenY -
      (teamSeperationHeight * (activeTeams.length - 2)) / 2;
    for (const team of activeTeams) {
      if (
        this.visibleTeamHealth[team.name] > team.health &&
        shouldChangeTeamHealth
      ) {
        this.visibleTeamHealth[team.name] -= 1;
        allHealthAccurate = false;
      }
      const teamHealthPercentage =
        this.visibleTeamHealth[team.name] / this.largestHealthPool;
      const { bg, fg } = teamGroupToColorSet(team.group);
      const nameTag = new Text({
        text: team.name,
        style: {
          ...DefaultTextStyle,
          align: "center",
        },
      });
      const border = team === this.gameState.activeTeam ? 0xffffff : undefined;
      const nameTagStartX = centerX - nameTag.width - 120;

      const nameWidth = nameTag.width + 6;
      const nameHeight = nameTag.height - 2;
      applyGenericBoxStyle(this.gfx, border)
        .roundRect(nameTagStartX - 3, teamBottomY - 2, nameWidth, nameHeight, 4)
        .stroke()
        .fill();
      nameTag.position.set(nameTagStartX, teamBottomY - 8);

      // Render health box.
      applyGenericBoxStyle(this.gfx, border)
        .roundRect(
          centerX - TEAM_HEALTH_WIDTH_PX / 2,
          teamBottomY - 2,
          TEAM_HEALTH_WIDTH_PX,
          nameHeight,
          4,
        )
        .stroke()
        .fill();

      // Render inner health fill.
      this.gfx
        .setStrokeStyle({
          width: 5,
          color: fg,
          cap: "butt",
          join: "round",
        })
        .setFillStyle({ color: bg })
        .roundRect(
          centerX - 99,
          teamBottomY + 1,
          (TEAM_HEALTH_WIDTH_PX - 4) * teamHealthPercentage - 2,
          nameHeight - 5,
          4,
        )
        .fill();
      this.gfx.addChild(nameTag);
      teamBottomY += teamSeperationHeight;
    }

    if (allHealthAccurate) {
      logger.debug("All health considered accurate");
      if (
        this.healthChangeTensionTimer !== null &&
        this.healthChangeTensionTimer <= 0
      ) {
        this.healthChangeTensionTimer = null;
      }
    }
  }
}
