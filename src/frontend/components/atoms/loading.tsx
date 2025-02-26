import { useEffect, useRef, useState } from "preact/hooks";
import video from "../../../assets/ui/loading.webm";

const staticVideo = fetch(video, { priority: "high" })
  .then((v) => v.blob())
  .then((v) => URL.createObjectURL(v))
  .finally(() => {
    console.log("Video load done");
  });

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
  const [videoSrc, setVideoSrc] = useState<string>();
  useEffect(() => {
    staticVideo.then((src) => setVideoSrc(src));
  }, []);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }
    videoRef.current.playbackRate = 2;
    videoRef.current.addEventListener("ended", () => {
      if (videoRef.current?.currentTime === VIDEO_TIME_S) {
        loadingDone();
      }
    });
  }, [videoRef]);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }
    if (progress === undefined) {
      videoRef.current.play();
      return;
    }
    const expectedProgress = VIDEO_TIME_S * progress;
    const currentTime = videoRef.current.currentTime;
    if (expectedProgress > currentTime) {
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
      src={videoSrc}
      controls={false}
      preload="auto"
    />
  );
}
