import Cocoa
import InputMethodKit

/**
 The input method itself.

 The decoding is not here: every key goes to the shared Rust core, so this class
 is only the macOS half — turning key events into engine calls, and engine output
 into text the client can insert.
 */
@objc(PingZhuInputController)
final class PingZhuInputController: IMKInputController {

    private var engine: Engine?
    private var candidateWindow: CandidateWindow?

    /// What the client is currently showing as uncommitted text, so it can be
    /// replaced rather than appended to.
    private var markedText: String = ""

    /// The down arrow and the up arrow do not reach `handle(_:client:)` as
    /// themselves — IMK delivers them as private-use characters. Mapping them to
    /// the same markers the routers use keeps one table for all four shells.
    private static let downArrow = UnicodeScalar(0x0b)!
    private static let upArrow = UnicodeScalar(0x0c)!

    override init!(server: IMKServer!, delegate: Any!, client: Any!) {
        super.init(server: server, delegate: delegate, client: client)
        loadEngine()
    }

    deinit {
        engine?.close()
    }

    // MARK: - Setup

    private func loadEngine() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PingZhu", isDirectory: true)
        try? FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)

        // The data ships inside the bundle; the first launch copies it somewhere
        // writable, because the engine reads its files by path and a path inside
        // an app bundle is not writable.
        let dataDir = support.appendingPathComponent("data", isDirectory: true)
        let model = dataDir.appendingPathComponent("bopomofo-lm.tsv")

        if !FileManager.default.fileExists(atPath: model.path) {
            guard let bundled = Bundle.main.resourceURL?.appendingPathComponent("data") else {
                NSLog("PingZhu: no data directory in the bundle")
                return
            }
            try? FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)
            for name in ["bopomofo-lm.tsv", "ts-conversion.tsv"] {
                let from = bundled.appendingPathComponent(name)
                let to = dataDir.appendingPathComponent(name)
                try? FileManager.default.removeItem(at: to)
                try? FileManager.default.copyItem(at: from, to: to)
            }
        }

        guard let created = Engine(dataDir: dataDir.path) else {
            NSLog("PingZhu: the engine could not load its language model from \(dataDir.path)")
            return
        }
        created.loadUserDictionary(path: support.appendingPathComponent("userdict.txt").path)

        // The choice is shared with the other platforms through the same idea:
        // stored beside the dictionary, read at start-up.
        if let script = UserDefaults.standard.string(forKey: "outputScript") {
            created.setOutputScript(script)
        }
        engine = created
    }

    private var userDictionaryPath: String {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("PingZhu", isDirectory: true)
        return support.appendingPathComponent("userdict.txt").path
    }

    // MARK: - Key handling

    override func handle(_ event: NSEvent!, client sender: Any!) -> Bool {
        guard let event, event.type == .keyDown, let engine else { return false }

        // Modifier combinations belong to the application: ⌘C, ⌘V, ⌥Tab. The
        // input method only claims unmodified keys, with one exception below.
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        if flags.contains(.command) || flags.contains(.control) {
            return false
        }

        var key = event.charactersIgnoringModifiers?.first
        if event.keyCode == 125 { key = Character(Self.downArrow) }   // down arrow
        if event.keyCode == 126 { key = Character(Self.upArrow) }     // up arrow
        guard let key else { return false }

        let state = Router.State(
            composing: engine.isComposing,
            windowOpen: engine.candidateWindowOpen,
            hasCandidates: engine.candidateCount > 0
        )

        switch Router.route(key, state) {
        case .pass:
            return false

        case .compose:
            guard engine.feedKey(key) else { return false }
            showMarkedText()

        case .backspace:
            if !engine.backspace() {
                return false
            }
            showMarkedText()

        case .commit:
            commit()

        case .cancel:
            engine.reset()
            clearMarkedText()

        case .openCandidates:
            engine.openCandidates()
            showCandidates()

        case .closeCandidates:
            engine.closeCandidates()
            showCandidates()

        case .nextPage:
            engine.nextPage()
            showCandidates()

        case .prevPage:
            engine.prevPage()
            showCandidates()

        case .selectCandidate:
            if !engine.selectCandidate(oneBased: Router.candidateIndex(key)).isEmpty {
                commit()
            } else {
                showCandidates()
            }
        }
        return true
    }

    // MARK: - Text

    /// Shows the decoded sentence as uncommitted text, underlined by the client.
    ///
    /// The letters the user typed never reach the application: what appears is
    /// what would be committed. That is the whole point of an input method with a
    /// dictionary — the alternative is watching 我奈以 appear and then change.
    private func showMarkedText() {
        guard let engine, let client = client() else { return }
        let sentence = engine.sentence
        guard !sentence.isEmpty else {
            clearMarkedText()
            return
        }
        let attributes: [NSAttributedString.Key: Any] = [
            .underlineStyle: NSUnderlineStyle.single.rawValue,
            .underlineColor: NSColor.secondaryLabelColor,
        ]
        client.setMarkedText(
            NSAttributedString(string: sentence, attributes: attributes),
            selectionRange: NSRange(location: sentence.utf16.count, length: 0),
            replacementRange: NSRange(location: NSNotFound, length: 0)
        )
        markedText = sentence
        showCandidates()
    }

    private func clearMarkedText() {
        guard let client = client() else { return }
        client.setMarkedText(
            NSAttributedString(string: ""),
            selectionRange: NSRange(location: 0, length: 0),
            replacementRange: NSRange(location: NSNotFound, length: 0)
        )
        markedText = ""
        candidateWindow?.hide()
    }

    private func commit() {
        guard let engine, let client = client() else { return }
        let text = engine.commit()
        if !text.isEmpty {
            client.insertText(text, replacementRange: NSRange(location: NSNotFound, length: 0))
        }
        engine.reset()
        markedText = ""
        candidateWindow?.hide()

        // Learn from use: the corrections the user makes are the only training
        // signal this input method has.
        DispatchQueue.global(qos: .utility).async {
            engine.saveUserDictionary(path: self.userDictionaryPath)
        }
    }

    // MARK: - Candidates

    private func showCandidates() {
        guard let engine, engine.candidateWindowOpen else {
            candidateWindow?.hide()
            return
        }
        let window = candidateWindow ?? CandidateWindow()
        candidateWindow = window
        window.show(
            composing: engine.composing,
            sentence: engine.sentence,
            candidates: (0..<engine.candidateCount).map { engine.candidate(at: $0) },
            faithful: engine.outputIsFaithful,
            near: cursorRect()
        )
    }

    /// Where the candidate window should appear: under the insertion point.
    private func cursorRect() -> NSRect {
        if let client = client() {
            let rect = client.firstRect(forCharacterRange: client.selectedRange(), actualRange: nil)
            if rect.width > 0 || rect.height > 0 { return rect }
        }
        // Falling back to the mouse keeps the window somewhere sensible rather
        // than in the corner, where it would look like a bug.
        let mouse = NSEvent.mouseLocation
        return NSRect(x: mouse.x, y: mouse.y - 24, width: 1, height: 20)
    }

    // MARK: - Menu

    /// The input method menu, under the IME's own entry in the input menu.
    override func menu() -> NSMenu! {
        let menu = NSMenu(title: "PingZhu")
        let simplified = engine?.outputScript == "simplified"

        let traditional = NSMenuItem(title: "繁體輸出", action: #selector(useTraditional), keyEquivalent: "")
        traditional.target = self
        traditional.state = simplified ? .off : .on
        menu.addItem(traditional)

        let simplifiedItem = NSMenuItem(title: "簡體輸出", action: #selector(useSimplified), keyEquivalent: "")
        simplifiedItem.target = self
        simplifiedItem.state = simplified ? .on : .off
        menu.addItem(simplifiedItem)

        menu.addItem(.separator())
        let about = NSMenuItem(title: "關於平注", action: #selector(showAbout), keyEquivalent: "")
        about.target = self
        menu.addItem(about)

        return menu
    }

    @objc private func useTraditional() { setScript("traditional") }
    @objc private func useSimplified() { setScript("simplified") }

    private func setScript(_ script: String) {
        guard let engine, engine.setOutputScript(script) else { return }
        UserDefaults.standard.set(script, forKey: "outputScript")
        showMarkedText()
    }

    @objc private func showAbout() {
        let alert = NSAlert()
        alert.messageText = "平注 PingZhu"
        alert.informativeText = """
            開源注音輸入法。解碼引擎與 Windows、Android 版共用同一份 Rust 核心。

            打 su3cl3 會出現「你好」。空白鍵送出，↓ 開啟選字單。
            """
        alert.addButton(withTitle: "好")
        alert.runModal()
    }
}
