// nbplay TimelineWidget - multi-track clip timeline and browser recorder.
//
// The timeline follows the session clock (see session.ts) for position and
// play state. Every armed lane records at once: microphone lanes share one
// getUserMedia stream, channel lanes tap their mixer channel through a
// MediaStreamAudioDestinationNode so instrument output is bounced to audio.

import { type AnyModel, bindShortcuts } from "./helpers.ts";
import {
  bindClock,
  type ClockEvent,
  getSessionBus,
  type SessionClock,
} from "./session.ts";

const MAX_TIMELINE_BEATS = 4096;
const CLIP_SNAP_BEATS = 0.25;
const MIN_CLIP_BEATS = 0.25;
const DRAG_THRESHOLD_PX = 3;

interface TimelineTrack {
  name: string;
  channel_index: number;
  armed: boolean;
  muted: boolean;
  solo: boolean;
  input: string;
  monitor: boolean;
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
  offset?: number;
  audio_url?: string;
  blob_type?: string;
  blob_size?: number;
  source?: string;
  sample_rate?: number;
}

interface RecordingLane {
  trackIndex: number;
  stream: MediaStream;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  tap: AudioNode | null;
  monitor: AudioNode | null;
  done: boolean;
}

interface ClipDrag {
  clipId: string;
  mode: "move" | "trim-start" | "trim-end";
  original: AudioClip;
  startX: number;
  startY: number;
  pixelsPerBeat: number;
  element: HTMLElement;
  moved: boolean;
  next: AudioClip;
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

function snapBeat(beat: number, step = CLIP_SNAP_BEATS): number {
  return Math.round(beat / step) * step;
}

function getTracks(model: AnyModel): TimelineTrack[] {
  const raw =
    (model.get("tracks") as Partial<TimelineTrack>[] | undefined) || [];
  return [...raw].map((track, index) => ({
    name: String(track.name ?? `Track ${index + 1}`),
    channel_index: numberValue(track.channel_index, index),
    armed: Boolean(track.armed),
    muted: Boolean(track.muted),
    solo: Boolean(track.solo),
    input: track.input === "channel" ? "channel" : "microphone",
    monitor: Boolean(track.monitor),
  }));
}

function getClips(model: AnyModel): AudioClip[] {
  const raw = (model.get("clips") as AudioClip[] | undefined) || [];
  return [...raw].map((clip, index) => ({
    ...clip,
    id: String(clip.id || `clip-${index}`),
    name: String(clip.name ?? `Clip ${index + 1}`),
    track_index: Math.max(0, numberValue(clip.track_index, 0)),
    start: Math.max(0, numberValue(clip.start, 0)),
    duration: Math.max(0.001, numberValue(clip.duration, 4)),
    offset: Math.max(0, numberValue(clip.offset, 0)),
    loop: Boolean(clip.loop),
    muted: Boolean(clip.muted),
  }));
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

function pixelsPerBeat(model: AnyModel): number {
  return Math.max(0, numberValue(model.get("pixels_per_beat"), 0));
}

function toUint8(data: unknown): Uint8Array | null {
  if (!data) return null;
  if (data instanceof DataView) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return null;
}

export default {
  render({ model, el }: { model: AnyModel; el: HTMLElement }) {
    const root = document.createElement("div");
    root.className = "nbplay-timeline";
    el.appendChild(root);

    model.set("is_recording", false);
    model.set("recording_track", -1);
    model.set("recording_tracks", []);

    let lanes: RecordingLane[] = [];
    let micStream: MediaStream | null = null;
    let pendingClips: AudioClip[] = [];
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
    let clipDrag: ClipDrag | null = null;
    let suppressClipClick = false;
    let disposed = false;
    const objectUrls = new Set<string>();
    const activeMedia: HTMLMediaElement[] = [];
    const activeSources: AudioNode[] = [];

    // Transport: the timeline follows the session clock (see session.ts).
    // Model writes that originate from clock events set `mirroring` so the
    // model observers below do not feed them back into the clock.
    let mirroring = false;
    let suppressRestart = false;

    function mirror(write: () => void, save = false): void {
      mirroring = true;
      try {
        write();
      } finally {
        mirroring = false;
      }
      if (save) model.save_changes();
    }

    function getAudioContext(): AudioContext | null {
      return clock().context();
    }

    function currentBeat(): number {
      return clampBeat(model, clock().beat());
    }

    function recordersActive(): boolean {
      return lanes.some((lane) => lane.recorder !== null);
    }

    function recordingActive(): boolean {
      return recordersActive() || Boolean(countInTimer) || recordingPending;
    }

    function setRecordingFlag(on: boolean): void {
      model.set("is_recording", on);
      clock().setRecording(on);
    }

    function onClockEvent(event: ClockEvent): void {
      const clk = clock();
      switch (event.type) {
        case "play":
          mirror(() => model.set("is_playing", true), true);
          startPlayback();
          syncTransportControls();
          break;
        case "stop":
          clearScheduledPlayback();
          mirror(() => {
            model.set("is_playing", false);
            model.set("current_beat", clampBeat(model, event.beat));
          }, true);
          if (recordingActive()) stopRecording();
          syncTransportControls();
          break;
        case "seek":
          playbackDisplayBeat = null;
          mirror(() => model.set("current_beat", clampBeat(model, event.beat)));
          if (clk.playing && !suppressRestart) startPlayback();
          syncTransportControls();
          break;
        case "tempo":
          if (Number(model.get("bpm")) !== clk.bpm) {
            mirror(() => model.set("bpm", clk.bpm), true);
          }
          if (clk.playing) startPlayback();
          break;
        case "record":
          if (clk.recording) {
            if (!recordingActive()) void startRecording();
          } else if (recordingActive()) {
            stopRecording();
          }
          syncTransportControls();
          break;
        case "loop":
          syncLoop();
          break;
        case "timesig":
          break;
      }
    }

    function onRebind(clk: SessionClock): void {
      clearScheduledPlayback();
      mirror(() => model.set("is_playing", clk.playing));
      if (clk.playing) startPlayback();
      syncTimeline();
    }

    const binding = bindClock(model, onClockEvent, onRebind);
    const clock = (): SessionClock => binding.clock();

    function togglePlay(): void {
      const clk = clock();
      if (clk.playing) clk.stop();
      else clk.play();
    }

    function toggleRecord(): void {
      if (recordingActive() || Boolean(model.get("is_recording")))
        stopRecording();
      else void startRecording();
    }

    const unbindShortcuts = bindShortcuts(root, {
      Space: togglePlay,
      "Shift+Space": () => {
        clock().stop();
        seekToBeat(0);
      },
      r: toggleRecord,
      l: () => toggleLoop(),
      d: () => duplicateSelectedClip(),
      Delete: () => removeSelectedClip(),
      Backspace: () => removeSelectedClip(),
    });

    // Recording

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

    function disconnectNode(node: AudioNode | null): void {
      if (!node) return;
      try {
        node.disconnect();
      } catch (_) {
        // Ignore already-disconnected nodes.
      }
    }

    function stopMicStream(): void {
      micStream?.getTracks().forEach((track) => track.stop());
      micStream = null;
    }

    function releaseLanes(): void {
      lanes.forEach((lane) => {
        disconnectNode(lane.monitor);
        disconnectNode(lane.tap);
      });
      lanes = [];
      pendingClips = [];
      stopMicStream();
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
      activeSources.forEach((source) => disconnectNode(source));
      activeSources.length = 0;
      if (playheadTimer) {
        clearInterval(playheadTimer);
        playheadTimer = null;
      }
      playbackDisplayBeat = null;
    }

    function writeRecordingError(message: string): void {
      if (disposed) return;
      clearCountIn();
      releaseLanes();
      recordingPending = false;
      recordingGeneration += 1;
      recordingStartedPlayback = false;
      recordingStopBeat = null;
      model.set("recording_error", message);
      setRecordingFlag(false);
      model.set("recording_track", -1);
      model.set("recording_tracks", []);
      model.save_changes();
      syncTimeline();
    }

    /** Armed lanes, else the previously chosen lane, else the first lane. */
    function findRecordingTracks(): number[] {
      const tracks = getTracks(model);
      const armed = tracks
        .map((track, index) => (track.armed ? index : -1))
        .filter((index) => index >= 0);
      if (armed.length > 0) return armed;
      const current = numberValue(model.get("recording_track"), -1);
      if (current >= 0 && current < tracks.length) return [current];
      return tracks.length > 0 ? [0] : [];
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

    function finalizeLane(lane: RecordingLane): void {
      const mimeType =
        lane.recorder?.mimeType || lane.chunks[0]?.type || "audio/webm";
      const blob = new Blob(lane.chunks, { type: mimeType });
      lane.chunks = [];
      lane.recorder = null;
      lane.done = true;
      if (blob.size && typeof URL !== "undefined" && URL.createObjectURL) {
        const url = URL.createObjectURL(blob);
        objectUrls.add(url);
        const takeNumber = getClips(model).length + pendingClips.length + 1;
        pendingClips.push({
          id: uniqueClipId(),
          name: `Take ${takeNumber}`,
          track_index: lane.trackIndex,
          start: recordingStartBeat,
          duration: recordingDurationBeats(),
          loop: false,
          muted: false,
          recorded: true,
          offset: 0,
          audio_url: url,
          blob_type: blob.type,
          blob_size: blob.size,
          source: "recording",
          sample_rate: getAudioContext()?.sampleRate || 44100,
        });
      }
      if (lanes.every((item) => item.done)) finishRecording();
    }

    function finishRecording(): void {
      const newClips = pendingClips;
      pendingClips = [];
      releaseLanes();
      recordingStartedPlayback = false;
      recordingStopBeat = null;
      if (disposed) return;

      if (newClips.length === 0) {
        writeRecordingError("No audio was captured");
        return;
      }

      const clips = [...getClips(model), ...newClips];
      const last = newClips[newClips.length - 1];
      model.set("clips", clips);
      model.set("recorded_clip", last);
      model.set("selected_clip_id", last.id);
      model.set("recording_error", "");
      setRecordingFlag(false);
      model.set("recording_track", -1);
      model.set("recording_tracks", []);
      model.set("recording_countdown_beats", 0);
      model.set(
        "length",
        Math.max(
          numberValue(model.get("length"), 16),
          ...newClips.map((clip) => clipEnd(clip)),
        ),
      );
      model.save_changes();
      syncTimeline();
    }

    function startInputMonitoring(
      track: TimelineTrack,
      stream: MediaStream,
    ): AudioNode | null {
      if (!track.monitor) return null;
      const bus = getSessionBus(model.get("session_id") as string);
      const ctx = bus?.audioCtx || getAudioContext();
      if (!ctx?.createMediaStreamSource) return null;
      try {
        const source = ctx.createMediaStreamSource(stream);
        const target =
          bus?.channels?.[track.channel_index]?.gain ||
          bus?.masterGain ||
          ctx.destination;
        source.connect(target);
        void ctx.resume?.();
        return source;
      } catch (_) {
        // Monitoring is best-effort; recording still works without routing.
        return null;
      }
    }

    /** Tap a mixer channel into a MediaStream for recording. */
    function channelTap(
      track: TimelineTrack,
    ): { stream: MediaStream; node: AudioNode } | null {
      const bus = getSessionBus(model.get("session_id") as string);
      const ctx = bus?.audioCtx;
      const gain = bus?.channels?.[track.channel_index]?.gain;
      if (!ctx?.createMediaStreamDestination || !gain) return null;
      try {
        const destination = ctx.createMediaStreamDestination();
        gain.connect(destination);
        return { stream: destination.stream, node: destination };
      } catch (_) {
        return null;
      }
    }

    function ensurePlaybackStarted(): void {
      const clk = clock();
      if (clk.playing) return;
      recordingStartedPlayback = true;
      clk.play();
    }

    function beginRecording(
      Recorder: typeof MediaRecorder,
      startBeat: number,
      generation: number,
    ): void {
      if (
        generation !== recordingGeneration ||
        lanes.length === 0 ||
        recordersActive()
      )
        return;
      recordingPending = false;
      recordingStartMs = performance.now();
      recordingStartBeat = clampBeat(model, startBeat);
      recordingStopBeat = null;
      pendingClips = [];
      lanes.forEach((lane) => {
        lane.chunks = [];
        lane.done = false;
        const recorder = new Recorder(lane.stream);
        recorder.addEventListener("dataavailable", (event) => {
          if (event.data?.size) lane.chunks.push(event.data);
        });
        recorder.addEventListener("stop", () => finalizeLane(lane), {
          once: true,
        });
        lane.recorder = recorder;
      });
      lanes.forEach((lane) => lane.recorder?.start());
      model.set("recording_error", "");
      model.set("recording_track", lanes[0].trackIndex);
      model.set(
        "recording_tracks",
        lanes.map((lane) => lane.trackIndex),
      );
      model.set("recording_countdown_beats", 0);
      setRecordingFlag(true);
      ensurePlaybackStarted();
      model.save_changes();
      syncTimeline();
    }

    function scheduleCountIn(
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
          releaseLanes();
          return;
        }
        if (generation !== recordingGeneration) return;
        beginRecording(Recorder, startBeat, generation);
      }, delayMs);
    }

    async function startRecording(): Promise<void> {
      if (recordingActive()) return;
      const targets = findRecordingTracks();
      if (targets.length === 0) {
        writeRecordingError("Add a track before recording");
        return;
      }
      const tracks = getTracks(model);
      const needsMic = targets.some(
        (index) => tracks[index].input !== "channel",
      );

      const nav = navigator as Navigator & {
        mediaDevices?: {
          getUserMedia?: (
            constraints: MediaStreamConstraints,
          ) => Promise<MediaStream>;
        };
      };
      const Recorder = (globalThis as { MediaRecorder?: typeof MediaRecorder })
        .MediaRecorder;
      if (!Recorder || (needsMic && !nav.mediaDevices?.getUserMedia)) {
        writeRecordingError(
          needsMic
            ? "Microphone recording is unavailable in this browser"
            : "Recording is unavailable in this browser",
        );
        return;
      }

      const generation = ++recordingGeneration;
      recordingPending = true;
      model.set("recording_error", "");
      model.set("recording_track", targets[0]);
      model.set("recording_tracks", targets);
      model.set("recording_countdown_beats", 0);
      setRecordingFlag(true);
      model.save_changes();
      syncTimeline();

      try {
        let stream: MediaStream | null = null;
        if (needsMic) {
          stream = await nav.mediaDevices!.getUserMedia!({ audio: true });
          if (
            disposed ||
            generation !== recordingGeneration ||
            !recordingPending ||
            !model.get("is_recording")
          ) {
            stream.getTracks().forEach((track) => track.stop());
            if (generation === recordingGeneration) recordingPending = false;
            return;
          }
          micStream = stream;
        }

        const built: RecordingLane[] = [];
        for (const index of targets) {
          const track = tracks[index];
          if (track.input === "channel") {
            const tap = channelTap(track);
            if (!tap) {
              throw new Error(
                `Mixer channel ${track.channel_index + 1} is not available for recording`,
              );
            }
            built.push({
              trackIndex: index,
              stream: tap.stream,
              recorder: null,
              chunks: [],
              tap: tap.node,
              monitor: null,
              done: false,
            });
          } else {
            built.push({
              trackIndex: index,
              stream: stream!,
              recorder: null,
              chunks: [],
              tap: null,
              monitor: startInputMonitoring(track, stream!),
              done: false,
            });
          }
        }
        lanes = built;

        const targetBeat = currentBeat();
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
          clock().seek(preRollStartBeat);
          ensurePlaybackStarted();
        }
        model.save_changes();
        if (delayBeats > 0) {
          scheduleCountIn(Recorder, targetBeat, delayBeats, generation);
        } else {
          beginRecording(Recorder, targetBeat, generation);
        }
      } catch (err) {
        if (generation !== recordingGeneration) return;
        releaseLanes();
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
      if (!recordersActive()) {
        recordingGeneration += 1;
        recordingPending = false;
        setRecordingFlag(false);
        model.set("recording_track", -1);
        model.set("recording_tracks", []);
        model.set("recording_countdown_beats", 0);
        const stopPlayback = recordingStartedPlayback;
        recordingStartedPlayback = false;
        releaseLanes();
        model.save_changes();
        if (stopPlayback) clock().stop();
        syncTimeline();
        return;
      }
      recordingStopBeat = Math.max(recordingStartBeat, currentBeat());
      lanes.forEach((lane) => {
        const recorder = lane.recorder;
        if (!recorder) return;
        if (recorder.state !== "inactive") recorder.stop();
        else finalizeLane(lane);
      });
    }

    // Playback

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
      if (!model.get("is_recording") || !model.get("auto_extend_recording"))
        return false;

      const bpb = beatsPerBar(model);
      const currentLength = timelineLength(model);
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

    function keepPlayheadVisible(beat: number): void {
      const ppb = pixelsPerBeat(model);
      if (ppb <= 0) return;
      const scroll = root.querySelector(
        ".nbplay-timeline-scroll",
      ) as HTMLElement | null;
      const spacer = root.querySelector(
        ".nbplay-timeline-ruler-spacer",
      ) as HTMLElement | null;
      if (!scroll) return;
      const controlsWidth = spacer?.offsetWidth || 0;
      const px = beat * ppb;
      const visible = scroll.clientWidth - controlsWidth;
      if (visible <= 0) return;
      if (px < scroll.scrollLeft || px > scroll.scrollLeft + visible) {
        scroll.scrollLeft = Math.max(0, px - visible * 0.2);
      }
    }

    function startPlayback(): void {
      clearScheduledPlayback();
      const clk = clock();
      const ctx = clk.context();
      void ctx?.resume?.();

      const length = timelineLength(model);
      if (clk.beat() >= length) {
        // Reached the end earlier: rewind. The seek event re-enters here.
        clk.seek(0);
        return;
      }
      const tracks = getTracks(model);
      const hasSolo = tracks.some((track) => track.solo);
      const clips = getClips(model);
      const spb = clk.secondsPerBeat();
      const startBeat = clk.beat();
      playbackDisplayBeat = startBeat;

      clips.forEach((clip) => {
        const track = tracks[clip.track_index];
        if (!track || track.muted || (hasSolo && !track.solo) || clip.muted)
          return;
        if (clipEnd(clip) <= startBeat && !clip.loop) return;
        const beatDelta = clip.start - startBeat;
        const delayMs = Math.max(0, beatDelta * spb * 1000);
        const offsetBeats =
          clip.loop && startBeat > clip.start
            ? (startBeat - clip.start) % Math.max(0.001, clip.duration)
            : Math.max(0, startBeat - clip.start);
        const offsetSeconds = (offsetBeats + (clip.offset || 0)) * spb;
        scheduledTimers.push(
          setTimeout(() => playClip(clip, offsetSeconds), delayMs),
        );
      });

      playheadTimer = setInterval(() => {
        const nextBeat = clk.beat();
        maybeExtendTimelineForRecording(nextBeat);
        const currentLength = timelineLength(model);
        if (nextBeat >= currentLength) {
          // End of the arrangement: stop the session and park the playhead.
          playbackDisplayBeat = currentLength;
          clearScheduledPlayback();
          clk.stop();
          clk.seek(currentLength);
          return;
        }
        playbackDisplayBeat = nextBeat;
        syncTransportControls();
        keepPlayheadVisible(nextBeat);
      }, 50);
    }

    // Seeking and loop range

    function seekToBeat(
      beat: number,
      save = true,
      restartPlayback = true,
    ): void {
      if (recordingActive()) return;
      const nextBeat = clampBeat(model, beat);
      const clk = clock();
      if (clk.playing && !restartPlayback) clearScheduledPlayback();
      suppressRestart = !restartPlayback;
      try {
        clk.seek(nextBeat);
      } finally {
        suppressRestart = false;
      }
      if (save) model.save_changes();
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
        const target = event.target as Element | null;
        if (
          event.button !== 0 ||
          target?.closest(".nbplay-timeline-clip") ||
          target?.closest(".nbplay-timeline-loop-handle")
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

    function toggleLoop(): void {
      const clk = clock();
      const loop = clk.loop;
      if (loop.enabled) {
        clk.setLoop(false, loop.startBeat, loop.endBeat);
        return;
      }
      const bpb = beatsPerBar(model);
      const length = timelineLength(model);
      const hasRange = loop.endBeat > loop.startBeat && loop.startBeat < length;
      const start = hasRange ? loop.startBeat : 0;
      const end = hasRange
        ? Math.min(length, loop.endBeat)
        : Math.min(length, 4 * bpb);
      clk.setLoop(true, start, Math.max(start + bpb, end));
    }

    function bindLoopHandle(handle: HTMLElement, ruler: HTMLElement): void {
      handle.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture?.(event.pointerId);
        const edge = handle.dataset.edge === "start" ? "start" : "end";
        const bpb = beatsPerBar(model);
        const length = timelineLength(model);

        const apply = (moveEvent: PointerEvent) => {
          const clk = clock();
          const loop = clk.loop;
          const beat = Math.max(
            0,
            Math.min(length, snapBeat(beatFromPointer(moveEvent, ruler), bpb)),
          );
          if (edge === "start") {
            clk.setLoop(true, Math.min(beat, loop.endBeat - bpb), loop.endBeat);
          } else {
            clk.setLoop(
              true,
              loop.startBeat,
              Math.max(beat, loop.startBeat + bpb),
            );
          }
        };
        const onUp = (upEvent: PointerEvent) => {
          handle.releasePointerCapture?.(upEvent.pointerId);
          handle.removeEventListener("pointermove", apply);
          handle.removeEventListener("pointerup", onUp);
          handle.removeEventListener("pointercancel", onUp);
        };
        handle.addEventListener("pointermove", apply);
        handle.addEventListener("pointerup", onUp);
        handle.addEventListener("pointercancel", onUp);
      });
    }

    /** Update the loop button and ruler brace from the clock's loop range. */
    function syncLoop(): void {
      if (disposed) return;
      const loop = clock().loop;
      const length = timelineLength(model);
      const button = root.querySelector(
        ".nbplay-timeline-loop-btn",
      ) as HTMLButtonElement | null;
      button?.classList.toggle("active", loop.enabled);
      const ruler = root.querySelector(
        ".nbplay-timeline-ruler-track",
      ) as HTMLElement | null;
      if (!ruler) return;
      const brace = ruler.querySelector(
        ".nbplay-timeline-loop",
      ) as HTMLElement | null;
      const handles = ruler.querySelectorAll(".nbplay-timeline-loop-handle");
      const show = loop.enabled && loop.endBeat > loop.startBeat;
      if (!show) {
        brace?.remove();
        handles.forEach((handle) => handle.remove());
        return;
      }
      const left = Math.max(0, Math.min(100, (loop.startBeat / length) * 100));
      const right = Math.max(
        left,
        Math.min(100, (loop.endBeat / length) * 100),
      );
      if (brace && handles.length === 2) {
        brace.style.left = `${left}%`;
        brace.style.width = `${right - left}%`;
        (handles[0] as HTMLElement).style.left = `${left}%`;
        (handles[1] as HTMLElement).style.left = `${right}%`;
        return;
      }
      brace?.remove();
      handles.forEach((handle) => handle.remove());
      const braceEl = document.createElement("div");
      braceEl.className = "nbplay-timeline-loop";
      braceEl.style.left = `${left}%`;
      braceEl.style.width = `${right - left}%`;
      const startHandle = document.createElement("div");
      startHandle.className = "nbplay-timeline-loop-handle";
      startHandle.dataset.edge = "start";
      startHandle.title = "Loop start";
      startHandle.style.left = `${left}%`;
      const endHandle = document.createElement("div");
      endHandle.className = "nbplay-timeline-loop-handle";
      endHandle.dataset.edge = "end";
      endHandle.title = "Loop end";
      endHandle.style.left = `${right}%`;
      ruler.append(braceEl, startHandle, endHandle);
      bindLoopHandle(startHandle, ruler);
      bindLoopHandle(endHandle, ruler);
    }

    // Track and clip editing

    function updateTrack(index: number, patch: Partial<TimelineTrack>): void {
      const tracks = getTracks(model);
      if (index < 0 || index >= tracks.length) return;
      tracks[index] = { ...tracks[index], ...patch };
      model.set("tracks", tracks);
      model.save_changes();
      syncTimeline();
    }

    function toggleTrack(
      index: number,
      key: "armed" | "muted" | "solo" | "monitor",
    ): void {
      const tracks = getTracks(model);
      if (index < 0 || index >= tracks.length) return;
      updateTrack(index, { [key]: !tracks[index][key] });
    }

    function selectClip(clipId: string): void {
      model.set("selected_clip_id", clipId);
      model.save_changes();
      syncTimeline();
    }

    function writeClips(clips: AudioClip[], selectedId?: string): void {
      model.set("clips", clips);
      if (selectedId !== undefined) model.set("selected_clip_id", selectedId);
      const end = clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0);
      if (end > timelineLength(model)) {
        model.set("length", Math.min(MAX_TIMELINE_BEATS, end));
      }
      model.save_changes();
      syncTimeline();
    }

