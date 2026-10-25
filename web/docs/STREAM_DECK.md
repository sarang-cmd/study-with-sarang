# Stream Deck and external keyboards

Three ways, from most to least reliable. The Settings panel in the app (Keys tab) builds the exact text for you (pick an action, press Copy).

## 1. Hotkey action (works with any programmable keyboard too)

In the Stream Deck software add **Hotkey** and press the combination from the Global shortcuts list, for example Ctrl + Alt + Shift + Space for play or pause. If your keyboard or Stream Deck can send F13 to F24, those keys never clash with anything, so you can assign F13 to the app's shortcut and send F13 from the button. Change a shortcut in Settings, Keys, by clicking it and pressing the new keys.

## 2. Open action with a shortcut file

Stream Deck's Open action starts a file. To pass a command, make a Windows shortcut:

1. Right-click the desktop, **New, Shortcut**.
2. Target: `"C:\Users\YOU\AppData\Local\Programs\Study with Sarang\Study with Sarang.exe" --cmd=sound.toggle`
3. Point the Stream Deck Open action at that shortcut.

If the app is running the command arrives at once. If it is not, the app starts quietly in the tray and runs the command, without opening a window.

## 3. Link

`study-with-sarang://cmd/sound.toggle`, `study-with-sarang://cmd/volume.set/40`, `study-with-sarang://cmd/mix.load/Flow%20and%20rain`. Works from a Website action or any tool that opens a URL. Windows or the browser asks once whether to allow it. Links cannot quit the app or change the sign-in setting.

## Commands

| Group | Commands |
| --- | --- |
| Sound | `sound.toggle`, `sound.play`, `sound.pause`, `sound.next` |
| Volume | `volume.up`, `volume.down`, `volume.set:0-100` |
| Timer | `timer.toggle`, `timer.start`, `timer.pause`, `timer.reset`, `timer.skip`, `timer.drift` |
| View | `zen.toggle`, `fullscreen.toggle` |
| Mixes and macros | `mix.load:<name>`, `macro.run:<name>` |
| Window | `window.show`, `window.hide`, `window.toggle`, `window.compact`, `window.compact:toggle`, `window.expand`, `window.pin:on/off`, `window.moveto:<number>` |
| App | `shortcuts.toggle`, `shortcuts.enable`, `shortcuts.disable`, `app.quit` and `app.login:on/off` (command line only) |

Stream Deck hardware was not available for testing here. The command line, link and hotkey paths were tested with real processes and real key presses.
