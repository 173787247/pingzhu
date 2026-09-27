import Cocoa

/**
 The candidate window: what has been typed, what it would become, and the
 candidates for this page.

 A borderless `NSPanel` rather than a view in the client — an input method draws
 its own UI, and putting it in the client's window would make it scroll with the
 text.
 */
final class CandidateWindow: NSPanel {

    private let composingLabel = NSTextField(labelWithString: "")
    private let sentenceLabel = NSTextField(labelWithString: "")
    private let candidatesLabel = NSTextField(labelWithString: "")
    private let stack = NSStackView()

    init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: 320, height: 44),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        isFloatingPanel = true
        level = .popUpMenu
        // Never takes focus: the user is typing into the application, and a
        // candidate window that steals the keyboard would end the composition.
        becomesKeyOnlyIfNeeded = true
        hidesOnDeactivate = false
        backgroundColor = .clear
        isOpaque = false
        hasShadow = true

        let background = NSVisualEffectView()
        background.material = .hudWindow
        background.state = .active
        background.wantsLayer = true
        background.layer?.cornerRadius = 8
        background.layer?.masksToBounds = true

        composingLabel.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        composingLabel.textColor = .secondaryLabelColor
        sentenceLabel.font = .systemFont(ofSize: 17, weight: .medium)
        candidatesLabel.font = .systemFont(ofSize: 14)
        candidatesLabel.lineBreakMode = .byTruncatingTail

        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 2
        stack.edgeInsets = NSEdgeInsets(top: 8, left: 12, bottom: 8, right: 12)
        stack.addArrangedSubview(composingLabel)
        stack.addArrangedSubview(sentenceLabel)
        stack.addArrangedSubview(candidatesLabel)
        stack.translatesAutoresizingMaskIntoConstraints = false
        background.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: background.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: background.trailingAnchor),
            stack.topAnchor.constraint(equalTo: background.topAnchor),
            stack.bottomAnchor.constraint(equalTo: background.bottomAnchor),
        ])
        contentView = background
    }

    override var canBecomeKey: Bool { false }
    override var canBecomeMain: Bool { false }

    /**
     @param composing the raw keys so far, e.g. `su3`
     @param sentence what they would become
     @param candidates the current page
     @param faithful false when the sentence is a guess rather than a decode
     @param near where to appear — the insertion point's rectangle
     */
    func show(
        composing: String,
        sentence: String,
        candidates: [String],
        faithful: Bool,
        near anchor: NSRect
    ) {
        composingLabel.stringValue = composing.isEmpty ? "" : "[\(composing)]"

        // A guess is dimmed: the user should be able to tell at a glance whether
        // the engine recognised the word or is doing its best, because that is
        // exactly when they need to look at the choices.
        sentenceLabel.stringValue = sentence
        sentenceLabel.alphaValue = faithful ? 1.0 : 0.55

        let numbered = candidates.enumerated().map { index, word in
            "\(index == 9 ? "0" : String(index + 1)) \(word)"
        }
        candidatesLabel.stringValue = numbered.joined(separator: "   ")
        candidatesLabel.isHidden = candidates.isEmpty

        composingLabel.isHidden = composing.isEmpty

        let size = stack.fittingSize
        setContentSize(NSSize(width: max(size.width, 120), height: size.height))

        // Below the insertion point, nudged up when it would run off the bottom
        // of the screen — a candidate window half off-screen is worse than one
        // slightly overlapping the line above.
        var origin = NSPoint(x: anchor.minX, y: anchor.minY - frame.height - 4)
        if let screen = NSScreen.main, origin.y < screen.visibleFrame.minY {
            origin.y = anchor.maxY + 4
        }
        if let screen = NSScreen.main, origin.x + frame.width > screen.visibleFrame.maxX {
            origin.x = screen.visibleFrame.maxX - frame.width
        }
        setFrameOrigin(origin)
        orderFrontRegardless()
    }

    func hide() {
        orderOut(nil)
    }
}
