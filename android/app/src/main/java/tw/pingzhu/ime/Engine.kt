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
        fun create(dataDir: String): Engine? {
            val handle = nativeCreate(dataDir)
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
        fun rawKeyboardLabels(): String = nativeKeyboardLabels(0L)

        fun keyboardRows(): List<List<Pair<Char, String>>> =
            nativeKeyboardLabels(0L)
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

        @JvmStatic private external fun nativeCreate(dataDir: String): Long
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
        @JvmStatic private external fun nativeKeyboardLabels(handle: Long): String
    }
}
