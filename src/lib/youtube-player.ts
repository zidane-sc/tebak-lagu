// YouTube IFrame Player API Helper for Web (Mobile-Friendly)
// Allows playing full tracks from ANY exact second timestamp (e.g. iconic chorus)

declare global {
  interface Window {
    onYouTubeIframeAPIReady?: () => void;
    YT: any;
  }
}

export class YouTubeAudioPlayer {
  private player: any = null;
  private isReady: boolean = false;
  private containerId: string;
  private timer: NodeJS.Timeout | null = null;
  public onStateChange?: (state: number) => void;

  constructor(containerId: string = "yt-player-container") {
    this.containerId = containerId;
  }

  public loadAPI(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined") return resolve();
      if (window.YT && window.YT.Player) {
        this.isReady = true;
        return resolve();
      }

      const existingScript = document.getElementById("yt-iframe-api");
      if (!existingScript) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api";
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }

      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        this.isReady = true;
        resolve();
      };
    });
  }

  public initPlayer(videoIdOrQuery: string, onReady?: () => void) {
    if (!window.YT) return;

    if (this.player) {
      try {
        this.player.destroy();
      } catch {}
    }

    this.player = new window.YT.Player(this.containerId, {
      height: "1",
      width: "1",
      videoId: videoIdOrQuery,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1, // Crucial for mobile iOS so it doesn't open fullscreen!
      },
      events: {
        onReady: () => {
          if (onReady) onReady();
        },
        onStateChange: (e: any) => {
          if (this.onStateChange) this.onStateChange(e.data);
        },
      },
    });
  }

  public playSlice(startSeconds: number, durationSeconds?: number, onEnd?: () => void) {
    if (!this.player || !this.player.seekTo) return;

    this.stop();
    this.player.seekTo(startSeconds, true);
    this.player.playVideo();

    if (durationSeconds && durationSeconds > 0) {
      this.timer = setTimeout(() => {
        this.pause();
        if (onEnd) onEnd();
      }, durationSeconds * 1000);
    }
  }

  public play() {
    if (this.player && this.player.playVideo) {
      this.player.playVideo();
    }
  }

  public pause() {
    if (this.player && this.player.pauseVideo) {
      this.player.pauseVideo();
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public stop() {
    if (this.player && this.player.stopVideo) {
      this.player.stopVideo();
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  public destroy() {
    this.stop();
    if (this.player && this.player.destroy) {
      try {
        this.player.destroy();
      } catch {}
      this.player = null;
    }
  }
}
