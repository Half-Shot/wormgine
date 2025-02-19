import { useEffect, useRef } from "preact/hooks";
import video from "../../../assets/ui/loading.webm";

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
    if (!videoRef.current) {
      return;
    }
    videoRef.current.addEventListener("ended", () => {
      loadingDone();
    });
  }, [videoRef]);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }
    if (progress === undefined) {
      videoRef.current.playbackRate = 2;
      videoRef.current.play();
      return;
    }
    const expectedProgress = VIDEO_TIME_S * progress;
    const currentTime = videoRef.current.currentTime;
    if (expectedProgress > currentTime) {
      videoRef.current.playbackRate =
        expectedProgress - currentTime > 2 ? 3 : 1;
      videoRef.current.play();
    } else if (currentTime >= expectedProgress) {
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
      src={video}
      controls={false}
      preload="auto"
    />
  );
}