    function removeSelectedClip(): void {
      const selected = String(model.get("selected_clip_id") || "");
      if (!selected) return;
      writeClips(
        getClips(model).filter((clip) => clip.id !== selected),
        "",
      );
    }

    function duplicateSelectedClip(): void {
      const selected = String(model.get("selected_clip_id") || "");
      const clips = getClips(model);
      const source = clips.find((clip) => clip.id === selected);
      if (!source) return;
      const copy: AudioClip = {
        ...source,
        id: uniqueClipId(),
        start: clipEnd(source),
      };
      writeClips([...clips, copy], copy.id);
    }

    function rowIndexAt(clientY: number): number {
      const rows = root.querySelectorAll(".nbplay-timeline-row");
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (clientY >= rect.top && clientY <= rect.bottom) {
          return numberValue((row as HTMLElement).dataset.track, -1);
        }
      }
      return -1;
    }

    function dragPatch(drag: ClipDrag, event: PointerEvent): AudioClip {
      const orig = drag.original;
      const delta = snapBeat(
        (event.clientX - drag.startX) / drag.pixelsPerBeat,
      );
      if (drag.mode === "move") {
        const row = rowIndexAt(event.clientY);
        return {
          ...orig,
          start: Math.max(0, orig.start + delta),
          track_index: row >= 0 ? row : orig.track_index,
        };
      }
      if (drag.mode === "trim-start") {
        const offset = orig.offset || 0;
        const d = Math.max(
          -Math.min(offset, orig.start),
          Math.min(delta, orig.duration - MIN_CLIP_BEATS),
        );
        return {
          ...orig,
          start: orig.start + d,
          duration: orig.duration - d,
          offset: offset + d,
        };
      }
      return {
        ...orig,
        duration: Math.max(MIN_CLIP_BEATS, orig.duration + delta),
      };
    }

    function positionClipElement(element: HTMLElement, clip: AudioClip): void {
      const length = timelineLength(model);
      const left = Math.max(0, Math.min(100, (clip.start / length) * 100));
      const width = Math.max(
        1,
        Math.min(100 - left, (clip.duration / length) * 100),
      );
      element.style.left = `${left}%`;
      element.style.width = `${width}%`;
    }

    function bindClipDrag(button: HTMLElement): void {
      button.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        const clipId = button.dataset.clip || "";
        const clip = getClips(model).find((item) => item.id === clipId);
        const lane = button.parentElement as HTMLElement | null;
        if (!clip || !lane) return;
        const laneWidth = lane.getBoundingClientRect().width;
        if (laneWidth <= 0) return;
        const target = event.target as Element | null;
        const mode = target?.closest(".nbplay-timeline-clip-handle.start")
          ? "trim-start"
          : target?.closest(".nbplay-timeline-clip-handle.end")
            ? "trim-end"
            : "move";
        event.preventDefault();
        button.setPointerCapture?.(event.pointerId);
        clipDrag = {
          clipId,
          mode,
          original: clip,
          startX: event.clientX,
          startY: event.clientY,
          pixelsPerBeat: laneWidth / timelineLength(model),
          element: button,
          moved: false,
          next: clip,
        };

        const onMove = (moveEvent: PointerEvent) => {
          const drag = clipDrag;
          if (!drag) return;
          if (
            !drag.moved &&
            Math.abs(moveEvent.clientX - drag.startX) < DRAG_THRESHOLD_PX &&
            Math.abs(moveEvent.clientY - drag.startY) < DRAG_THRESHOLD_PX
          )
            return;
          drag.moved = true;
          drag.element.classList.add("dragging");
          drag.next = dragPatch(drag, moveEvent);
          positionClipElement(drag.element, drag.next);
        };
        const onUp = (upEvent: PointerEvent) => {
          button.releasePointerCapture?.(upEvent.pointerId);
          button.removeEventListener("pointermove", onMove);
          button.removeEventListener("pointerup", onUp);
          button.removeEventListener("pointercancel", onUp);
          const drag = clipDrag;
          clipDrag = null;
          if (!drag) return;
          drag.element.classList.remove("dragging");
          if (!drag.moved) return;
          suppressClipClick = true;
          writeClips(
            getClips(model).map((item) =>
              item.id === drag.clipId ? drag.next : item,
            ),
            drag.clipId,
          );
        };
        button.addEventListener("pointermove", onMove);
        button.addEventListener("pointerup", onUp);
        button.addEventListener("pointercancel", onUp);
      });
      button.addEventListener("click", () => {
        if (suppressClipClick) {
          suppressClipClick = false;
          return;
        }
        selectClip(button.dataset.clip || "");
      });
    }

    // Clip audio transfer (Python <-> browser)

    function handleExportRequest(): void {
      if (disposed) return;
      const clipId = String(model.get("export_clip_id") || "");
      if (!clipId) return;
      const clip = getClips(model).find((item) => item.id === clipId);
      const finish = (error: string) => {
        if (disposed) return;
        model.set("recording_error", error);
        model.set("export_clip_id", "");
        model.save_changes();
        syncTimeline();
      };
      if (!clip?.audio_url) {
        finish("Clip has no audio to export");
        return;
      }
      fetch(clip.audio_url)
        .then((response) => response.blob())
        .then(async (blob) => {
          const buffer = await blob.arrayBuffer();
          if (disposed) return;
          model.set("exported_clip", {
            ...clip,
            blob_type: blob.type || clip.blob_type || "",
            blob_size: blob.size,
          });
          model.set("exported_clip_data", new DataView(buffer));
          finish("");
        })
        .catch((err: unknown) => {
          finish(
            `Export failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        });
    }

    function handleImportRequest(): void {
      if (disposed) return;
      const request = (model.get("import_clip_request") ||
        {}) as Partial<AudioClip> & {
        measure_duration?: boolean;
      };
      if (!request.id) return;
      const bytes = toUint8(model.get("import_clip_data"));
      if (!bytes || bytes.length === 0) return;
      if (request.blob_size && bytes.length !== request.blob_size) return;
      const blob = new Blob([bytes.slice()], {
        type: request.blob_type || "audio/webm",
      });
      const url = URL.createObjectURL(blob);
      objectUrls.add(url);

      const apply = (durationBeats: number | null) => {
        if (disposed) return;
        const clips = getClips(model).map((clip) =>
          clip.id === request.id
            ? {
                ...clip,
                audio_url: url,
                blob_type: blob.type,
                blob_size: blob.size,
                duration: durationBeats ?? clip.duration,
              }
            : clip,
        );
        model.set("import_clip_request", {});
        writeClips(clips);
      };

      const ctx = getAudioContext();
      if (request.measure_duration && ctx?.decodeAudioData) {
        const copy = bytes.slice().buffer;
        Promise.resolve(ctx.decodeAudioData(copy))
          .then((decoded) => {
            const seconds =
              numberValue(
                (decoded as { duration?: number }).duration,
                decoded.length / Math.max(1, decoded.sampleRate),
              ) || 0;
            const bpm = Math.max(1, numberValue(model.get("bpm"), 120));
            apply(
              seconds > 0
                ? Math.max(MIN_CLIP_BEATS, seconds * (bpm / 60))
                : null,
            );
          })
          .catch(() => apply(null));
        return;
      }
      apply(null);
    }

    // Rendering

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
      const ppb = pixelsPerBeat(model);
      const laneStyle = ppb > 0 ? ` style="width:${length * ppb}px"` : "";
      const selected = String(model.get("selected_clip_id") || "");
      const error = String(model.get("recording_error") || "");
      const recordingTracks = (
        (model.get("recording_tracks") as number[] | undefined) || []
      ).map((value) => numberValue(value, -1));
      const previousScroll =
        (root.querySelector(".nbplay-timeline-scroll") as HTMLElement | null)
          ?.scrollLeft || 0;

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
                <i class="nbplay-timeline-clip-handle start"></i>
                <span>${escapeHtml(clip.name)}</span>
                <small>${beatLabel(clip.start, bpb)}</small>
                <i class="nbplay-timeline-clip-handle end"></i>
              </button>`;
            })
            .join("");
          const channelLabel =
            track.channel_index >= 0
              ? `Ch ${track.channel_index + 1}`
              : "No channel";
          return `<div class="nbplay-timeline-row ${recordingTracks.includes(index) ? "recording" : ""}" data-track="${index}">
            <div class="nbplay-timeline-track-controls">
              <div class="nbplay-timeline-track-name">${escapeHtml(track.name)}</div>
              <div class="nbplay-timeline-track-buttons">
                <button class="nbplay-track-arm ${track.armed ? "active" : ""}" data-action="armed" title="Arm track">R</button>
                <button class="nbplay-track-monitor ${track.monitor ? "active" : ""}" data-action="monitor" title="Input monitor">I</button>
                <button class="nbplay-track-mute ${track.muted ? "active" : ""}" data-action="muted" title="Mute track">M</button>
                <button class="nbplay-track-solo ${track.solo ? "active" : ""}" data-action="solo" title="Solo track">S</button>
              </div>
              <select class="nbplay-track-input" title="Record source">
                <option value="microphone" ${track.input === "microphone" ? "selected" : ""}>Mic</option>
                <option value="channel" ${track.input === "channel" ? "selected" : ""} ${track.channel_index < 0 ? "disabled" : ""}>${escapeHtml(channelLabel)}</option>
              </select>
            </div>
            <div class="nbplay-timeline-lane nbplay-timeline-seek-surface"${laneStyle}><div class="nbplay-timeline-playhead"></div>${clipHtml}</div>
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
          <label class="nbplay-timeline-field" title="Zoom in pixels per beat (0 fits the width)">
            <span>Zoom</span>
            <input class="nbplay-timeline-zoom" type="number" min="0" max="400" step="4" value="${ppb}" />
          </label>
          <button class="nbplay-timeline-loop-btn" title="Toggle loop range">Loop</button>
          <button class="nbplay-timeline-reset" title="Reset playhead">Reset</button>
          <button class="nbplay-timeline-play" title="Play timeline">Play</button>
          <button class="nbplay-timeline-record" title="Record armed tracks">Rec</button>
          <button class="nbplay-timeline-duplicate" title="Duplicate selected clip">Dup</button>
          <button class="nbplay-timeline-delete" title="Delete selected clip">Delete</button>
        </div>
        <div class="nbplay-timeline-position">1.1</div>
      </div>
      <div class="nbplay-timeline-scroll ${ppb > 0 ? "zoomed" : ""}">
        <div class="nbplay-timeline-ruler">
          <div class="nbplay-timeline-ruler-spacer"></div>
          <div class="nbplay-timeline-ruler-track nbplay-timeline-seek-surface"${laneStyle}></div>
        </div>
        <div class="nbplay-timeline-body">
          ${rows || `<div class="nbplay-timeline-empty">No tracks</div>`}
        </div>
      </div>
      <div class="nbplay-timeline-status">${escapeHtml(error)}</div>`;

      const ruler = root.querySelector(
        ".nbplay-timeline-ruler-track",
      ) as HTMLElement;
      ruler.innerHTML = `${Array.from({ length: bars }, (_, i) => {
        const left = ((i * bpb) / length) * 100;
        return `<span style="left:${left}%">${i + 1}</span>`;
      }).join("")}<div class="nbplay-timeline-playhead"></div>`;

      const onNumber = (
        selector: string,
        min: number,
        max: number,
        fallback: number,
        apply: (value: number) => void,
      ) => {
        root.querySelector(selector)?.addEventListener("change", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          const value = Number(input.value);
          apply(
            Math.max(
              min,
              Math.min(max, Number.isFinite(value) ? value : fallback),
            ),
          );
        });
      };
      onNumber(".nbplay-timeline-bars", 1, 256, 1, (bars) => {
        model.set("length", bars * beatsPerBar(model));
        model.save_changes();
      });
      onNumber(".nbplay-timeline-count-in", 0, 8, 0, (bars) => {
        model.set("count_in_bars", bars);
        model.save_changes();
        syncTransportControls();
      });
      onNumber(".nbplay-timeline-extend-bars", 1, 256, 8, (bars) => {
        model.set("recording_extend_bars", bars);
        model.save_changes();
      });
      onNumber(".nbplay-timeline-zoom", 0, 400, 0, (value) => {
        model.set("pixels_per_beat", value);
        model.save_changes();
        syncTimeline();
      });
      root
        .querySelector(".nbplay-timeline-auto-extend")
        ?.addEventListener("change", (event) => {
          const input = event.currentTarget as HTMLInputElement;
          model.set("auto_extend_recording", input.checked);
          model.save_changes();
        });
      root
        .querySelector(".nbplay-timeline-loop-btn")
        ?.addEventListener("click", toggleLoop);
      root
        .querySelector(".nbplay-timeline-reset")
        ?.addEventListener("click", () => seekToBeat(0));
      root
        .querySelector(".nbplay-timeline-play")
        ?.addEventListener("click", togglePlay);
      root
        .querySelector(".nbplay-timeline-record")
        ?.addEventListener("click", toggleRecord);
      root
        .querySelector(".nbplay-timeline-duplicate")
        ?.addEventListener("click", duplicateSelectedClip);
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
        row
          .querySelector(".nbplay-track-input")
          ?.addEventListener("change", (event) => {
            const select = event.currentTarget as HTMLSelectElement;
            updateTrack(index, {
              input: select.value === "channel" ? "channel" : "microphone",
            });
          });
      });
      root
        .querySelectorAll(".nbplay-timeline-clip")
        .forEach((button) => bindClipDrag(button as HTMLElement));
      root
        .querySelectorAll(".nbplay-timeline-seek-surface")
        .forEach((surface) => bindSeekSurface(surface as HTMLElement));
      const scroll = root.querySelector(
        ".nbplay-timeline-scroll",
      ) as HTMLElement | null;
      if (scroll && previousScroll) scroll.scrollLeft = previousScroll;
      syncLoop();
      syncTransportControls();
    }

    // Play state and position arriving from the kernel (Python callers,
    // the Session's transport links). Mirrored clock events skip these.
    function syncPlaybackState(): void {
      if (disposed || mirroring) return;
      const clk = clock();
      if (model.get("is_playing")) {
        if (!clk.playing) clk.play();
      } else if (clk.playing) {
        clk.stop();
      }
      syncTransportControls();
    }

    function syncPositionState(): void {
      if (disposed || mirroring) return;
      const clk = clock();
      // While playing, the clock is authoritative; seeks come through
      // the transport. When stopped, an external write moves the playhead.
      if (!clk.playing) {
        const beat = clampBeat(
          model,
          numberValue(model.get("current_beat"), 0),
        );
        if (Math.abs(beat - clk.beat()) > 1e-9) clk.seek(beat);
      }
      syncTransportControls();
    }

    function syncLengthState(): void {
      syncTimeline();
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
    model.on("change:pixels_per_beat", syncTimeline);
    model.on("change:recording_countdown_beats", syncTransportControls);
    model.on("change:is_playing", syncPlaybackState);
    model.on("change:is_recording", () => {
      if (disposed) return;
      if (model.get("is_recording")) {
        if (!recordingActive()) void startRecording();
      } else if (recordingActive()) {
        stopRecording();
      }
      syncTransportControls();
    });
    model.on("change:current_beat", syncPositionState);
    model.on("change:bpm", () => {
      if (disposed || mirroring) return;
      clock().setTempo(numberValue(model.get("bpm"), 120));
    });
    model.on("change:export_clip_id", handleExportRequest);
    model.on("change:import_clip_request", handleImportRequest);
    model.on("change:import_clip_data", handleImportRequest);

    // Initial state: tempo comes from the kernel; the playhead comes from
    // the model when the clock is idle, and a running clock (started by
    // another widget) wins otherwise.
    {
      const clk = clock();
      clk.setTempo(numberValue(model.get("bpm"), 120));
      if (!clk.playing) {
        const beat = clampBeat(
          model,
          numberValue(model.get("current_beat"), 0),
        );
        if (Math.abs(beat - clk.beat()) > 1e-9) clk.seek(beat);
      }
      mirror(() => model.set("is_playing", clk.playing));
    }

    syncTimeline();
    if (clock().playing) startPlayback();
    handleExportRequest();
    handleImportRequest();

    return () => {
      disposed = true;
      clearCountIn();
      recordingGeneration += 1;
      recordingPending = false;
      lanes.forEach((lane) => {
        if (lane.recorder && lane.recorder.state !== "inactive") {
          lane.recorder.stop();
        }
      });
      if (seekFrame !== null) {
        cancelAnimationFrame(seekFrame);
        seekFrame = null;
      }
      releaseLanes();
      clearScheduledPlayback();
      unbindShortcuts();
      binding.dispose();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      root.remove();
    };
  },
};
