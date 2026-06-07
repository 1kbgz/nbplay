// nbplay TimelineWidget - multi-track clip timeline and browser recorder.

import { type AnyModel, createAudioContext } from "./helpers.ts";

const MAX_TIMELINE_BEATS = 4096;

interface TimelineTrack {
  name: string;
  channel_index: number;
  armed: boolean;
  muted: boolean;
  solo: boolean;
  input?: string;
  monitor?: boolean;
}

interface AudioClip {
  id: string;
  name: string;
  track_index: number;
  start: number;
  duration: number;
  loop?: boolean;
  muted?: boolean;
  recorded?: boolean;
  audio_url?: string;
  blob_type?: string;
  blob_size?: number;
  source?: string;
  sample_rate?: number;
}

interface SessionBus {
  audioCtx?: AudioContext;
  masterGain?: AudioNode;
  channels?: { gain?: AudioNode }[];
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function numberValue(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function beatLabel(beat: number, beatsPerBar: number): string {
  const bar = Math.floor(beat / beatsPerBar) + 1;
  const beatInBar = Math.floor(beat % beatsPerBar) + 1;
  return `${bar}.${beatInBar}`;
}

function uniqueClipId(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) return `clip-${cryptoObj.randomUUID()}`;
  return `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function clipEnd(clip: AudioClip): number {
  return clip.start + Math.max(0.001, clip.duration);
}

function getTracks(model: AnyModel): TimelineTrack[] {
  const raw = (model.get("tracks") as TimelineTrack[] | undefined) || [];
  return [...raw].map((track, index) => ({
    name: String(track.name ?? `Track ${index + 1}`),
    channel_index: numberValue(track.channel_index, index),
    armed: Boolean(track.armed),
    muted: Boolean(track.muted),
    solo: Boolean(track.solo),
    input: String(track.input ?? "microphone"),
    monitor: Boolean(track.monitor),
  }));
}

function getClips(model: AnyModel): AudioClip[] {
  const raw = (model.get("clips") as AudioClip[] | undefined) || [];
  return [...raw].map((clip, index) => ({
    id: String(clip.id || `clip-${index + 1}`),
    name: String(clip.name || `Clip ${index + 1}`),
    track_index: Math.max(0, numberValue(clip.track_index, 0)),
    start: Math.max(0, numberValue(clip.start, 0)),
    duration: Math.max(0.001, numberValue(clip.duration, 4)),
    loop: Boolean(clip.loop),
    muted: Boolean(clip.muted),
    recorded: Boolean(clip.recorded),
    audio_url: String(clip.audio_url || ""),
    blob_type: String(clip.blob_type || ""),
    blob_size:
      clip.blob_size === undefined
        ? undefined
        : Math.max(0, numberValue(clip.blob_size, 0)),
    source: String(clip.source || "recording"),
    sample_rate: Math.max(1, numberValue(clip.sample_rate, 44100)),
  }));
}

function getSessionBus(sessionId: string): SessionBus | null {
  if (!sessionId) return null;
  const g = globalThis as Record<string, unknown>;
  const nbplay = g.__nbplay as Record<string, SessionBus> | undefined;
  return nbplay?.[sessionId] || null;
}

function setAndSave(model: AnyModel, key: string, value: unknown): void {
  model.set(key, value);
  model.save_changes();
}

function timelineLength(model: AnyModel): number {
  return Math.max(
    1,
    Math.min(MAX_TIMELINE_BEATS, numberValue(model.get("length"), 16)),
  );
}

function beatsPerBar(model: AnyModel): number {
  return Math.max(1, numberValue(model.get("time_signature_num"), 4));
}

function clampBeat(model: AnyModel, beat: number): number {
  return Math.max(0, Math.min(timelineLength(model), beat));
}

function countInBeats(model: AnyModel): number {
  return (
    Math.max(0, numberValue(model.get("count_in_bars"), 0)) * beatsPerBar(model)
  );
}

function recordingExtendBeats(model: AnyModel): number {
  return (
    Math.max(1, numberValue(model.get("recording_extend_bars"), 8)) *
    beatsPerBar(model)
  );
}

export default {
  render({ model, el }: { model: AnyModel; el: HTMLElement }) {
    const root = document.createElement("div");
    root.className = "nbplay-timeline";
    el.appendChild(root);

    model.set("is_recording", false);
    model.set("recording_track", -1);

    let audioCtx: AudioContext | null = null;
    let mediaRecorder: MediaRecorder | null = null;
    let mediaStream: MediaStream | null = null;
    let monitorSource: AudioNode | null = null;
    let chunks: Blob[] = [];
    let recordingStartMs = 0;
    let recordingStartBeat = 0;
    let recordingStopBeat: number | null = null;
    let countInTimer: ReturnType<typeof setTimeout> | null = null;
    let countInTick: ReturnType<typeof setInterval> | null = null;
    let recordingPending = false;
    let recordingGeneration = 0;
    let recordingStartedPlayback = false;
    let scheduledTimers: ReturnType<typeof setTimeout>[] = [];
    let playheadTimer: ReturnType<typeof setInterval> | null = null;
    let seekFrame: number | null = null;
    let playbackDisplayBeat: number | null = null;
    let disposed = false;
    const objectUrls = new Set<string>();
    const activeMedia: HTMLMediaElement[] = [];
    const activeSources: AudioNode[] = [];

    function getAudioContext(): AudioContext | null {
      if (audioCtx) return audioCtx;
      const bus = getSessionBus(model.get("session_id") as string);
      audioCtx = bus?.audioCtx || createAudioContext();
      return audioCtx;
    }

    function clearCountIn(): void {
      if (countInTimer) {
        clearTimeout(countInTimer);
        countInTimer = null;
      }
      if (countInTick) {
        clearInterval(countInTick);
        countInTick = null;
      }
      model.set("recording_countdown_beats", 0);
    }

    function stopMonitoring(): void {
      if (!monitorSource) return;
      try {
        monitorSource.disconnect();
      } catch (_) {
        // Ignore already-disconnected monitor nodes.
      }
      monitorSource = null;
    }

    function stopStream(): void {
      stopMonitoring();
      mediaStream?.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }

    function clearScheduledPlayback(): void {
      scheduledTimers.forEach((timer) => clearTimeout(timer));
      scheduledTimers = [];
      activeMedia.forEach((media) => {
        try {
          media.pause();
          media.currentTime = 0;
        } catch (_) {
          // Media may be gone after notebook cell cleanup.
        }
      });
      activeMedia.length = 0;
      activeSources.forEach((source) => {
        try {
          source.disconnect();
        } catch (_) {
          // Ignore already-disconnected nodes.
        }
      });
      activeSources.length = 0;
      if (playheadTimer) {
        clearInterval(playheadTimer);
        playheadTimer = null;
      }
      playbackDisplayBeat = null;
    }

    function boundedCurrentBeat(): number {
      return clampBeat(model, numberValue(model.get("current_beat"), 0));
    }

    function writeRecordingError(message: string): void {
      if (disposed) return;
      clearCountIn();
      stopStream();
      mediaRecorder = null;
      recordingPending = false;
      recordingGeneration += 1;
      recordingStartedPlayback = false;
      recordingStopBeat = null;
      model.set("recording_error", message);
      model.set("is_recording", false);
      model.set("recording_track", -1);
      model.save_changes();
      syncTransportControls();
    }

    function findRecordingTrack(): number {
      const tracks = getTracks(model);
      const current = numberValue(model.get("recording_track"), -1);
      if (current >= 0 && current < tracks.length) return current;
      const armed = tracks.findIndex((track) => track.armed);
      return armed >= 0 ? armed : tracks.length > 0 ? 0 : -1;
    }

    function recordingDurationBeats(): number {
      if (
        recordingStopBeat !== null &&
        recordingStopBeat > recordingStartBeat
      ) {
        return Math.max(0.25, recordingStopBeat - recordingStartBeat);
      }
      const seconds = Math.max(
        0.25,
        (performance.now() - recordingStartMs) / 1000,
      );
      const bpm = Math.max(1, numberValue(model.get("bpm"), 120));
      return Math.max(0.25, seconds * (bpm / 60));
    }

    function finalizeRecording(trackIndex: number): void {
      const mimeType =
        mediaRecorder?.mimeType || chunks[0]?.type || "audio/webm";
      const blob = new Blob(chunks, { type: mimeType });
      chunks = [];
      const duration = recordingDurationBeats();
      stopStream();
      mediaRecorder = null;
      recordingStartedPlayback = false;
      recordingStopBeat = null;
      if (disposed) return;

      if (!blob.size || typeof URL === "undefined" || !URL.createObjectURL) {
        writeRecordingError("No audio was captured");
        return;
      }

      const url = URL.createObjectURL(blob);
      objectUrls.add(url);
      const clips = getClips(model);
      const clip: AudioClip = {
        id: uniqueClipId(),
        name: `Take ${clips.length + 1}`,
        track_index: trackIndex,
        start: recordingStartBeat,
        duration,
        loop: false,
        muted: false,
        recorded: true,
        audio_url: url,
        blob_type: blob.type,
        blob_size: blob.size,
        source: "recording",
        sample_rate: getAudioContext()?.sampleRate || 44100,
      };

      model.set("clips", [...clips, clip]);
      model.set("recorded_clip", clip);
      model.set("selected_clip_id", clip.id);
      model.set("recording_error", "");
      model.set("is_recording", false);
      model.set("recording_track", -1);
      model.set("recording_countdown_beats", 0);
      model.set(
        "length",
        Math.max(
          numberValue(model.get("length"), 16),
          clip.start + clip.duration,
        ),
      );
      model.save_changes();
      syncTimeline();
      syncTransportControls();
    }

    function startInputMonitoring(
      track: TimelineTrack,
      stream: MediaStream,
    ): void {
      stopMonitoring();
      if (!track.monitor) return;
      const bus = getSessionBus(model.get("session_id") as string);
      const ctx = bus?.audioCtx || getAudioContext();
      if (!ctx?.createMediaStreamSource) return;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const target =
          bus?.channels?.[track.channel_index]?.gain ||
          bus?.masterGain ||
          ctx.destination;
        source.connect(target);
        monitorSource = source;
        void ctx.resume?.();
      } catch (_) {
        // Monitoring is best-effort; recording still works without routing.
      }
    }

    function ensurePlaybackStarted(): void {
      if (Boolean(model.get("is_playing"))) return;
      recordingStartedPlayback = true;
      model.set("is_playing", true);
    }

    function beginRecording(
      trackIndex: number,
      Recorder: typeof MediaRecorder,
      startBeat: number,
      generation: number,
    ): void {
      if (generation !== recordingGeneration || !mediaStream || mediaRecorder)
        return;
      recordingPending = false;
      chunks = [];
      mediaRecorder = new Recorder(mediaStream);
      recordingStartMs = performance.now();
      recordingStartBeat = clampBeat(model, startBeat);
      recordingStopBeat = null;
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size) chunks.push(event.data);
      });
      mediaRecorder.addEventListener(
        "stop",
        () => finalizeRecording(trackIndex),
        {
          once: true,
        },
      );
      mediaRecorder.start();
      model.set("recording_error", "");
      model.set("recording_track", trackIndex);
      model.set("recording_countdown_beats", 0);
      model.set("is_recording", true);
      ensurePlaybackStarted();
      model.save_changes();
      syncTransportControls();
    }

    function scheduleCountIn(
      trackIndex: number,
      Recorder: typeof MediaRecorder,
      startBeat: number,
      durationBeats: number,
      generation: number,
    ): void {
      const bpm = Math.max(1, numberValue(model.get("bpm"), 120));
      const bps = bpm / 60;
      const startMs = performance.now();
      const delayMs = Math.max(0, (durationBeats / bps) * 1000);

      model.set("recording_countdown_beats", durationBeats);
      countInTick = setInterval(() => {
        const elapsedBeats = ((performance.now() - startMs) / 1000) * bps;
        const remaining = Math.max(0, durationBeats - elapsedBeats);
        model.set("recording_countdown_beats", remaining);
        syncTransportControls();
        if (remaining <= 0 && countInTick) {
          clearInterval(countInTick);
          countInTick = null;
        }
      }, 50);
      countInTimer = setTimeout(() => {
        countInTimer = null;
        if (countInTick) {
          clearInterval(countInTick);
          countInTick = null;
        }
        model.set("recording_countdown_beats", 0);
        if (disposed) {
          stopStream();
          return;
        }
        if (generation !== recordingGeneration) return;
        beginRecording(trackIndex, Recorder, startBeat, generation);
      }, delayMs);
    }

    async function startRecording(): Promise<void> {
      if (mediaRecorder || countInTimer || recordingPending) return;
      const trackIndex = findRecordingTrack();
      if (trackIndex < 0) {
        writeRecordingError("Add a track before recording");
        return;
      }

      const nav = navigator as Navigator & {
        mediaDevices?: {
          getUserMedia?: (
            constraints: MediaStreamConstraints,
          ) => Promise<MediaStream>;
        };
      };
      const Recorder = (globalThis as { MediaRecorder?: typeof MediaRecorder })
        .MediaRecorder;
      if (!nav.mediaDevices?.getUserMedia || !Recorder) {
        writeRecordingError(
          "Microphone recording is unavailable in this browser",
        );
        return;
      }

      const generation = ++recordingGeneration;
      recordingPending = true;
      model.set("recording_error", "");
      model.set("recording_track", trackIndex);
      model.set("recording_countdown_beats", 0);
      model.set("is_recording", true);
      model.save_changes();

      try {
        const stream = await nav.mediaDevices.getUserMedia({ audio: true });
        if (
          disposed ||
          generation !== recordingGeneration ||
          !recordingPending ||
          !Boolean(model.get("is_recording"))
        ) {
          stream.getTracks().forEach((track) => track.stop());
          if (generation === recordingGeneration) recordingPending = false;
          return;
        }
        mediaStream = stream;
        const track = getTracks(model)[trackIndex];
        startInputMonitoring(track, mediaStream);
        const targetBeat = boundedCurrentBeat();
        const preRollBeats = countInBeats(model);
        const preRollStartBeat =
          preRollBeats > 0
            ? Math.max(0, targetBeat - preRollBeats)
            : targetBeat;
        const delayBeats =
          preRollBeats > 0
            ? targetBeat > 0
              ? targetBeat - preRollStartBeat
              : preRollBeats
            : 0;

        model.set("recording_countdown_beats", delayBeats);
        if (preRollBeats > 0 && targetBeat > 0) {
          model.set("current_beat", preRollStartBeat);
          ensurePlaybackStarted();
        }
        model.save_changes();
        if (delayBeats > 0) {
          scheduleCountIn(
            trackIndex,
            Recorder,
            targetBeat,
            delayBeats,
            generation,
          );
        } else {
          beginRecording(trackIndex, Recorder, targetBeat, generation);
        }
      } catch (err) {
        if (generation !== recordingGeneration) return;
        stopStream();
        mediaRecorder = null;
        recordingPending = false;
        recordingStartedPlayback = false;
        writeRecordingError(
          err instanceof Error ? err.message : "Could not start recording",
        );
      }
      syncTransportControls();
    }

    function stopRecording(): void {
      clearCountIn();
      if (!mediaRecorder) {
        recordingGeneration += 1;
        recordingPending = false;
        model.set("is_recording", false);
        model.set("recording_track", -1);
        model.set("recording_countdown_beats", 0);
        if (recordingStartedPlayback) model.set("is_playing", false);
        recordingStartedPlayback = false;
        stopStream();
        model.save_changes();
        syncTransportControls();
        return;
      }
      if (mediaRecorder.state !== "inactive") {
        recordingStopBeat = Math.max(
          recordingStartBeat,
          playbackDisplayBeat ?? boundedCurrentBeat(),
        );
        mediaRecorder.stop();
      }
    }

    function connectMediaElement(
      media: HTMLMediaElement,
      track: TimelineTrack,
    ): void {
      const bus = getSessionBus(model.get("session_id") as string);
      const ctx = bus?.audioCtx || getAudioContext();
      if (!ctx || !ctx.createMediaElementSource) return;
      try {
        const source = ctx.createMediaElementSource(media);
        const target =
          bus?.channels?.[track.channel_index]?.gain ||
          bus?.masterGain ||
          ctx.destination;
        source.connect(target);
        activeSources.push(source);
      } catch (_) {
        // Browsers throw if media elements cannot be connected; direct playback still works.
      }
    }

    function playClip(clip: AudioClip, offsetSeconds: number): void {
      if (!clip.audio_url || clip.muted) return;
      const track = getTracks(model)[clip.track_index];
      if (!track || track.muted) return;
      const media = new Audio(clip.audio_url);
      media.preload = "auto";
      media.loop = Boolean(clip.loop);
      media.currentTime = Math.max(0, offsetSeconds);
      connectMediaElement(media, track);
      activeMedia.push(media);
      void media.play().catch(() => {});
    }

    function maybeExtendTimelineForRecording(beat: number): boolean {
      if (
        !Boolean(model.get("is_recording")) ||
        !Boolean(model.get("auto_extend_recording"))
      )
        return false;

      const bpb = beatsPerBar(model);
      let currentLength = timelineLength(model);
      if (currentLength >= MAX_TIMELINE_BEATS) return false;
      if (beat < currentLength - bpb) return false;

      const extendBy = Math.max(bpb, recordingExtendBeats(model));
      let nextLength = currentLength;
      while (beat >= nextLength - bpb && nextLength < MAX_TIMELINE_BEATS) {
        nextLength = Math.min(MAX_TIMELINE_BEATS, nextLength + extendBy);
      }
      if (nextLength <= currentLength) return false;

      model.set("length", nextLength);
      model.save_changes();
      syncTimeline();
      return true;
    }

    function startPlayback(): void {
      clearScheduledPlayback();
      const ctx = getAudioContext();
      void ctx?.resume?.();

      const tracks = getTracks(model);
      const hasSolo = tracks.some((track) => track.solo);
      const clips = getClips(model);
      const bpm = Math.max(1, numberValue(model.get("bpm"), 120));
      const bps = bpm / 60;
      const length = timelineLength(model);
      const startBeat =
        boundedCurrentBeat() >= length ? 0 : boundedCurrentBeat();
      playbackDisplayBeat = startBeat;
      const startMs = performance.now();

      clips.forEach((clip) => {
        const track = tracks[clip.track_index];
        if (!track || track.muted || (hasSolo && !track.solo) || clip.muted)
          return;
        if (clipEnd(clip) <= startBeat && !clip.loop) return;
        const beatDelta = clip.start - startBeat;
        const delayMs = Math.max(0, (beatDelta / bps) * 1000);
        const offsetBeats =
          clip.loop && startBeat > clip.start
            ? (startBeat - clip.start) % Math.max(0.001, clip.duration)
            : Math.max(0, startBeat - clip.start);
        const offsetSeconds = offsetBeats / bps;
        scheduledTimers.push(
          setTimeout(() => playClip(clip, offsetSeconds), delayMs),
        );
      });

      playheadTimer = setInterval(() => {
        const nextBeat =
          startBeat + ((performance.now() - startMs) / 1000) * bps;
        maybeExtendTimelineForRecording(nextBeat);
        const currentLength = timelineLength(model);
        if (nextBeat >= currentLength) {
          playbackDisplayBeat = currentLength;
          model.set("current_beat", currentLength);
          model.set("is_playing", false);
          model.save_changes();
          stopPlayback(false);
          return;
        }
        playbackDisplayBeat = nextBeat;
        syncTransportControls();
      }, 50);
    }

    function stopPlayback(save = false): void {
      clearScheduledPlayback();
      if (save) setAndSave(model, "is_playing", false);
      syncTransportControls();
    }

    function seekToBeat(
      beat: number,
      save = true,
      restartPlayback = true,
    ): void {
      if (mediaRecorder || countInTimer || recordingPending) return;
      const nextBeat = clampBeat(model, beat);
      const wasPlaying = Boolean(model.get("is_playing"));
      if (wasPlaying && !restartPlayback) clearScheduledPlayback();
      playbackDisplayBeat = null;
      model.set("current_beat", nextBeat);
      if (save) model.save_changes();
      syncTransportControls();
      if (restartPlayback && wasPlaying) startPlayback();
    }

    function beatFromPointer(
      event: PointerEvent,
      surface: HTMLElement,
    ): number {
      const rect = surface.getBoundingClientRect();
      const ratio =
        rect.width <= 0
          ? 0
          : Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      return ratio * timelineLength(model);
    }

    function bindSeekSurface(surface: HTMLElement): void {
      surface.addEventListener("pointerdown", (event) => {
        if (
          event.button !== 0 ||
          (event.target as Element | null)?.closest(".nbplay-timeline-clip")
        )
          return;
        event.preventDefault();
        surface.setPointerCapture?.(event.pointerId);
        let latestBeat = beatFromPointer(event, surface);
        seekToBeat(latestBeat, false, false);

        const onMove = (moveEvent: PointerEvent) => {
          latestBeat = beatFromPointer(moveEvent, surface);
          if (seekFrame !== null) return;
          seekFrame = requestAnimationFrame(() => {
            seekFrame = null;
            seekToBeat(latestBeat, false, false);
          });
        };
        const onUp = (upEvent: PointerEvent) => {
          if (seekFrame !== null) {
            cancelAnimationFrame(seekFrame);
            seekFrame = null;
          }
          seekToBeat(latestBeat, true, true);
          surface.releasePointerCapture?.(upEvent.pointerId);
          surface.removeEventListener("pointermove", onMove);
          surface.removeEventListener("pointerup", onUp);
          surface.removeEventListener("pointercancel", onUp);
        };
        surface.addEventListener("pointermove", onMove);
        surface.addEventListener("pointerup", onUp);
        surface.addEventListener("pointercancel", onUp);
      });
    }

    function toggleTrack(
      index: number,
      key: "armed" | "muted" | "solo" | "monitor",
    ): void {
      const tracks = getTracks(model);
      if (index < 0 || index >= tracks.length) return;
      tracks[index] = { ...tracks[index], [key]: !tracks[index][key] };
      model.set("tracks", tracks);
      model.save_changes();
      syncTimeline();
    }

    function selectClip(clipId: string): void {
      model.set("selected_clip_id", clipId);
      model.save_changes();
      syncTimeline();
    }

    function removeSelectedClip(): void {
      const selected = String(model.get("selected_clip_id") || "");
      if (!selected) return;
      model.set(
        "clips",
        getClips(model).filter((clip) => clip.id !== selected),
      );
      model.set("selected_clip_id", "");
      model.save_changes();
      syncTimeline();
    }

    function syncTransportControls(): void {
      if (disposed) return;
      const playing = Boolean(model.get("is_playing"));
      const recording = Boolean(model.get("is_recording"));
      const countdown = Math.max(
        0,
        numberValue(model.get("recording_countdown_beats"), 0),
      );
      const beat =
        playbackDisplayBeat ?? numberValue(model.get("current_beat"), 0);
      const bpb = beatsPerBar(model);
      const playBtn = root.querySelector(
        ".nbplay-timeline-play",
      ) as HTMLButtonElement | null;
      const recBtn = root.querySelector(
        ".nbplay-timeline-record",
      ) as HTMLButtonElement | null;
      const position = root.querySelector(
        ".nbplay-timeline-position",
      ) as HTMLElement | null;
      playBtn?.classList.toggle("active", playing);
      if (playBtn) playBtn.textContent = playing ? "Stop" : "Play";
      recBtn?.classList.toggle("active", recording);
      if (recBtn) {
        recBtn.textContent =
          recording && countdown > 0
            ? `Count ${Math.ceil(countdown)}`
            : recording
              ? "Stop Rec"
              : "Rec";
      }
      if (position) position.textContent = beatLabel(beat, bpb);
      syncPlayhead(beat);
    }

    function syncPlayhead(beatOverride?: number): void {
      const length = timelineLength(model);
      const beat = clampBeat(
        model,
        beatOverride ?? numberValue(model.get("current_beat"), 0),
      );
      const left = `${(beat / length) * 100}%`;
      root.querySelectorAll(".nbplay-timeline-playhead").forEach((playhead) => {
        (playhead as HTMLElement).style.left = left;
      });
    }

    function syncTimeline(): void {
      if (disposed) return;
      const tracks = getTracks(model);
      const clips = getClips(model);
      const length = timelineLength(model);
      const bpb = beatsPerBar(model);
      const bars = Math.max(1, Math.ceil(length / bpb));
      const countInBars = Math.max(
        0,
        numberValue(model.get("count_in_bars"), 0),
      );
      const autoExtendRecording = Boolean(model.get("auto_extend_recording"));
      const recordingExtendBars = Math.max(
        1,
        numberValue(model.get("recording_extend_bars"), 8),
      );
      const selected = String(model.get("selected_clip_id") || "");
      const error = String(model.get("recording_error") || "");
      const recordingTrack = numberValue(model.get("recording_track"), -1);

      const rows = tracks
        .map((track, index) => {
          const rowClips = clips.filter((clip) => clip.track_index === index);
          const clipHtml = rowClips
            .map((clip) => {
              const left = Math.max(
                0,
                Math.min(100, (clip.start / length) * 100),
              );
              const width = Math.max(
                1,
                Math.min(100 - left, (clip.duration / length) * 100),
              );
              const classes = [
                "nbplay-timeline-clip",
                clip.id === selected ? "selected" : "",
                clip.muted ? "muted" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return `<button class="${classes}" data-clip="${escapeHtml(clip.id)}" style="left:${left}%;width:${width}%">
                <span>${escapeHtml(clip.name)}</span>
                <small>${beatLabel(clip.start, bpb)}</small>
              </button>`;
            })
            .join("");
          return `<div class="nbplay-timeline-row ${recordingTrack === index ? "recording" : ""}" data-track="${index}">
            <div class="nbplay-timeline-track-controls">
              <div class="nbplay-timeline-track-name">${escapeHtml(track.name)}</div>
              <div class="nbplay-timeline-track-buttons">
                <button class="nbplay-track-arm ${track.armed ? "active" : ""}" data-action="armed" title="Arm track">R</button>
                <button class="nbplay-track-monitor ${track.monitor ? "active" : ""}" data-action="monitor" title="Input monitor">I</button>
                <button class="nbplay-track-mute ${track.muted ? "active" : ""}" data-action="muted" title="Mute track">M</button>
                <button class="nbplay-track-solo ${track.solo ? "active" : ""}" data-action="solo" title="Solo track">S</button>
              </div>
            </div>
            <div class="nbplay-timeline-lane nbplay-timeline-seek-surface"><div class="nbplay-timeline-playhead"></div>${clipHtml}</div>
          </div>`;
        })
        .join("");

      root.innerHTML = `<div class="nbplay-timeline-header">
        <h3>nbplay</h3>
        <span class="nbplay-badge">timeline</span>
        <div class="nbplay-timeline-actions">
          <label class="nbplay-timeline-field" title="Timeline length in bars">
            <span>Bars</span>
            <input class="nbplay-timeline-bars" type="number" min="1" max="256" step="1" value="${bars}" />
          </label>
          <label class="nbplay-timeline-field" title="Recording count-in in bars">
            <span>Count</span>
            <input class="nbplay-timeline-count-in" type="number" min="0" max="8" step="1" value="${countInBars}" />
          </label>
          <label class="nbplay-timeline-field" title="Extend timeline while recording">
            <span>Auto</span>
            <input class="nbplay-timeline-auto-extend" type="checkbox" ${autoExtendRecording ? "checked" : ""} />
          </label>
          <label class="nbplay-timeline-field" title="Bars to add while recording">
            <span>Ext</span>
            <input class="nbplay-timeline-extend-bars" type="number" min="1" max="256" step="1" value="${recordingExtendBars}" />
          </label>
          <button class="nbplay-timeline-reset" title="Reset playhead">Reset</button>
          <button class="nbplay-timeline-play" title="Play timeline">Play</button>
          <button class="nbplay-timeline-record" title="Record armed track">Rec</button>
          <button class="nbplay-timeline-delete" title="Delete selected clip">Delete</button>
        </div>
        <div class="nbplay-timeline-position">1.1</div>
      </div>
      <div class="nbplay-timeline-ruler">
        <div class="nbplay-timeline-ruler-spacer"></div>
        <div class="nbplay-timeline-ruler-track nbplay-timeline-seek-surface"></div>
      </div>
      <div class="nbplay-timeline-body">
        ${rows || `<div class="nbplay-timeline-empty">No tracks</div>`}
      </div>
      <div class="nbplay-timeline-status">${escapeHtml(error)}</div>`;

      const ruler = root.querySelector(
        ".nbplay-timeline-ruler-track",
      ) as HTMLElement;
      ruler.innerHTML = `${Array.from({ length: bars }, (_, i) => {
        const left = ((i * bpb) / length) * 100;
        return `<span style="left:${left}%">${i + 1}</span>`;
      }).join("")}<div class="nbplay-timeline-playhead"></div>`;

      root
        .querySelector(".nbplay-timeline-bars")
        ?.addEventListener("change", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const nextBars = Math.max(1, Math.min(256, Number(input.value) || 1));
          model.set("length", nextBars * beatsPerBar(model));
          model.save_changes();
        });
      root
        .querySelector(".nbplay-timeline-count-in")
        ?.addEventListener("change", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const nextBars = Math.max(0, Math.min(8, Number(input.value) || 0));
          model.set("count_in_bars", nextBars);
          model.save_changes();
          syncTransportControls();
        });
      root
        .querySelector(".nbplay-timeline-auto-extend")
        ?.addEventListener("change", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          model.set("auto_extend_recording", input.checked);
          model.save_changes();
        });
      root
        .querySelector(".nbplay-timeline-extend-bars")
        ?.addEventListener("change", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const nextBars = Math.max(1, Math.min(256, Number(input.value) || 8));
          model.set("recording_extend_bars", nextBars);
          model.save_changes();
        });
      root
        .querySelector(".nbplay-timeline-reset")
        ?.addEventListener("click", () => seekToBeat(0));
      root
        .querySelector(".nbplay-timeline-play")
        ?.addEventListener("click", () => {
          const next = !Boolean(model.get("is_playing"));
          setAndSave(model, "is_playing", next);
        });
      root
        .querySelector(".nbplay-timeline-record")
        ?.addEventListener("click", () => {
          if (mediaRecorder || Boolean(model.get("is_recording")))
            stopRecording();
          else void startRecording();
        });
      root
        .querySelector(".nbplay-timeline-delete")
        ?.addEventListener("click", removeSelectedClip);
      root.querySelectorAll(".nbplay-timeline-row").forEach((row) => {
        const index = numberValue((row as HTMLElement).dataset.track, -1);
        row.querySelectorAll("[data-action]").forEach((button) => {
          button.addEventListener("click", () => {
            const action = (button as HTMLElement).dataset.action as
              | "armed"
              | "monitor"
              | "muted"
              | "solo";
            toggleTrack(index, action);
          });
        });
      });
      root.querySelectorAll(".nbplay-timeline-clip").forEach((button) => {
        button.addEventListener("click", () => {
          selectClip((button as HTMLElement).dataset.clip || "");
        });
      });
      root
        .querySelectorAll(".nbplay-timeline-seek-surface")
        .forEach((surface) => bindSeekSurface(surface as HTMLElement));
      syncTransportControls();
    }

    function syncPlaybackState(): void {
      if (disposed) return;
      if (Boolean(model.get("is_playing"))) startPlayback();
      else {
        stopPlayback(false);
        if (mediaRecorder || countInTimer || recordingPending) stopRecording();
      }
      syncTransportControls();
    }

    function syncLengthState(): void {
      syncTimeline();
      syncTransportControls();
    }

    function syncPositionState(): void {
      syncTransportControls();
    }

    model.on("change:tracks", syncTimeline);
    model.on("change:clips", syncTimeline);
    model.on("change:selected_clip_id", syncTimeline);
    model.on("change:length", syncLengthState);
    model.on("change:time_signature_num", syncTimeline);
    model.on("change:count_in_bars", syncTimeline);
    model.on("change:auto_extend_recording", syncTimeline);
    model.on("change:recording_extend_bars", syncTimeline);
    model.on("change:recording_error", syncTimeline);
    model.on("change:recording_countdown_beats", syncTransportControls);
    model.on("change:is_playing", syncPlaybackState);
    model.on("change:is_recording", () => {
      if (disposed) return;
      if (Boolean(model.get("is_recording"))) {
        if (!mediaRecorder && !countInTimer && !recordingPending)
          void startRecording();
      } else if (mediaRecorder || countInTimer || recordingPending) {
        stopRecording();
      }
      syncTransportControls();
    });
    model.on("change:current_beat", syncPositionState);

    syncTimeline();

    return () => {
      disposed = true;
      clearCountIn();
      recordingGeneration += 1;
      recordingPending = false;
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      if (seekFrame !== null) {
        cancelAnimationFrame(seekFrame);
        seekFrame = null;
      }
      stopStream();
      clearScheduledPlayback();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      root.remove();
    };
  },
};
