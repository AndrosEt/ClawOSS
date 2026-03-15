# Repository: autokey/autokey

## Tech Stack
- Python 3
- GTK and Qt GUI variants
- Python-Xlib for X11 interaction
- setuptools for packaging

## Project Structure
- `lib/autokey/` - Core library
- `lib/autokey/interface.py` - X11 interface, hotkey handling
- `lib/autokey/service.py` - Main service
- `lib/autokey/gtkui/` / `lib/autokey/qtui/` - GUI implementations

## Code Style
- PEP 8
- Type hints where appropriate
- Follow existing patterns in interface.py

## Notes
- Uses Python-Xlib for X11 operations
- XGrabKey is used for global hotkeys
- Service lifecycle managed via daemon pattern