import React, { useRef, useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Play, Pause, Download, FileText, X, Volume2, FastForward, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AudioPlayerBar: React.FC = () => {
  const { activeAudioJob, clearActiveAudioJob } = useAppStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    if (activeAudioJob && audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  }, [activeAudioJob]);

  if (!activeAudioJob) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (deltaSeconds: number) => {
    if (audioRef.current) {
      const nextTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + deltaSeconds));
      audioRef.current.currentTime = nextTime;
      setCurrentTime(nextTime);
    }
  };

  // SOTA Late 2026: MediaSession API for lock-screen & background mobile playback
  useEffect(() => {
    if (!activeAudioJob) return;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: activeAudioJob.title || 'Аудиопересказ темы',
        artist: 'InterviewPrep AI Deep Dive',
        album: activeAudioJob.topic || 'Senior Java & Distributed Systems',
        artwork: [
          { src: '/icons/podcast-512.png', sizes: '512x512', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (audioRef.current) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => skip(-15));
      navigator.mediaSession.setActionHandler('seekforward', () => skip(15));
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
      }
    };
  }, [activeAudioJob]);

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextRate = speeds[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed bottom-4 left-0 right-0 z-40 px-4 max-w-4xl mx-auto">
        {/* Hidden Audio Element */}
        <audio
          ref={audioRef}
          src={activeAudioJob.audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleTimeUpdate}
          onEnded={() => setIsPlaying(false)}
        />

        {/* Collapsible Transcript Drawer */}
        {showTranscript && activeAudioJob.transcript && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-3 p-5 bg-white/95 backdrop-blur-md rounded-3xl border border-pastel-rose shadow-xl max-h-80 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-3 border-b border-pastel-border pb-2">
              <span className="text-xs font-bold text-pastel-accentRose flex items-center gap-2">
                <FileText className="w-4 h-4" /> Расшифровка диалога ведущих
              </span>
              <button
                onClick={() => setShowTranscript(false)}
                className="text-xs text-pastel-muted hover:text-pastel-text"
              >
                Закрыть
              </button>
            </div>
            <div className="whitespace-pre-wrap text-xs md:text-sm text-pastel-text/90 leading-relaxed font-sans space-y-2">
              {activeAudioJob.transcript}
            </div>
          </motion.div>
        )}

        {/* Main Floating Audio Player Card */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-pastel-rose/80 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden"
        >
          {/* Decorative soft glowing blur background */}
          <div className="absolute top-0 left-1/4 w-32 h-32 rounded-full bg-pastel-accentRose/10 blur-xl pointer-events-none" />

          {/* Left Info & Equalizer */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pastel-accentRose to-pastel-accentViolet flex items-center justify-center text-white shrink-0 shadow-md">
              <Headphones className="w-5 h-5" />
            </div>

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-pastel-text truncate max-w-[200px] md:max-w-[240px]">
                {activeAudioJob.title}
              </h4>
              <p className="text-[10px] text-pastel-muted truncate">
                {activeAudioJob.topic || 'Аудиопересказ Gemini 3 & Edge-TTS'}
              </p>
            </div>

            {/* Equalizer animation */}
            <div className="flex items-end gap-0.5 h-4 px-2">
              {[0.4, 0.8, 0.5, 1.0, 0.6].map((scale, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full bg-gradient-to-t from-pastel-accentRose to-pastel-accentViolet transition-all duration-300 ${
                    isPlaying ? 'animate-pulse' : 'h-1 opacity-50'
                  }`}
                  style={{
                    height: isPlaying ? `${scale * 100}%` : '4px',
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Center Playback Controls & Progress Bar */}
          <div className="flex items-center gap-3 w-full md:flex-1 md:max-w-md">
            {/* Skip Back 15s */}
            <button
              onClick={() => skip(-15)}
              className="px-1.5 py-1 text-pastel-muted hover:text-pastel-text text-[11px] font-mono font-bold transition rounded-lg hover:bg-pastel-bg cursor-pointer"
              title="Назад на 15 сек"
            >
              -15s
            </button>

            {/* Play/Pause Button */}
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-full bg-pastel-accentRose hover:bg-pastel-accentRose/90 text-white flex items-center justify-center shrink-0 shadow-md transition transform active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            {/* Skip Forward 15s */}
            <button
              onClick={() => skip(15)}
              className="px-1.5 py-1 text-pastel-muted hover:text-pastel-text text-[11px] font-mono font-bold transition rounded-lg hover:bg-pastel-bg cursor-pointer"
              title="Вперед на 15 сек"
            >
              +15s
            </button>

            {/* Time Scrubber */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[10px] font-mono font-semibold text-pastel-muted min-w-[32px]">
                {formatTime(currentTime)}
              </span>

              <input
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1.5 bg-pastel-rose rounded-lg appearance-none cursor-pointer accent-pastel-accentRose"
              />

              <span className="text-[10px] font-mono font-semibold text-pastel-muted min-w-[32px]">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Speed Button */}
            <button
              onClick={cycleSpeed}
              className="px-2.5 py-1 rounded-lg bg-pastel-lavender text-pastel-accentViolet text-[11px] font-bold border border-pastel-accentViolet/20 hover:bg-pastel-accentViolet/10 transition"
              title="Скорость воспроизведения"
            >
              {playbackRate}x
            </button>

            {/* Transcript Toggle */}
            {activeAudioJob.transcript && (
              <button
                onClick={() => setShowTranscript(!showTranscript)}
                className={`p-2 rounded-lg text-xs font-semibold border transition ${
                  showTranscript
                    ? 'bg-pastel-rose text-pastel-accentRose border-pastel-accentRose/30'
                    : 'bg-pastel-bg text-pastel-muted border-pastel-border hover:text-pastel-text'
                }`}
                title="Текст подкаста"
              >
                <FileText className="w-4 h-4" />
              </button>
            )}

            {/* Download Button */}
            <a
              href={activeAudioJob.audioUrl}
              download={`podcast_${activeAudioJob.jobId}.mp3`}
              className="p-2 rounded-lg bg-pastel-sage text-pastel-accentTeal hover:bg-pastel-accentTeal/10 border border-pastel-accentTeal/20 transition"
              title="Скачать MP3"
            >
              <Download className="w-4 h-4" />
            </a>

            {/* Close Player */}
            <button
              onClick={clearActiveAudioJob}
              className="p-2 rounded-lg text-pastel-muted hover:text-pastel-text transition"
              title="Закрыть плеер"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
