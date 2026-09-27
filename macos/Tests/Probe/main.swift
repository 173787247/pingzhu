import Carbon
import Foundation

/**
 Asks the system what it can see.

 Run on a CI runner to find out how far verification can go without a person:
 whether there is a logged-in GUI session, and whether the input source APIs
 answer at all.

 Prints findings and always exits 0 — this is a question, not an assertion.
 */

func report(_ label: String, _ value: String) {
    print("probe  \(label): \(value)")
}

// Is there a session that can display windows? `Aqua` means a real logged-in GUI
// session; `Background` or `StandardIO` means there is nobody to type.
let manager = ProcessInfo.processInfo.environment["XPC_SERVICE_NAME"] ?? "(unset)"
report("XPC_SERVICE_NAME", manager)

let consoleUser = ProcessInfo.processInfo.environment["USER"] ?? "(unknown)"
report("user", consoleUser)

// Can this process see input sources at all? A GUI-less session usually returns
// an empty list rather than failing, which is the quiet version of "no".
guard let sources = TISCreateInputSourceList(nil, true)?.takeRetainedValue() as? [TISInputSource] else {
    report("input sources", "TISCreateInputSourceList returned nil")
    exit(0)
}
report("input sources visible", "\(sources.count)")

var keyboardLayouts = 0
var inputMethods = 0
for source in sources {
    guard let raw = TISGetInputSourceProperty(source, kTISPropertyInputSourceCategory) else { continue }
    let category = Unmanaged<CFString>.fromOpaque(raw).takeUnretainedValue() as String
    if category == (kTISCategoryKeyboardInputSource as String) {
        keyboardLayouts += 1
    }
    if category == (kTISCategoryInputMethod as String) {
        inputMethods += 1
    }
}
report("keyboard layouts", "\(keyboardLayouts)")
report("input methods installed", "\(inputMethods)")

// The interesting one: can an input source be *enabled*? Enabling is a GUI
// session operation, so this is the question that decides whether CI can install
// and activate an input method or only build one.
var enabled = 0
for source in sources {
    guard let raw = TISGetInputSourceProperty(source, kTISPropertyInputSourceIsEnabled) else { continue }
    let value = Unmanaged<CFBoolean>.fromOpaque(raw).takeUnretainedValue()
    if CFBooleanGetValue(value) { enabled += 1 }
}
report("input sources currently enabled", "\(enabled)")

// Where does the system look for third-party input methods? If this directory
// exists and is writable, an input method can at least be installed.
let home = FileManager.default.homeDirectoryForCurrentUser
let inputMethodsDir = home.appendingPathComponent("Library/Input Methods")
let exists = FileManager.default.fileExists(atPath: inputMethodsDir.path)
let writable = FileManager.default.isWritableFile(atPath: inputMethodsDir.path)
report("~/Library/Input Methods exists", "\(exists)")
report("~/Library/Input Methods writable", "\(writable)")

// And the session type, which is the actual answer: `Aqua` means a person could
// be sitting here.
let session = ProcessInfo.processInfo.environment["SSH_CONNECTION"] == nil ? "not over ssh" : "over ssh"
report("connection", session)

exit(0)
