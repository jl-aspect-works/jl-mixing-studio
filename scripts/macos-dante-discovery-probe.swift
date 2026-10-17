// Diagnostic app for #512. It never opens Studio configuration or project files.
import AppKit
import AVFoundation
import WebKit

func stereoFixture() -> Data {
    // Four seconds at 48 kHz: left 440 Hz, then right 880 Hz, at about -30 dBFS.
    let frames = 192_000
    var bytes = Data()
    func append<T: FixedWidthInteger>(_ value: T) {
        var littleEndian = value.littleEndian
        Swift.withUnsafeBytes(of: &littleEndian) { bytes.append(contentsOf: $0) }
    }
    bytes.append(contentsOf: "RIFF".utf8)
    append(UInt32(36 + frames * 4))
    bytes.append(contentsOf: "WAVEfmt ".utf8)
    append(UInt32(16)); append(UInt16(1)); append(UInt16(2))
    append(UInt32(48_000)); append(UInt32(192_000))
    append(UInt16(4)); append(UInt16(16))
    bytes.append(contentsOf: "data".utf8)
    append(UInt32(frames * 4))
    for frame in 0..<frames {
        let left = frame < frames / 2
        let frequency = left ? 440.0 : 880.0
        // Short ramps suppress discontinuities at the channel/loop boundaries.
        let position = frame % (frames / 2)
        let ramp = min(1.0, Double(min(position, frames / 2 - 1 - position)) / 480.0)
        let sample = Int16(1_000 * ramp * sin(2 * .pi * frequency * Double(frame) / 48_000))
        append(left ? sample : Int16(0))
        append(left ? Int16(0) : sample)
    }
    return bytes
}

final class Probe: NSObject, NSApplicationDelegate, WKScriptMessageHandler, NSWindowDelegate {
    var window: NSWindow!
    var webView: WKWebView?
    var player: AVAudioPlayer?
    let mode: String
    init(mode: String) { self.mode = mode }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let fixture = stereoFixture()
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 680, height: 280),
                          styleMask: [.titled, .closable], backing: .buffered, defer: false)
        window.title = "JL Dante Probe — \(mode) — PID \(ProcessInfo.processInfo.processIdentifier)"
        window.delegate = self
        window.center()
        if mode == "native" {
            let label = NSTextField(wrappingLabelWithString:
                "Native AVAudioPlayer control\n\nQuiet test tone: left 440 Hz, then right 880 Hz.\nInspect Dante Via Local Applications while playing.\nClose this window to stop and quit.\n\nDiscovery and isolation must be observed manually.")
            label.frame = NSRect(x: 24, y: 24, width: 630, height: 230)
            window.contentView?.addSubview(label)
            do {
                player = try AVAudioPlayer(data: fixture)
                player?.numberOfLoops = -1
                guard player?.play() == true else { throw NSError(domain: "Playback did not start", code: 1) }
                print("STARTED native playback; Dante discovery NOT VERIFIED")
            } catch {
                label.stringValue = "Native playback failed: \(error)"
                print("ERROR \(error)")
            }
        } else {
            let configuration = WKWebViewConfiguration()
            configuration.userContentController.add(self, name: "probe")
            let view = WKWebView(frame: window.contentView!.bounds, configuration: configuration)
            view.autoresizingMask = [.width, .height]
            webView = view
            window.contentView = view
            // User-click playback matches normal browser gesture policy. No private WebKit preferences.
            view.loadHTMLString("""
            <!doctype html><meta charset="utf-8">
            <style>body{font:17px system-ui;padding:16px}button{font:inherit}</style>
            <h3>WKWebView \(mode) control</h3>
            <p>Quiet tone: left 440 Hz, then right 880 Hz. Close window to quit.</p>
            <button id="play">Play</button> <button id="stop">Stop</button><p id="status">Ready</p>
            <audio id="audio" loop src="data:audio/wav;base64,\(fixture.base64EncodedString())"></audio>
            <script>
            const audio = document.getElementById('audio');
            let context;
            function report(message) {
              document.getElementById('status').textContent = message;
              window.webkit.messageHandlers.probe.postMessage(message);
            }
            report('setSinkId=' + typeof audio.setSinkId + '; secureContext=' + isSecureContext);
            document.getElementById('play').onclick = async () => {
              try {
                if ('\(mode)' === 'webaudio') {
                  if (!context) {
                    context = new AudioContext();
                    context.createMediaElementSource(audio).connect(context.destination);
                  }
                  await context.resume();
                }
                await audio.play(); report('STARTED; Dante discovery NOT VERIFIED');
              } catch (error) { report('ERROR ' + error); }
            };
            document.getElementById('stop').onclick = () => { audio.pause(); audio.currentTime = 0; report('Stopped'); };
            </script>
            """, baseURL: nil)
        }
        window.makeKeyAndOrderFront(nil)
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        print("\(mode): \(message.body)")
    }
    func windowWillClose(_ notification: Notification) {
        player?.stop()
        NSApplication.shared.terminate(nil)
    }
}

let mode = CommandLine.arguments.dropFirst().first ?? "native"
guard ["native", "web", "webaudio"].contains(mode) else {
    fputs("usage: JL-Dante-Probe [native|web|webaudio]\n", stderr)
    exit(2)
}
print("Mode=\(mode); OS=\(ProcessInfo.processInfo.operatingSystemVersionString); PID=\(ProcessInfo.processInfo.processIdentifier)")
let app = NSApplication.shared
let delegate = Probe(mode: mode)
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
