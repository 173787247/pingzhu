import Carbon
import Foundation

/**
 Asks the system what it can see.

 Run on a CI runner to find out how far verification can go without a person:
 whether there is a logged-in GUI session, and whether the input source APIs
 answer at all.

 Prints findings and always exits 0 — this is a question, not an assertion.

 Deliberately uses as few Carbon constants as possible: the first version
 referenced one that does not exist in the Swift overlay and the probe failed to
 compile, which is a silly way to learn nothing.
 */

func report(_ label: String, _ value: String) {
    print("probe  \(label): \(value)")
}

func property(_ source: TISInputSource, _ key: CFString) -> CFTypeRef? {
    guard let raw = TISGetInputSourceProperty(source, key) else { return nil }
    return Unmanaged<CFTypeRef>.fromOpaque(raw).takeUnretainedValue()
}

func string(_ source: TISInputSource, _ key: CFString) -> String? {
    guard let value = property(source, key) else { return nil }
    return (value as? String)
}

report("user", ProcessInfo.processInfo.environment["USER"] ?? "(unknown)")
report("over ssh", ProcessInfo.processInfo.environment["SSH_CONNECTION"] == nil ? "no" : "yes")

// Can this process see input sources at all? A session with no window server
// returns an empty list rather than failing — the quiet version of "no".
guard let sources = TISCreateInputSourceList(nil, true)?.takeRetainedValue() as? [TISInputSource] else {
    report("input sources", "TISCreateInputSourceList returned nil")
    exit(0)
}
report("input sources visible", "\(sources.count)")

var enabled = 0
var selectable = 0
var thirdParty: [String] = []

for source in sources {
    if let value = property(source, kTISPropertyInputSourceIsEnabled) as? Bool, value {
        enabled += 1
    }
    if let value = property(source, kTISPropertyInputSourceIsSelectCapable) as? Bool, value {
        selectable += 1
    }
    // Anything not shipped by Apple: an input method someone installed.
    if let bundle = string(source, kTISPropertyBundleID),
       !bundle.hasPrefix("com.apple.") {
        thirdParty.append("\(string(source, kTISPropertyLocalizedName) ?? "?") [\(bundle)]")
    }
}
report("enabled", "\(enabled)")
report("selectable", "\(selectable)")
report("third-party input sources", thirdParty.isEmpty ? "none" : thirdParty.joined(separator: ", "))

// Enabling is the operation that needs a GUI session. If this succeeds on a
// runner, an input method can be installed and activated here — which is the
// whole question.
if let layout = sources.first(where: { string($0, kTISPropertyInputSourceID)?.contains("ABC") == true })
    ?? sources.first {
    let status = TISEnableInputSource(layout)
    report("TISEnableInputSource on an existing source", status == noErr ? "ok" : "failed (\(status))")
}

// Where does the system look for third-party input methods?
let inputMethodsDir = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Input Methods")
let exists = FileManager.default.fileExists(atPath: inputMethodsDir.path)
report("~/Library/Input Methods exists", "\(exists)")

// And where the app would land: installing is a copy, which needs no GUI.
try? FileManager.default.createDirectory(at: inputMethodsDir, withIntermediateDirectories: true)
let writable = FileManager.default.isWritableFile(atPath: inputMethodsDir.path)
report("~/Library/Input Methods writable", "\(writable)")

exit(0)
