import { useCallback, useEffect, useRef } from "preact/hooks";
import video from "../../../assets/ui/loading.webm";
import Logger from "../../../log";
import { JSX } from "preact";

const log = new Logger("component.Loading");

const staticVideo = fetch(video, { priority: "high" })
  .then((v) => v.blob())
  .then((v) => URL.createObjectURL(v));

const VIDEO_TIME_S = 3;

export function Loading({
  progress,
  className,
  loadingDone,
}: {
  progress?: number;
  className?: string;
  loadingDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const ref = videoRef.current;
    if (!ref) {
      return;
    }
    staticVideo.then((src) => (ref.src = src));
  }, [videoRef]);

  const onEnded = useCallback<JSX.GenericEventHandler<HTMLVideoElement>>(
    (evt) => {
      if ((evt.target as HTMLVideoElement).currentTime === VIDEO_TIME_S) {
        log.debug("Video complete");
        loadingDone();
      }
    },
    [loadingDone],
  );

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }
    if (progress === undefined) {
      log.debug("Video playing with no progress");
      videoRef.current
        .play()
        .catch((ex) => log.error("Error while playing load animation", ex));
      return;
    }
    const expectedProgress = VIDEO_TIME_S * progress;
    const currentTime = videoRef.current.currentTime;
    if (expectedProgress > currentTime) {
      log.debug(
        "Video resumed as there was progress",
        expectedProgress,
        currentTime,
      );
      videoRef.current
        .play()
        .catch((ex) => log.error("Error while resuming load animation", ex));
    } else if (currentTime >= expectedProgress) {
      log.debug(
        "Video paused as progress reached",
        expectedProgress,
        currentTime,
      );
      videoRef.current.pause();
    }
  }, [videoRef, progress]);

  // Always play muted, because it prevents browsers blocking the animation.
  return (
    <video
      muted
      style={{ maxWidth: "500px", width: "15vw" }}
      className={className}
      ref={videoRef}
      onEnded={onEnded}
      playbackRate={2}
      controls={false}
      preload="auto"
    />
  );
}
