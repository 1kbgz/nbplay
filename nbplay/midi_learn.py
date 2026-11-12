"""Map hardware MIDI controllers to widget config fields.

``MidiLearn`` watches the ``control_change`` status of a ``MidiKeyboardWidget``
and writes each mapped controller's value into a config field of any widget.
Knob values travel through the kernel, which is fine for controls but not for
note timing; notes stay in the browser.
"""

from __future__ import annotations


def _field_kind(target, name):
    """``bool``, ``int`` or ``float`` for a numeric config field of a widget."""
    field = type(target.config).model_fields.get(name)
    if field is None:
        raise ValueError(f"{type(target).__name__} has no field {name!r}")
    if field.annotation in (bool, int, float):
        return field.annotation
    raise TypeError(f"field {name!r} is not bool, int, or float")


class MidiLearn:
    """Route MIDI control changes to widget config fields.

    Args:
        source: A widget whose status has a ``control_change`` field
            (``MidiKeyboardWidget``).

    ``map()`` binds a controller number now; ``learn()`` binds the next
    controller the hardware sends, so you can call it and turn the knob.
    Bool fields switch on at values of 64 and above. Numeric fields scale
    the 0-127 value into ``[low, high]``, which default to 0-1 for floats
    and 0-127 for ints.
    """

    def __init__(self, source):
        status = getattr(source, "status", None)
        if not hasattr(source, "on_change") or "control_change" not in getattr(type(status), "model_fields", {}):
            raise TypeError("MidiLearn source needs a 'control_change' status field")
        self._stop = source.on_change(lambda widget, name, old, new: self._handle(new), names="control_change")
        self.source = source
        self.mappings = {}
        self._pending = None

    def map(self, controller, target, name, low=None, high=None, channel=None):
        """Bind ``controller`` (0-127) to ``target.config.<name>``; returns the mapping."""
        controller = int(controller)
        if not 0 <= controller <= 127:
            raise ValueError("controller must be 0-127")
        kind = _field_kind(target, name)
        if kind is bool:
            low, high = 0, 1
        elif kind is int:
            low = 0 if low is None else int(low)
            high = 127 if high is None else int(high)
        else:
            low = 0.0 if low is None else float(low)
            high = 1.0 if high is None else float(high)
        mapping = {
            "controller": controller,
            "target": target,
            "name": name,
            "low": low,
            "high": high,
            "channel": None if channel is None else int(channel),
        }
        self.mappings[controller] = mapping
        return mapping

    def learn(self, target, name, low=None, high=None):
        """Bind ``target.config.<name>`` to the next controller the hardware sends."""
        _field_kind(target, name)
        self._pending = (target, name, low, high)

    @property
    def learning(self):
        """True while ``learn()`` is waiting for a controller."""
        return self._pending is not None

    def cancel(self):
        """Stop waiting for a controller after ``learn()``."""
        self._pending = None

    def unmap(self, controller):
        """Remove the mapping for ``controller``; returns True when one existed."""
        return self.mappings.pop(int(controller), None) is not None

    def clear(self):
        self.mappings.clear()
        self._pending = None

    def close(self):
        """Stop listening to the source."""
        self._stop()
        self.clear()

    def apply(self, controller, value, channel=None):
        """Apply a controller value as if it came from the hardware; returns the written value or None."""
        mapping = self.mappings.get(int(controller))
        if mapping is None:
            return None
        if mapping["channel"] is not None and channel is not None and mapping["channel"] != int(channel):
            return None
        value = max(0, min(127, int(value)))
        kind = _field_kind(mapping["target"], mapping["name"])
        if kind is bool:
            result = value >= 64
        else:
            low, high = mapping["low"], mapping["high"]
            result = low + (high - low) * value / 127
            if kind is int:
                result = round(result)
        setattr(mapping["target"].config, mapping["name"], result)
        return result

    def _handle(self, message):
        message = message or {}
        if "controller" not in message:
            return
        controller = int(message["controller"])
        if self._pending is not None:
            target, name, low, high = self._pending
            self._pending = None
            self.map(controller, target, name, low=low, high=high)
        self.apply(controller, message.get("value", 0), message.get("channel"))
