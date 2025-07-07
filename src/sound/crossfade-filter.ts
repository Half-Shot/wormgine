import { WebAudioMedia } from "@pixi/sound/lib/webaudio";

const CROSSFADE_DURATION_S = 0.15;

/**
 * Filter for adding Stereo panning.
 *
 * @memberof filters
 */
export class CrossfadeFilter {
  /** The stereo panning node */
  private volumeNode: GainNode | null;

  private sourceNodeMinor: AudioBufferSourceNode;
  private sourceNodeFull: AudioBufferSourceNode;

  private gainControlMinor: GainNode | null;
  private gainControlFull: GainNode | null;

  constructor(
    private readonly audioContext: AudioContext,
    loopStart: number,
    mediaA: WebAudioMedia,
    mediaB: WebAudioMedia,
    volume: number,
  ) {
    this.sourceNodeMinor = audioContext.createBufferSource();
    this.sourceNodeMinor.buffer = mediaA.buffer;
    this.sourceNodeMinor.loopStart = loopStart;
    this.sourceNodeMinor.loop = true;

    this.sourceNodeFull = audioContext.createBufferSource();
    this.sourceNodeFull.buffer = mediaB.buffer;
    this.sourceNodeFull.loopStart = loopStart;
    this.sourceNodeFull.loop = true;

    this.gainControlMinor = audioContext.createGain();
    this.gainControlMinor.gain.value = 1;
    this.sourceNodeMinor.connect(this.gainControlMinor);

    this.gainControlFull = audioContext.createGain();
    this.gainControlFull.gain.value = 0;
    this.sourceNodeFull.connect(this.gainControlFull);

    const channelSplitterA = audioContext.createChannelSplitter(2);
    this.gainControlMinor.connect(channelSplitterA);

    const channelSplitterB = audioContext.createChannelSplitter(2);
    this.gainControlFull.connect(channelSplitterB);

    const channelLeftMerger = audioContext.createChannelMerger(2);
    channelSplitterA.connect(channelLeftMerger, 0, 0);
    channelSplitterB.connect(channelLeftMerger, 0, 1);

    const channelRightMerger = audioContext.createChannelMerger(2);
    channelSplitterA.connect(channelRightMerger, 1, 0);
    channelSplitterB.connect(channelRightMerger, 1, 1);

    const channelMerger = audioContext.createChannelMerger(2);
    channelLeftMerger.connect(channelMerger, 0, 0);
    channelRightMerger.connect(channelMerger, 0, 1);

    this.volumeNode = audioContext.createGain();

    this.volumeNode.gain.value = volume;

    channelMerger.connect(this.volumeNode);
    this.volumeNode.connect(audioContext.destination);
  }

  public play() {
    this.sourceNodeMinor?.start();
    this.sourceNodeFull?.start();
  }

  public stop() {
    this.sourceNodeMinor.stop();
    this.sourceNodeFull.stop();
  }

  public crossFadeToMinor() {
    this.gainControlFull?.gain.setTargetAtTime(
      0,
      this.audioContext.currentTime + CROSSFADE_DURATION_S,
      0.75,
    );
    this.gainControlMinor?.gain.setTargetAtTime(
      1,
      this.audioContext.currentTime + CROSSFADE_DURATION_S,
      0.75,
    );
  }

  public crossFadeToFull() {
    this.gainControlFull?.gain.setTargetAtTime(
      1,
      this.audioContext.currentTime + CROSSFADE_DURATION_S,
      0.75,
    );
    this.gainControlMinor?.gain.setTargetAtTime(
      0,
      this.audioContext.currentTime + CROSSFADE_DURATION_S,
      0.75,
    );
  }

  public destroy(): void {
    this.volumeNode = null;
  }
}
