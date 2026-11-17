# Android phone capture guide

## Recommended setup

- Android phone with a rear camera and adjacent LED flash.
- Latest stable Chrome.
- VOCALERT hosted at an HTTPS URL.
- Clean rear camera glass and flash window.
- Stable place to rest your hand.

## Permissions and torch

1. Open the HTTPS app address in Chrome.
2. Tap **Enable camera** and allow camera access.
3. The app requests the environment/rear camera and then attempts to activate the LED torch using the browser's `MediaStreamTrack.applyConstraints` torch capability.
4. Browser/device support varies. The app reports “torch unconfirmed” if it cannot verify activation. Look at the preview and make sure the fingertip is visibly illuminated before recording.
5. If the flash will not turn on, try a current Android Chrome version and check that no other app is using the camera. If still unavailable, the device/browser may not expose torch control to a web page. The app does not contain a native Android torch plugin.

## Finger positioning

- Use the soft pad of the index finger, not the nail.
- Cover both camera lens and adjacent flash.
- Do not press hard. Too much pressure can reduce local blood volume and change the signal.
- Avoid repeatedly lifting/replacing the finger during a capture.
- If the preview is mostly white/red and saturated, loosen contact slightly; if very dark, check flash control and full coverage.

## Frame timing in v0.2

On browsers that support `requestVideoFrameCallback`, VOCALERT records the browser-reported video `mediaTime` and `presentedFrames` count for each presented frame. This is more reliable than using `requestAnimationFrame` as though it were the camera frame clock. The app falls back to observing `video.currentTime` only when the callback API is unavailable. Export a CSV and inspect `frame_capture_mode`, `video_media_time_seconds`, `presented_frames`, and `time_seconds` when comparing devices. Identical RGB averages alone are not treated as proof that two rows came from the same frame.

## What a successful capture should look like

A useful recording usually has:
- mostly monotonic, reasonably regular media timestamps;
- a stable average intensity rather than large sudden jumps;
- a periodic pulse-like variation;
- multiple consistently detected downward red-channel troughs;
- no major dark/bright pixel clipping.

The automated quality score is heuristic. A “good” score is not proof that the pulse rate is clinically accurate.

## Android browser troubleshooting

- **Permission denied:** Chrome → site settings → Camera → Allow; reload the page.
- **Camera unavailable:** close camera/QR/scanner apps and retry; reload; check OS camera permission.
- **Torch not confirmed:** torch API is not supported or not exposed on this device/browser. Try a different supported Android device; do not assume the flash is on.
- **Black preview:** ensure camera permission is granted and the correct rear camera is selected. Stop camera and retry.
- **Poor signal:** warm hands comfortably, reduce movement, support the hand, lighten pressure, clean lens/flash, and repeat.
- **Sampling rate low or timing variable:** close other heavy apps, keep the phone cool, update Chrome, and inspect exported media-time/presented-frame metadata. A high count of exported rows does not by itself prove the camera delivered that many distinct frames.
- **Camera blocked on HTTP:** use HTTPS. A plain LAN address such as `http://192.168.0.10:5173` is commonly not treated as a secure context.

The app works as a browser PWA; it is not a native Android APK.
