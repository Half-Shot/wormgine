import {
  Container,
  Graphics,
  Text,
  Texture,
  Ticker,
  UPDATE_PRIORITY,
} from "pixi.js";
import { GameState } from "../logic/gamestate";
import { applyGenericBoxStyle, DefaultTextStyle } from "../mixins/styles";
import { teamGroupToColorSet } from "../logic/teams";
import { GameWorld } from "../world";
import { Toaster } from "./toaster";
import { WindDial } from "./windDial";
import { HEALTH_CHANGE_TENSION_TIMER } from "../consts";
import Logger from "../log";
import { combineLatest, first, map } from "rxjs";
import { RoundTimer } from "./roundTimer";

const logger = new Logger("GameStateOverlay");

const TEAM_HEALTH_WIDTH_PX = 204;

export class GameStateOverlay {
  public readonly physicsSamples: number[] = [];
  private readonly tickerFn: (dt: Ticker) => void;
  private readonly gfx: Graphics;
  private previousStateIteration = -1;
  private visibleTeamHealth: Record<string, number> = {};
  private healthChangeTensionTimer: number | null = null;
  private largestHealthPool = 0;

  public readonly toaster: Toaster;
  private readonly winddial: WindDial;
  private readonly roundTimer: RoundTimer;
  private readonly bottomOfScreenY;
  private readonly teamFlagTextures: Record<string, Texture> = {};

  constructor(
    private readonly ticker: Ticker,
    private readonly stage: Container,
    private readonly gameState: GameState,
    private readonly gameWorld: GameWorld,
    private readonly screenWidth: number,
    private readonly screenHeight: number,
  ) {
    this.bottomOfScreenY = (this.screenHeight / 10) * 8.75;

    this.toaster = new Toaster(screenWidth, screenHeight);
    this.winddial = new WindDial(
      (this.screenWidth / 30) * 26,
      this.bottomOfScreenY,
      this.gameWorld,
    );
    this.roundTimer = new RoundTimer(
      this.screenWidth / 30 + 14,
      this.bottomOfScreenY + 12,
      this.gameState.remainingRoundTimeSeconds$,
      this.gameState.currentTeam$.pipe(
        map((t) => t && teamGroupToColorSet(t.group)),
      ),
    );

    this.gfx = new Graphics();
    this.stage.addChild(this.toaster.container);
    this.stage.addChild(this.gfx);
    this.stage.addChild(this.roundTimer.container);
    this.stage.addChild(this.winddial.container);
    this.tickerFn = this.update.bind(this);
    this.ticker.add(this.tickerFn, undefined, UPDATE_PRIORITY.UTILITY);
    combineLatest(this.gameState.getTeams().map((t) => t.maxHealth$))
      .pipe(
        map((v) => v.reduce((v1, v2) => Math.max(v1, v2))),
        first(),
      )
      .subscribe((s) => {
        this.largestHealthPool = s;
      });
    this.gameState.getActiveTeams().forEach((t) => {
      if (t.flag) {
        this.teamFlagTextures[t.name] = Texture.from(
          `team-flag-${t.name}`,
          true,
        );
      }
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
      if (this.visibleTeamHealth[team.uuid] === undefined) {
        this.visibleTeamHealth[team.uuid] = team.health;
      }
      if (
        this.visibleTeamHealth[team.uuid] > team.health &&
        shouldChangeTeamHealth
      ) {
        this.visibleTeamHealth[team.uuid] -= 1;
        allHealthAccurate = false;
      }
      const teamHealthPercentage =
        this.visibleTeamHealth[team.uuid] / this.largestHealthPool;

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
      const flagBoxWidth = 24;

      const nameWidth = nameTag.width + 6;
      const nameHeight = nameTag.height - 2;
      applyGenericBoxStyle(this.gfx, border)
        .roundRect(nameTagStartX - 3, teamBottomY - 2, nameWidth, nameHeight, 4)
        .stroke()
        .fill();
      nameTag.position.set(nameTagStartX, teamBottomY - 8);

      // Render flag
      if (this.teamFlagTextures[team.name]) {
        const flagX = centerX - TEAM_HEALTH_WIDTH_PX / 2 - 8;
        const flagY = teamBottomY - 2;
        applyGenericBoxStyle(this.gfx, border)
          .roundRect(flagX, flagY, nameHeight, nameHeight, 4)
          .stroke()
          .fill();
        this.gfx.texture(
          this.teamFlagTextures[team.name],
          undefined,
          flagX + 2,
          flagY + 2,
          nameHeight - 4,
          nameHeight - 4,
        );
      }

      // Render health box.
      applyGenericBoxStyle(this.gfx, border)
        .roundRect(
          centerX - TEAM_HEALTH_WIDTH_PX / 2 + flagBoxWidth,
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
          centerX + flagBoxWidth - 99,
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
