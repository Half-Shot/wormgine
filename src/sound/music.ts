import { AssetSounds } from "../assets/manifest";
import { getGameSettings } from "../settings";
import { CrossfadeFilter } from "./crossfade-filter";
import { WebAudioMedia } from "@pixi/sound/lib/webaudio";

export enum TrackCrossfadeState {
  Minor = 0,
  Full = 1,
}

const TRACK_LOOP_AT_MS = 7.6;

class MusicPlayer {
  private crossfader?: CrossfadeFilter;
  constructor() {}

  public async loadMusic(assets: AssetSounds) {
    const minorTrack = assets.music_track1Minor;
    const fullTrack = assets.music_track1Full;
    this.crossfader = new CrossfadeFilter(
      minorTrack.context.audioContext,
      TRACK_LOOP_AT_MS,
      minorTrack.media as WebAudioMedia,
      fullTrack.media as WebAudioMedia,
      getGameSettings().musicVolume,
    );
  }

  public async playTrack() {
    if (!this.crossfader) {
      throw Error("No music ready to play");
    }

    this.crossfader.play();
  }

  public stop() {
    this.crossfader?.stop();
  }

  public switchCrossfade(state: TrackCrossfadeState) {
    if (state === TrackCrossfadeState.Full) {
      this.crossfader?.crossFadeToFull();
    } else {
      this.crossfader?.crossFadeToMinor();
    }
  }
}

const singleton = new MusicPlayer();

export default singleton;
