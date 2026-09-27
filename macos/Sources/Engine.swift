import Foundation

/**
 The decoder, reached through the C ABI.

 Every method forwards to the same Rust core the Windows and Android shells use,
 so the three platforms cannot drift: one reading grid, one segmentation, one
 candidate order, one conversion table.

 The engine is a pointer with a lifetime. `close()` must be called — an input
 method is torn down whenever the system feels like it, and a leaked engine is
 6 MB of language model per instance.
 */
final class Engine {
    private var handle: OpaquePointer?

    var isValid: Bool { handle != nil }

    /// Creates an engine reading its data files from `dataDir`.
    ///
    /// Returns nil when the language model cannot be read. The caller shows an
    /// error rather than pretending to work — an input method that silently
    /// types nothing is worse than one that says it cannot start.
    init?(dataDir: String) {
        guard let created = dataDir.withCString({ engine_create($0, "standard", nil) }) else {
            return nil
        }
        handle = created
    }

    deinit { close() }

    func close() {
        if let handle {
            engine_destroy(handle)
            self.handle = nil
        }
    }

    // MARK: - Input

    /// Feeds one key. Returns false when the layout has no use for it, which is
    /// how the shell knows to pass the key on to the application.
    @discardableResult
    func feedKey(_ key: Character) -> Bool {
        guard let handle else { return false }
        return String(key).withCString { engine_feed_key(handle, $0) }
    }

    @discardableResult
    func backspace() -> Bool {
        guard let handle else { return false }
        return engine_backspace(handle)
    }

    func reset() {
        guard let handle else { return }
        engine_reset(handle)
    }

    // MARK: - Composition

    var composing: String {
        guard let handle, let raw = engine_composing(handle) else { return "" }
        return String(cString: raw)
    }

    var sentence: String {
        guard let handle, let raw = engine_best_sentence(handle) else { return "" }
        return String(cString: raw)
    }

    var isComposing: Bool { !composing.isEmpty }

    /// False when the current sentence is a per-syllable guess rather than a real
    /// decode. The candidate window shows the difference, so the user knows when
    /// to check before committing.
    var outputIsFaithful: Bool {
        guard let handle else { return true }
        return engine_output_is_faithful(handle)
    }

    // MARK: - Candidates

    var candidateCount: Int {
        guard let handle else { return 0 }
        return engine_candidate_count(handle)
    }

    func candidate(at index: Int) -> String {
        guard let handle, let raw = engine_candidate_at(handle, index) else { return "" }
        return String(cString: raw)
    }

    var candidateWindowOpen: Bool {
        guard let handle else { return false }
        return engine_candidate_window_open(handle)
    }

    @discardableResult
    func openCandidates() -> Bool {
        guard let handle else { return false }
        return engine_open_candidate_window(handle)
    }

    func closeCandidates() {
        guard let handle else { return }
        engine_close_candidate_window(handle)
    }

    @discardableResult
    func nextPage() -> Bool {
        guard let handle else { return false }
        return engine_next_candidate_page(handle)
    }

    @discardableResult
    func prevPage() -> Bool {
        guard let handle else { return false }
        return engine_prev_candidate_page(handle)
    }

    /// Selects by position within the page, one-based, matching the digit keys.
    func selectCandidate(oneBased: Int) -> String {
        guard let handle, let raw = engine_select_candidate(handle, oneBased) else { return "" }
        return String(cString: raw)
    }

    func commit() -> String {
        guard let handle, let raw = engine_commit(handle) else { return "" }
        return String(cString: raw)
    }

    // MARK: - Output script

    var outputScript: String {
        guard let handle, let raw = engine_output_script(handle) else { return "traditional" }
        return String(cString: raw)
    }

    @discardableResult
    func setOutputScript(_ script: String) -> Bool {
        guard let handle else { return false }
        return script.withCString { engine_set_output_script(handle, $0) }
    }

    // MARK: - User dictionary

    @discardableResult
    func loadUserDictionary(path: String) -> Bool {
        guard let handle else { return false }
        return path.withCString { engine_load_user_dictionary(handle, $0) }
    }

    @discardableResult
    func saveUserDictionary(path: String) -> Bool {
        guard let handle else { return false }
        return path.withCString { engine_save_user_dictionary(handle, $0) }
    }
}
