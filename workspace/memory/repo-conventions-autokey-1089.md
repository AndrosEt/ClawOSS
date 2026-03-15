# Repository: autokey/autokey

## Tech Stack
- Python 3
- GTK/Qt GUIs
- Python-Xlib for X11
- Event-driven architecture

## Project Structure
- `lib/autokey/interface.py` - Input handling
- `lib/autokey/service.py` - Main service
- `lib/autokey/model.py` - Trigger/action models
- GUI in gtkui/qtui

## Code Style
- Follow existing trigger patterns
- Event-driven design
- Proper error handling for hardware

## Notes
- Hotkeys registered via XGrabKey
- Actions triggered by events
- New trigger type needed for controllers