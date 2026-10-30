package tw.pingzhu.ime

/**
 * The decoder, reached through JNI.
 *
 * Every method here forwards to the same Rust core the Windows shells use, so
 * the two platforms cannot drift: there is one implementation of the reading
 * grid, one segmentation, one candidate order, one conversion table.
 *
 * The engine is a native pointer with a lifetime. [close] must be called — an
 * input method is torn down whenever the system feels like it, and a leaked
 * engine is 6 MB of language model per instance.
 */
class Engine private constructor(private var handle: Long) : AutoCloseable {

    val isValid: Boolean get() = handle != 0L

    private fun require(): Long = handle

    // ------------------------------------------------------------------ input

    /** Feeds one key. Returns true when the input method consumed it. */
    fun feedKey(key: Char): Boolean = nativeFeedKey(require(), key.toString())

    fun backspace(): Boolean = nativeBackspace(require())

    fun reset() = nativeReset(require())

    // ------------------------------------------------------------- composition

    fun composing(): String = nativeComposing(require())

    fun bestSentence(): String = nativeBestSentence(require())

    fun isComposing(): Boolean = composing().isNotEmpty()

    /**
     * False when the current sentence is a per-syllable guess rather than a real
     * decode. The candidate bar shows the difference, so the user knows when to
     * look before committing.
     */
    fun outputIsFaithful(): Boolean = nativeOutputIsFaithful(require())

    // -------------------------------------------------------------- candidates

    /** The current candidate page, in display order. */
    fun candidates(): List<String> =
        nativeCandidates(require()).split('\n').filter { it.isNotEmpty() }

    fun windowOpen(): Boolean = nativeWindowOpen(require())

    fun openWindow(): Boolean = nativeOpenWindow(require())

    /** Selects by position within the page, one-based, matching the digit keys. */
    fun select(oneBased: Int): String = nativeSelect(require(), oneBased)

    fun nextPage(): Boolean = nativeNextPage(require())

    fun commit(): String = nativeCommit(require())

    // ------------------------------------------------------------------ script

    /** "traditional" or "simplified". */
    fun outputScript(): String = nativeOutputScript(require())

    fun setOutputScript(script: String): Boolean = nativeSetOutputScript(require(), script)

    // --------------------------------------------------------- user dictionary

    fun loadUserDictionary(path: String): Boolean = nativeLoadUserDictionary(require(), path)

    fun saveUserDictionary(path: String): Boolean = nativeSaveUserDictionary(require(), path)

    override fun close() {
        if (handle != 0L) {
            nativeDestroy(handle)
            handle = 0L
        }
    }

    companion object {
        /**
         * Creates an engine reading `bopomofo-lm.tsv` and `ts-conversion.tsv`
         * from [dataDir]. Returns null when the language model cannot be read —
         * the caller shows a message rather than pretending to work.
         */
        /**
         * @param layout one of standard / eten / hsu / eten26 / ibm / ginyieh / mitac.
         * An unknown name falls back to standard inside the core — the same rule the
         * desktop shells apply, so a typo is "the layout did not change", never a
         * keyboard that types nothing.
         */
        fun create(dataDir: String, layout: String = "standard"): Engine? {
            val handle = nativeCreate(dataDir, layout)
            return if (handle == 0L) null else Engine(handle)
        }

        /**
         * The keyboard as it should be drawn: four rows of (key, label).
         *
         * Comes from the engine rather than a table in this file. A second copy
         * of a 41-key layout is a second thing to keep correct, and the copy on
         * screen is the one nobody tests — the decoder would keep working while
         * the picture slowly stopped matching it.
         */
        /** The raw native payload, for diagnosis. Not for drawing. */
        fun rawKeyboardLabels(layout: String = "standard"): String = nativeKeyboardLabels(layout)

        /**
         * The board as it should be drawn, for the layout in use.
         *
         * It takes the layout by name rather than asking the engine: the rows are a
         * property of the layout table, and the engine that exists may be a
         * different one than the rows are wanted for (the settings screen draws
         * nothing, the keyboard draws after the engine is rebuilt).
         */
        /**
         * The punctuation page, as rows of glyphs.
         *
         * It comes from the core rather than a Kotlin table: the page is the same in
         * every layout, and the desktop shells and the demo page read the same one.
         * A table per shell is what this project keeps having to un-copy.
         */
        fun symbolRows(): List<List<String>> =
            nativeSymbolRows()
                .split('\n')
                .filter { it.isNotEmpty() }
                .map { row -> row.split('|').filter { it.isNotEmpty() } }

        fun keyboardRows(layout: String = "standard"): List<List<Pair<Char, String>>> =
            nativeKeyboardLabels(layout)
                .split('\n')
                .filter { it.isNotEmpty() }
                .map { row ->
                    row.split(' ').filter { it.isNotEmpty() }.map { cell ->
                        val parts = cell.split('\t')
                        parts[0][0] to (parts.getOrNull(1) ?: "")
                    }
                }

        init {
            System.loadLibrary("pingzhu_android")
        }

        @JvmStatic private external fun nativeCreate(dataDir: String, layout: String): Long

        @JvmStatic private external fun nativeKeyboardLabels(layout: String): String

        @JvmStatic private external fun nativeSymbolRows(): String
        @JvmStatic private external fun nativeDestroy(handle: Long)
        @JvmStatic private external fun nativeFeedKey(handle: Long, key: String): Boolean
        @JvmStatic private external fun nativeBackspace(handle: Long): Boolean
        @JvmStatic private external fun nativeReset(handle: Long)
        @JvmStatic private external fun nativeComposing(handle: Long): String
        @JvmStatic private external fun nativeBestSentence(handle: Long): String
        @JvmStatic private external fun nativeOutputIsFaithful(handle: Long): Boolean
        @JvmStatic private external fun nativeCandidates(handle: Long): String
        @JvmStatic private external fun nativeWindowOpen(handle: Long): Boolean
        @JvmStatic private external fun nativeOpenWindow(handle: Long): Boolean
        @JvmStatic private external fun nativeNextPage(handle: Long): Boolean
        @JvmStatic private external fun nativeSelect(handle: Long, oneBased: Int): String
        @JvmStatic private external fun nativeCommit(handle: Long): String
        @JvmStatic private external fun nativeOutputScript(handle: Long): String
        @JvmStatic private external fun nativeSetOutputScript(handle: Long, script: String): Boolean
        @JvmStatic private external fun nativeLoadUserDictionary(handle: Long, path: String): Boolean
        @JvmStatic private external fun nativeSaveUserDictionary(handle: Long, path: String): Boolean
    }
}
