"""Map hardware MIDI controllers to widget traits.

``MidiLearn`` watches the ``control_change`` trait of a ``MidiKeyboardWidget``
and writes each mapped controller's value into a trait of any widget. Knob
values travel through the kernel, which is fine for controls but not for
note timing; notes stay in the browser.
"""

from __future__ import annotations

import traitlets


class MidiLearn:
    """Route MIDI control changes to widget traits.

    Args:
        source: A widget with a synced ``control_change`` trait
            (``MidiKeyboardWidget``).

    ``map()`` binds a controller number now; ``learn()`` binds the next
    controller the hardware sends, so you can call it and turn the knob.
    Bool traits switch on at values of 64 and above. Numeric traits scale
    the 0-127 value into ``[low, high]``, which default to 0-1 for floats
    and 0-127 for ints.
    """

    def __init__(self, source):
        if "control_change" not in source.trait_names():
            raise TypeError("MidiLearn source needs a 'control_change' trait")
        self.source = source
        self.mappings = {}
        self._pending = None
        source.observe(self._on_control_change, names="control_change")

    def map(self, controller, target, name, low=None, high=None, channel=None):
        """Bind ``controller`` (0-127) to ``target.<name>``; returns the mapping."""
        controller = int(controller)
        if not 0 <= controller <= 127:
            raise ValueError("controller must be 0-127")
        trait = target.traits().get(name)
        if trait is None:
            raise ValueError(f"{type(target).__name__} has no trait {name!r}")
        if isinstance(trait, traitlets.Bool):
            low, high = 0, 1
        elif isinstance(trait, traitlets.Int):
            low = 0 if low is None else int(low)
            high = 127 if high is None else int(high)
        elif isinstance(trait, traitlets.Float):
            low = 0.0 if low is None else float(low)
            high = 1.0 if high is None else float(high)
        else:
            raise TypeError(f"trait {name!r} is not a Bool, Int, or Float trait")
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
        """Bind ``target.<name>`` to the next controller the hardware sends."""
        if name not in target.traits():
            raise ValueError(f"{type(target).__name__} has no trait {name!r}")
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
        self.source.unobserve(self._on_control_change, names="control_change")
        self.clear()

    def apply(self, controller, value, channel=None):
        """Apply a controller value as if it came from the hardware; returns the written value or None."""
        mapping = self.mappings.get(int(controller))
        if mapping is None:
            return None
        if mapping["channel"] is not None and channel is not None and mapping["channel"] != int(channel):
            return None
        value = max(0, min(127, int(value)))
        trait = mapping["target"].traits()[mapping["name"]]
        if isinstance(trait, traitlets.Bool):
            result = value >= 64
        else:
            low, high = mapping["low"], mapping["high"]
            result = low + (high - low) * value / 127
            if isinstance(trait, traitlets.Int):
                result = round(result)
        setattr(mapping["target"], mapping["name"], result)
        return result

    def _on_control_change(self, change):
        message = change["new"] or {}
        if "controller" not in message:
            return
        controller = int(message["controller"])
        if self._pending is not None:
            target, name, low, high = self._pending
            self._pending = None
            self.map(controller, target, name, low=low, high=high)
        self.apply(controller, message.get("value", 0), message.get("channel"))
