# Repo Analysis: sonpiaz/4x-game-agent

## Tech Stack
- **Language**: Python 3
- **Device Interface**: ADB for Android
- **New Interface**: Appium for iOS

## Directory Structure
- `agent/adb.py` - Existing Android ADB interface (reference)
- `agent/appium_interface.py` - NEW file to create
- `pyproject.toml` - Dependencies

## Key Dependencies to Add
- `appium-python-client` - Appium WebDriver client

## Interface Pattern (from adb.py)
```python
class GameScreen:
    def __init__(self, device: str, screenshot_path: str, max_compress_dim: int)
    def connect(self) -> bool
    def is_connected(self) -> bool
    def screenshot(self, retries: int) -> (base64_str, scale_x, scale_y)
    def tap(self, x: int, y: int)
    def swipe(self, x1, y1, x2, y2, duration_ms)
    def press_home(self)
    def press_back(self)
```

## Appium iOS Setup
- WebDriver URL: http://localhost:4723
- Desired capabilities for iOS:
  - platformName: "iOS"
  - deviceName: (e.g., "iPhone 15")
  - udid: device identifier
  - app: bundle ID or app path

## Code Style
- Match existing Python style in adb.py
- Type hints where appropriate
- Docstrings for public methods

## Testing Notes
- Cannot test without iOS device/simulator
- Ensure code is syntactically correct
- Follow same error handling as adb.py
