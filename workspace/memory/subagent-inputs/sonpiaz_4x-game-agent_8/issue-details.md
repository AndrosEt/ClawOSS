# Issue #8: Add iOS device interface (Appium)

## What
Add iOS device support via Appium, mirroring the existing Android/ADB interface.

## Why
Currently only Android/ADB is supported. Adding iOS support would let users run bots on iOS devices or simulators.

## What to Build
- New file `agent/appium_interface.py`
- Same interface as `agent/adb.py`: screenshot, tap, swipe
- Use Appium WebDriver for iOS automation

## Interface to Mirror (from adb.py)
```python
class GameScreen:
    def __init__(self, device: str = "emulator-5554", ...)
    def connect(self) -> bool
    def is_connected(self) -> bool
    def screenshot(self, retries: int = 3) -> (base64, scale_x, scale_y)
    def tap(self, x: int, y: int)
    def swipe(self, x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300)
    def press_home(self)
    def press_back(self)
```

## Notes
- iOS automation requires a Mac with Xcode
- Appium setup is more complex than ADB
- Use `appium-python-client` library
- WebDriver URL typically http://localhost:4723

## Done When
- `agent/appium_interface.py` created with iOS GameScreen class
- Same interface as ADB version
- Basic connection, screenshot, tap, swipe working
- PR submitted
