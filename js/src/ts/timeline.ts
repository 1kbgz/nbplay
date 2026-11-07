// nbplay TimelineWidget – anywidget ESM frontend
//
// Adapter between the anywidget model and the `<nbplay-timeline>` element.

import { bindInstrument } from "./adapter.ts";
import { type AnyModel } from "./helpers.ts";
import type { NbplayTimeline } from "./components/timeline.ts";
import "./components/timeline.ts";

function render({
  model,
  el,
}: {
  model: AnyModel;
  el: HTMLElement;
}): () => void {
  const node = document.createElement("nbplay-timeline") as NbplayTimeline;
  return bindInstrument(model, el, node, {
    config: {
      tracks: "tracks",
      clips: "clips",
      length: "length",
      selected_clip_id: "selectedClipId",
      bpm: "bpm",
      time_signature_num: "timeSignatureNum",
      count_in_bars: "countInBars",
      auto_extend_recording: "autoExtendRecording",
      recording_extend_bars: "recordingExtendBars",
      pixels_per_beat: "pixelsPerBeat",
      session_id: "sessionId",
      // The playhead restores from the kernel when the timeline is standalone.
      current_beat: "currentBeat",
      export_clip_id: "exportClipId",
      import_clip_request: "importClipRequest",
      import_clip_data: "importClipData",
    },
    // Play and record state come from the browser clock and recorders; a
    // saved notebook never starts either.
    status: {
      is_playing: "isPlaying",
      is_recording: "isRecording",
      recording_track: "recordingTrack",
      recording_tracks: "recordingTracks",
      recording_countdown_beats: "recordingCountdownBeats",
      recording_error: "recordingError",
      recorded_clip: "recordedClip",
      exported_clip: "exportedClip",
      exported_clip_data: "exportedClipData",
    },
  });
}

export default { render };
