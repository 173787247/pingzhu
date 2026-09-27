import Carbon
import Foundation

/**
 Installs the built input method and asks the system whether it took.

 This is the part of the IMK layer that can be checked without a person: the
 bundle registering itself as an input source. Everything after that — typing,
 the candidate window appearing where the cursor is — needs someone watching.

 The failure this exists to catch is the quiet one: an input method that copies
 into ~/Library/Input Methods, appears nowhere in the list, and reports nothing
 wrong. Confirmed on a runner (see the probe): there is an Aqua session, 307
 input sources are visible, and enabling them is permitted.

 usage: PingZhuInstallTest <path to PingZhu.app>
 */

func fail(_ message: String) -> Never {
    FileHandle.standardError.write("FAIL  \(message)\n".data(using: .utf8)!)
    exit(1)
}

func report(_ label: String, _ value: String) {
    print("ok    \(label): \(value)")
}

func property(_ source: TISInputSource, _ key: CFString) -> CFTypeRef? {
    guard let raw = TISGetInputSourceProperty(source, key) else { return nil }
    return Unmanaged<CFTypeRef>.fromOpaque(raw).takeUnretainedValue()
}

func string(_ source: TISInputSource, _ key: CFString) -> String? {
    property(source, key) as? String
}

func allSources() -> [TISInputSource] {
    (TISCreateInputSourceList(nil, true)?.takeRetainedValue() as? [TISInputSource]) ?? []
}

/// The bundle identifier and the input source identifier are both in Info.plist;
/// they must agree with what the system reports.
let bundleID = "tw.pingzhu.ime"
let sourceID = "tw.pingzhu.ime.Bopomofo"

let arguments = CommandLine.arguments
guard arguments.count > 1 else {
    fail("usage: PingZhuInstallTest <path to PingZhu.app>")
}
let appPath = arguments[1]

// ---------------------------------------------------------------- install

let destination = FileManager.default.homeDirectoryForCurrentUser
    .appendingPathComponent("Library/Input Methods/PingZhu.app")
try? FileManager.default.createDirectory(
    at: destination.deletingLastPathComponent(),
    withIntermediateDirectories: true
)
try? FileManager.default.removeItem(at: destination)
do {
    try FileManager.default.copyItem(at: URL(fileURLWithPath: appPath), to: destination)
} catch {
    fail("could not copy the app to \(destination.path): \(error)")
}
report("installed", destination.path)

// The system watches that directory, but not instantly. Give it a moment rather
// than concluding too early — a false negative here would be worse than a slow
// test, because it would send someone looking for a bug that is not there.
var found: TISInputSource?
for attempt in 1...10 {
    found = allSources().first { string($0, kTISPropertyInputSourceID) == sourceID }
    if found != nil {
        report("the system found it after", "\(attempt)s")
        break
    }
    Thread.sleep(forTimeInterval: 1.0)
}

guard let source = found else {
    let visible = allSources()
        .compactMap { string($0, kTISPropertyBundleID) }
        .filter { !$0.hasPrefix("com.apple.") }
    fail("""
        the system never listed \(sourceID).
        It is installed at \(destination.path) and can be found by nobody —
        which is exactly the failure that reports nothing.
        third-party input sources visible: \(visible.isEmpty ? "none" : visible.joined(separator: ", "))
        Check Info.plist: tsInputModeListKey, InputMethodConnectionName,
        and that CFBundlePackageType is APPL.
        """)
}
report("registered as", string(source, kTISPropertyLocalizedName) ?? "?")

// ---------------------------------------------------------------- activate

let enableStatus = TISEnableInputSource(source)
guard enableStatus == noErr else {
    fail("TISEnableInputSource failed with \(enableStatus)")
}
if let value = property(source, kTISPropertyInputSourceIsEnabled) as? Bool, !value {
    fail("the system reported it enabled but still lists it as disabled")
}
report("enabled", "yes")

let selectStatus = TISSelectInputSource(source)
if selectStatus == noErr {
    report("selected", "yes")
} else {
    // Not fatal: selecting needs a focused text field in some sessions, and the
    // question here is whether the input method registered, not whether this
    // particular runner had somewhere to type.
    report("selected", "no (\(selectStatus)) — needs a focused field, not a defect")
}

// ---------------------------------------------------------------- data

// The engine reads its model from Application Support; the shell copies it out
// of the bundle on first use. If the bundle is missing the data, the input method
// installs and then types nothing.
let dataInBundle = URL(fileURLWithPath: appPath)
    .appendingPathComponent("Contents/Resources/data/bopomofo-lm.tsv")
guard FileManager.default.fileExists(atPath: dataInBundle.path) else {
    fail("the language model is not in the bundle at \(dataInBundle.path)")
}
let size = (try? FileManager.default.attributesOfItem(atPath: dataInBundle.path)[.size] as? Int) ?? 0
report("language model in the bundle", "\(size ?? 0) bytes")

print("ok    the input method registers and activates")
