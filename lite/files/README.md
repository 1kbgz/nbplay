# nbplay in your browser

These are the nbplay example notebooks running on JupyterLite with the
Pyodide kernel: the Rust core is compiled to WebAssembly, the widgets are
plain anywidget classes, and audio and MIDI go through your browser's Web
Audio and Web MIDI APIs. Nothing is installed on your machine.

Open any notebook and run it top to bottom. The first cell installs the
bundled nbplay wheel; the first run takes a few seconds while Pyodide loads.
Click a play button before expecting sound: browsers only start audio after
a user gesture.
