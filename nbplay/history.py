"""Undo and redo for widget state.

``History`` watches the config fields of a set of widgets and records every
change as an undo step. Changes that land within a short window of each
other (a fader drag, a method that writes several fields) share one step,
``transaction()`` groups anything explicitly, and a notebook cell boundary
always ends a step. Browser-owned status (play state, playhead position,
meters, request counts) never reaches the config model, and the transient
config fields listed below are ignored.
"""

from __future__ import annotations

import contextlib
import functools
import time

# Config fields that describe the moment rather than the document.
TRANSIENT_TRAITS = frozenset(
    {
        "session_id",
        "is_playing",
        "is_recording",
        "current_beat",
        "current_step",
        "bar_number",
        "beat_in_bar",
        "recording_track",
        "recording_tracks",
        "recording_error",
        "recording_countdown_beats",
        "recorded_clip",
        "selected_clip_id",
        "export_clip_id",
        "exported_clip",
        "exported_clip_data",
        "import_clip_request",
        "import_clip_data",
        "active_slots",
        "queued_slots",
        "selected_slot",
        "launch_request",
        "active_notes",
        "active_pads",
        "last_note_event",
        "last_pad_event",
        "keyboard_connected",
        "edit_token",
        "edit_ack",
        "capture_request",
        "send_request",
        "control_change",
        "waveform",
        "undo_request",
        "redo_request",
        "command",
    }
)


class History:
    """Undo/redo stack over the config fields of attached widgets.

    Args:
        limit: Maximum number of undo steps kept.
        group_window: Seconds within which consecutive changes join the
            same step.
    """

    def __init__(self, limit=100, group_window=0.3):
        self.limit = max(1, int(limit))
        self.group_window = float(group_window)
        self._undo = []
        self._redo = []
        self._widgets = []
        self._removers = {}
        self._paused = 0
        self._applying = False
        self._transaction = None
        self._last_time = 0.0

    # Attachment

    def attach(self, widget):
        """Start recording changes to ``widget``'s config fields."""
        config = getattr(widget, "config", None)
        if widget is None or widget in self._widgets or not hasattr(config, "on_change"):
            return
        self._removers[widget] = config.on_change(functools.partial(self._on_model_change, config))
        self._widgets.append(widget)

    def detach(self, widget):
        if widget in self._widgets:
            self._removers.pop(widget)()
            self._widgets.remove(widget)
            self._undo = [group for group in (self._without(group, widget.config) for group in self._undo) if group]
            self._redo = [group for group in (self._without(group, widget.config) for group in self._redo) if group]

    @staticmethod
    def _without(group, config):
        return [entry for entry in group if entry[0] is not config]

    # Recording

    def _on_model_change(self, model, changes):
        for name, (old, new) in changes.items():
            if name not in TRANSIENT_TRAITS and not name.startswith("_"):
                self._record(model, name, old, new)

    def _record(self, owner, name, old, new):
        if self._applying or self._paused:
            return
        entry = (owner, name, old, new)
        if self._transaction is not None:
            self._transaction.append(entry)
            return
        now = time.monotonic()
        if self._undo and now - self._last_time < self.group_window:
            self._undo[-1].append(entry)
        else:
            self._push(self._undo, [entry])
        self._last_time = now
        self._redo.clear()

    def _push(self, stack, group):
        stack.append(group)
        del stack[: -self.limit]

    def mark(self, *args):
        """End the current step so the next change starts a new one."""
        self._last_time = 0.0

    def bind_ipython(self, shell=None):
        """End a step after every notebook cell, so cells never share one.

        Uses IPython's ``post_run_cell`` event on ``shell`` (the running
        shell by default). Returns True when a shell was found.
        """
        if shell is None:
            try:
                from IPython import get_ipython
            except ImportError:
                return False
            shell = get_ipython()
        if shell is None or not hasattr(shell, "events"):
            return False
        shell.events.register("post_run_cell", self.mark)
        return True

    @contextlib.contextmanager
    def transaction(self):
        """Group every change inside the block into one undo step."""
        if self._transaction is not None:
            yield
            return
        self._transaction = []
        try:
            yield
        finally:
            group = self._transaction
            self._transaction = None
            if group:
                self._push(self._undo, group)
                self._redo.clear()
            self.mark()

    @contextlib.contextmanager
    def paused(self):
        """Ignore changes inside the block (structural edits that undo cannot replay)."""
        self._paused += 1
        try:
            yield
        finally:
            self._paused -= 1

    # Navigation

    @property
    def can_undo(self):
        return bool(self._undo)

    @property
    def can_redo(self):
        return bool(self._redo)

    def undo(self):
        """Revert the latest step; returns False when there is nothing to undo."""
        if not self._undo:
            return False
        group = self._undo.pop()
        self._apply(group, reverse=True)
        self._redo.append(group)
        return True

    def redo(self):
        """Reapply the latest undone step; returns False when there is nothing to redo."""
        if not self._redo:
            return False
        group = self._redo.pop()
        self._apply(group, reverse=False)
        self._undo.append(group)
        return True

    def _apply(self, group, reverse):
        self._applying = True
        try:
            for config, name, old, new in reversed(group) if reverse else group:
                setattr(config, name, old if reverse else new)
        finally:
            self._applying = False
            self.mark()

    def clear(self):
        self._undo.clear()
        self._redo.clear()
        self.mark()

    @property
    def steps(self):
        """Undo steps, oldest first, as lists of ``(config, field)`` pairs."""
        return [[(config, name) for config, name, _, _ in group] for group in self._undo]

    def __len__(self):
        return len(self._undo)
