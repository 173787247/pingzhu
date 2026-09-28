import Cocoa
import Carbon

/**
 Registering this input method with the system.

 Putting a bundle in `~/Library/Input Methods` does not register it. Every input
 method that works calls these two functions, and this one did not:

     TISRegisterInputSource(bundleURL)   tell the system the bundle exists
     TISEnableInputSource(source)        put each declared mode in the list

 Found by reading vChewing, which is a working Bopomofo input method:

     public static func registerInputMethod() -> Bool {
         let instances = TISInputSource.allRegisteredInstancesOfThisInputMethod
         if instances.isEmpty {
             // 有實例尚未登記。執行登記手續。
             consoleLog("Registering input source.")
             if !TISInputSource.registerInputSource() { ... }
         }
         ...
     }

 The same shape appears in every macOS input method that has an installer: the
 installer exists to run this. WeType's Homebrew cask broke precisely because its
 installer stopped being run — the app installed and never appeared.
 */
enum Registration {

    /// The mode identifiers this bundle declares, read from its own Info.plist.
    ///
    /// Not hard-coded: a mismatch between this list and the plist would be one
    /// more place where the same fact is written twice.
    static var declaredModes: [String] {
        guard
            let components = Bundle.main.infoDictionary?["ComponentInputModeDict"] as? [String: Any],
            let list = components["tsInputModeListKey"] as? [String: Any]
        else { return [] }
        return list.keys.map { $0 }
    }

    /// Asks the system to register this bundle, then enables every mode it declares.
    ///
    /// Logs each step, because `TISRegisterInputSource` returning `noErr` does not
    /// mean the input method appeared — measured directly: the call succeeds, and
    /// `TISCreateInputSourceList` still does not list it. Whatever the real reason
    /// turns out to be, it is not visible in the return code, so the return code
    /// is not what gets logged as the answer.
    @discardableResult
    static func registerIfNeeded() -> Bool {
        let modes = declaredModes
        NSLog("PingZhu: declared modes: \(modes)")

        if !instancesOfThisInputMethod().isEmpty {
            NSLog("PingZhu: already registered with the system")
            return enableAll()
        }

        NSLog("PingZhu: registering \(Bundle.main.bundleURL.path) with the system")
        let status = TISRegisterInputSource(Bundle.main.bundleURL as CFURL)
        if status != noErr {
            NSLog("PingZhu: TISRegisterInputSource returned \(status)")
            return false
        }

        // The call returned noErr. Whether it did anything is a separate question —
        // ask the system rather than trusting the code.
        let after = instancesOfThisInputMethod()
        NSLog("PingZhu: after registering, the system lists \(after.count) of our inputs")
        if after.isEmpty {
            NSLog("PingZhu: registration reported success but nothing appeared — "
                  + "see macos/why-not-listed.sh; spctl is the usual reason")
            return false
        }
        return enableAll()
    }

    /// Every input source the system has that belongs to this input method.
    private static func instancesOfThisInputMethod() -> [TISInputSource] {
        let bundleID = Bundle.main.bundleIdentifier ?? ""
        guard
            let all = TISCreateInputSourceList(nil, true)?.takeRetainedValue() as? [TISInputSource]
        else { return [] }
        return all.filter { source in
            guard let id = property(source, kTISPropertyInputSourceID) as? String else { return false }
            return id == bundleID || id.hasPrefix(bundleID + ".")
        }
    }

    /// Enables each of our input sources so they appear under Input Sources.
    private static func enableAll() -> Bool {
        var allOK = true
        for source in instancesOfThisInputMethod() {
            let id = (property(source, kTISPropertyInputSourceID) as? String) ?? "?"
            let status = TISEnableInputSource(source)
            if status == noErr {
                NSLog("PingZhu: enabled \(id)")
            } else {
                NSLog("PingZhu: TISEnableInputSource(\(id)) returned \(status)")
                allOK = false
            }
        }
        return allOK
    }

    private static func property(_ source: TISInputSource, _ key: CFString) -> Any? {
        guard let raw = TISGetInputSourceProperty(source, key) else { return nil }
        return Unmanaged<AnyObject>.fromOpaque(raw).takeUnretainedValue()
    }
}
