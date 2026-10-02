"""Undo and redo for widget state.

``History`` watches the synced traits of a set of widgets and records every
change as an undo step. Changes that land within a short window of each
other (a fader drag, a method that writes several traits) share one step,
``transaction()`` groups anything explicitly, and a notebook cell boundary
always ends a step. Transient traits such as play state, playhead position,
meters, and request nonces are ignored.
"""

from __future__ import annotations

import contextlib
import time

# Synced traits that describe the moment rather than the document.
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
    """Undo/redo stack over the synced traits of attached widgets.

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
        self._paused = 0
        self._applying = False
        self._transaction = None
        self._last_time = 0.0

    # Attachment

    @staticmethod
    def tracked_traits(widget):
        return [
            name for name in widget.trait_names() if widget.trait_metadata(name, "sync") and name not in TRANSIENT_TRAITS and not name.startswith("_")
        ]

    def attach(self, widget):
        """Start recording changes to ``widget``'s synced traits."""
        if widget is None or widget in self._widgets or not hasattr(widget, "trait_names"):
            return
        names = self.tracked_traits(widget)
        if not names:
            return
        widget.observe(self._on_change, names=names)
        self._widgets.append(widget)

    def detach(self, widget):
        if widget in self._widgets:
            widget.unobserve(self._on_change, names=self.tracked_traits(widget))
            self._widgets.remove(widget)
            self._undo = [group for group in (self._without(group, widget) for group in self._undo) if group]
            self._redo = [group for group in (self._without(group, widget) for group in self._redo) if group]

    @staticmethod
    def _without(group, widget):
        return [entry for entry in group if entry[0] is not widget]

    # Recording

    def _on_change(self, change):
        if self._applying or self._paused:
            return
        entry = (change["owner"], change["name"], change["old"], change["new"])
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
            for widget, name, old, new in reversed(group) if reverse else group:
                setattr(widget, name, old if reverse else new)
        finally:
            self._applying = False
            self.mark()

    def clear(self):
        self._undo.clear()
        self._redo.clear()
        self.mark()

    @property
    def steps(self):
        """Undo steps, oldest first, as lists of ``(widget, trait)`` pairs."""
        return [[(widget, name) for widget, name, _, _ in group] for group in self._undo]

    def __len__(self):
        return len(self._undo)
