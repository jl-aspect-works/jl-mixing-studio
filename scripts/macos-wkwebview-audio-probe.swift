#!/usr/bin/env swift

import AppKit
import Foundation
import WebKit

final class NavigationDelegate: NSObject, WKNavigationDelegate {
    var finished = false
    var navigationError: Error?

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        finished = true
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        navigationError = error
        finished = true
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        navigationError = error
        finished = true
    }
}

func runLoopUntil(_ condition: @escaping () -> Bool, timeout: TimeInterval) -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while !condition() && Date() < deadline {
        RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.05))
    }
    return condition()
}

let args = Array(CommandLine.arguments.dropFirst())
guard !args.isEmpty else {
    fputs("usage: macos-wkwebview-audio-probe.swift <audio-file>...\n", stderr)
    exit(2)
}

let urls = args.map { URL(fileURLWithPath: $0).standardizedFileURL }
let fixtureDirectory = urls[0].deletingLastPathComponent()

guard urls.allSatisfy({ $0.deletingLastPathComponent() == fixtureDirectory }) else {
    fputs("all fixtures must be in the same directory\n", stderr)
    exit(2)
}

let html = #"""
<!doctype html>
<meta charset="utf-8">
<audio id="audio" preload="auto"></audio>
<script>
window.probeAudio = async function(filename) {
  const audio = document.getElementById('audio');
  audio.pause();
  audio.removeAttribute('src');
  audio.load();

  return await new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      audio.removeEventListener('loadeddata', onLoadedData);
      audio.removeEventListener('error', onError);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onLoadedData = () => finish({
      ok: true,
      duration: audio.duration,
      readyState: audio.readyState,
      networkState: audio.networkState
    });
    const onError = () => finish({
      ok: false,
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
      readyState: audio.readyState,
      networkState: audio.networkState,
      errorCode: audio.error ? audio.error.code : null,
      errorMessage: audio.error ? audio.error.message : 'media error'
    });
    const timer = setTimeout(() => finish({
      ok: false,
      duration: Number.isFinite(audio.duration) ? audio.duration : null,
      readyState: audio.readyState,
      networkState: audio.networkState,
      errorMessage: 'timeout waiting for loadeddata'
    }), 12000);

    audio.addEventListener('loadeddata', onLoadedData, { once: true });
    audio.addEventListener('error', onError, { once: true });
    audio.src = filename;
    audio.load();
  });
};
</script>
"""#

let htmlURL = fixtureDirectory.appendingPathComponent("wkwebview-audio-probe.html")
try html.write(to: htmlURL, atomically: true, encoding: .utf8)

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)

let configuration = WKWebViewConfiguration()
configuration.mediaTypesRequiringUserActionForPlayback = []
let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 320, height: 200), configuration: configuration)
let navigationDelegate = NavigationDelegate()
webView.navigationDelegate = navigationDelegate
webView.loadFileURL(htmlURL, allowingReadAccessTo: fixtureDirectory)

guard runLoopUntil({ navigationDelegate.finished }, timeout: 15) else {
    fputs("FAIL: WKWebView probe page timed out while loading\n", stderr)
    exit(1)
}
if let error = navigationDelegate.navigationError {
    fputs("FAIL: WKWebView probe page failed: \(error)\n", stderr)
    exit(1)
}

var failed = false
for url in urls {
    var completed = false
    var probeError: Error?
    var probeValue: Any?

    webView.callAsyncJavaScript(
        "return await window.probeAudio(filename);",
        arguments: ["filename": url.lastPathComponent],
        in: nil,
        in: .page
    ) { result in
        switch result {
        case .success(let value):
            probeValue = value
        case .failure(let error):
            probeError = error
        }
        completed = true
    }

    guard runLoopUntil({ completed }, timeout: 20) else {
        print("FAIL \(url.lastPathComponent): JavaScript probe timed out")
        failed = true
        continue
    }

    if let error = probeError {
        print("FAIL \(url.lastPathComponent): \(error)")
        failed = true
        continue
    }

    guard let dictionary = probeValue as? [String: Any],
          let ok = dictionary["ok"] as? Bool else {
        print("FAIL \(url.lastPathComponent): unexpected probe result \(String(describing: probeValue))")
        failed = true
        continue
    }

    if ok {
        let duration = dictionary["duration"] ?? "unknown"
        let readyState = dictionary["readyState"] ?? "unknown"
        print("PASS \(url.lastPathComponent): duration=\(duration) readyState=\(readyState)")
    } else {
        let message = dictionary["errorMessage"] ?? "unknown media error"
        let code = dictionary["errorCode"] ?? "none"
        let readyState = dictionary["readyState"] ?? "unknown"
        print("FAIL \(url.lastPathComponent): errorCode=\(code) readyState=\(readyState) message=\(message)")
        failed = true
    }
}

try? FileManager.default.removeItem(at: htmlURL)
exit(failed ? 1 : 0)
