import { IMediaInstance, Sound } from "@pixi/sound";
import { AssetSounds } from "../assets/manifest";
import { getGameSettings } from "../settings";
import Logger from "../log";

const log = new Logger("MusicPlayer");
export enum TrackCrossfadeState {
  Minor = 0,
  Full = 1,
}

const TRACK_LOOP_AT_MS = 7.6;
const CROSSFADE_DURATION_MS = 500;

class MusicPlayer {
  private minorTrack?: Sound;
  private fullTrack?: Sound;
  private mediaInstanceMinor?: IMediaInstance;
  private mediaInstanceFull?: IMediaInstance;

  private currentState = TrackCrossfadeState.Minor;
  private nextState = TrackCrossfadeState.Minor;
  private crossfadeElapsed = 0;
  constructor() {}

  public async loadMusic(assets: AssetSounds) {
    this.minorTrack = assets.music_track1Minor;
    this.fullTrack = assets.music_track1Full;
  }

  public async playTrack() {
    if (!this.minorTrack || !this.fullTrack) {
      throw Error("No music ready to play");
    }

    const intro = await this.minorTrack.play({
      end: TRACK_LOOP_AT_MS,
      volume: getGameSettings().musicVolume,
      loop: false,
    });

    intro.on("end", async () => {
      this.mediaInstanceMinor = await this.minorTrack!.play({
        volume: getGameSettings().musicVolume,
        start: TRACK_LOOP_AT_MS,
        loop: true,
      });
      this.mediaInstanceFull = await this.fullTrack!.play({
        volume: 0,
        start: TRACK_LOOP_AT_MS,
        loop: true,
      });
    });
  }

  public stop() {
    this.mediaInstanceMinor?.stop();
    this.mediaInstanceFull?.stop();
  }

  public switchCrossfade(state: TrackCrossfadeState) {
    if (this.nextState === state) {
      log.warning(
        `Trying to switch to the same state`,
        TrackCrossfadeState[state],
      );
    }
    log.info(`Switching state`, TrackCrossfadeState[state]);
    this.nextState = state;
  }

  public update(delta: number) {
    if (!this.mediaInstanceMinor || !this.mediaInstanceFull) {
      return;
    }
    if (this.nextState === this.currentState) {
      return;
    }

    if (this.crossfadeElapsed > CROSSFADE_DURATION_MS) {
      this.crossfadeElapsed = 0;
      this.currentState = this.nextState;
    }

    this.crossfadeElapsed += delta;
    const volumeForNew =
      getGameSettings().musicVolume *
      (this.crossfadeElapsed / CROSSFADE_DURATION_MS);
    const volumeForOld =
      getGameSettings().musicVolume *
      (1 - this.crossfadeElapsed / CROSSFADE_DURATION_MS);

    if (this.nextState === TrackCrossfadeState.Full) {
      this.mediaInstanceMinor!.volume = volumeForNew;
      this.mediaInstanceFull!.volume = volumeForOld;
    } else if (this.nextState === TrackCrossfadeState.Minor) {
      this.mediaInstanceMinor!.volume = volumeForOld;
      this.mediaInstanceFull!.volume = volumeForNew;
    }
  }
}

const singleton = new MusicPlayer();

export default singleton;
