package tw.pingzhu.ime

import android.content.Context
import android.inputmethodservice.InputMethodService
import android.os.Handler
import android.os.Looper
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputConnection
import android.widget.FrameLayout
import android.widget.TextView
import java.io.File
import java.util.concurrent.Executors

/**
 * The Android input method.
 *
 * The decoding is not here: every key goes to the shared Rust core, so this
 * class is only the Android half — turning touches into keys, and engine output
 * into committed text.
 */
class PingZhuImeService : InputMethodService() {

    private var engine: Engine? = null
    private var keyboard: KeyboardView? = null
    private var candidates: CandidateBar? = null

    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    /** True while the English keyboard is showing instead of Bopomofo. */
    private var englishMode = false

    override fun onCreate() {
        super.onCreate()
        // Loading the 6 MB language model takes a moment; doing it here rather
        // than on the first keystroke means the first keystroke is not the one
        // that waits.
        worker.execute { loadEngine() }
    }

    private fun loadEngine() {
        val dataDir = ensureData()
        val created = dataDir?.let { Engine.create(it.absolutePath) }
        main.post { onEngineReady(created) }
    }

    private fun onEngineReady(created: Engine?) {
        engine = created
        if (created == null) {
            keyboard?.visibility = View.GONE
            candidates?.show("", getString(R.string.engine_missing), emptyList(), true)
            return
        }
        created.loadUserDictionary(userDictionary().absolutePath)
        created.setOutputScript(prefs().getString(KEY_SCRIPT, "traditional") ?: "traditional")
        buildKeyboard()
        refresh()
    }

    // ------------------------------------------------------------------- data

    /**
     * Copies the language model out of the APK on first run.
     *
     * The engine reads its files by path, and an asset inside an APK has no
     * path — so it has to land on the filesystem once. Returns null if the model
     * is missing, which is a build error rather than something to paper over:
     * an input method that silently types nothing is worse than one that says it
     * cannot start.
     */
    private fun ensureData(): File? {
        val target = File(filesDir, "data")
        val model = File(target, "bopomofo-lm.tsv")
        val conversion = File(target, "ts-conversion.tsv")
        if (model.exists() && conversion.exists()) return target

        target.mkdirs()
        return try {
            assets.open("bopomofo-lm.tsv").use { input ->
                model.outputStream().use { input.copyTo(it) }
            }
            assets.open("ts-conversion.tsv").use { input ->
                conversion.outputStream().use { input.copyTo(it) }
            }
            target
        } catch (e: Exception) {
            null
        }
    }

    private fun userDictionary() = File(filesDir, "pingzhu-userdict.txt")

    private fun prefs() = getSharedPreferences("pingzhu", Context.MODE_PRIVATE)

    // ------------------------------------------------------------------- views

    override fun onCreateInputView(): View {
        val root = FrameLayout(this)
        val board = KeyboardView(this)
        board.onKey = { key -> onKeyPressed(key) }
        keyboard = board
        root.addView(
            board,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
            ),
        )
        if (engine != null) buildKeyboard()
        return root
    }

    override fun onCreateCandidatesView(): View {
        val bar = CandidateBar(this)
        bar.onSelect = { index -> selectCandidate(index) }
        candidates = bar
        return bar
    }

    /** All rows are [row][column]. */
    private val keyboardRows = mutableListOf<List<KeyboardView.Key>>()

    private fun buildKeyboard() {
        val board = keyboard ?: return
        if (englishMode) {
            board.setKeys(QWERTY_ROWS)
            board.simplified = false
            return
        }
        val rows = Engine.keyboardRows().map { row ->
            row.mapNotNull { (key, label) ->
                if (label.isEmpty()) null else KeyboardView.Key(key, label)
            }
        }.filter { it.isNotEmpty() }

        // The bottom row is ours, not the engine's: these are actions rather
        // than readings, and no Bopomofo layout has an opinion about them.
        val scriptKey = KeyboardView.Key(
            key = ' ',
            label = "",
            weight = 1.4f,
            function = KeyboardView.Key.Function.Script,
        )
        val bottom = listOf(
            scriptKey,
            KeyboardView.Key(' ', "空白", weight = 4f, function = KeyboardView.Key.Function.Space),
            KeyboardView.Key(
                '\b', "⌫", weight = 1.4f,
                function = KeyboardView.Key.Function.Backspace,
            ),
            KeyboardView.Key(
                '\n', "↵", weight = 1.4f,
                function = KeyboardView.Key.Function.Enter,
            ),
        )
        keyboardRows.clear()
        keyboardRows.addAll(rows)
        keyboardRows.add(bottom)
        board.setKeys(keyboardRows)
        board.simplified = engine?.outputScript() == "simplified"
    }

    // ------------------------------------------------------------------- input

    private fun onKeyPressed(key: KeyboardView.Key) {
        when (key.function) {
            KeyboardView.Key.Function.Script -> toggleScript()
            KeyboardView.Key.Function.Space -> handleKey(' ')
            KeyboardView.Key.Function.Backspace -> handleKey('\b')
            KeyboardView.Key.Function.Enter -> handleKey('\n')
            KeyboardView.Key.Function.None -> handleKey(key.key)
        }
    }

    private fun handleKey(ch: Char) {
        // Nothing here belongs to the input method when the English board is up,
        // so every key goes straight through. The alternative — leaving the
        // Bopomofo decoder live behind a Latin keyboard — means a phone number
        // field quietly fills with Chinese.
        if (englishMode) {
            sendKeyToApplication(ch)
            return
        }
        val engine = this.engine ?: return
        val composing = engine.isComposing()
        val windowOpen = engine.windowOpen()
        val hasCandidates = windowOpen && engine.candidates().isNotEmpty()

        when (Router.route(ch, composing, windowOpen, hasCandidates)) {
            Action.Pass -> sendKeyToApplication(ch)
            Action.Compose -> {
                if (!engine.feedKey(ch)) sendKeyToApplication(ch)
            }
            Action.Backspace -> {
                if (!engine.backspace()) sendKeyToApplication('\b')
            }
            Action.Commit -> commit()
            Action.Cancel -> {
                engine.reset()
                currentInputConnection?.setComposingText("", 0)
            }
            Action.OpenCandidates -> {
                engine.openWindow()
            }
            Action.CloseCandidates -> {
                engine.reset()
                currentInputConnection?.setComposingText("", 0)
            }
            Action.NextPage -> engine.nextPage()
            Action.SelectCandidate -> {
                val chosen = engine.select(Router.candidateIndex(ch))
                if (chosen.isNotEmpty()) commit()
            }
            Action.PrevPage -> Unit
        }
        refresh()
    }

    /** Passes a key through when the input method has no use for it. */
    private fun sendKeyToApplication(ch: Char) {
        val connection = currentInputConnection ?: return
        when (ch) {
            '\b' -> connection.deleteSurroundingText(1, 0)
            '\n' -> connection.sendKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_ENTER))
            else -> connection.commitText(ch.toString(), 1)
        }
    }

    private fun selectCandidate(oneBased: Int) {
        val engine = this.engine ?: return
        if (engine.select(oneBased).isNotEmpty()) commit()
        refresh()
    }

    private fun commit() {
        val engine = this.engine ?: return
        val text = engine.commit()
        if (text.isNotEmpty()) currentInputConnection?.commitText(text, 1)
        engine.reset()
        // Learn from use: the corrections the user makes are the only training
        // signal this input method has, and losing them on an app switch would
        // make the whole feature invisible.
        worker.execute { engine.saveUserDictionary(userDictionary().absolutePath) }
    }

    private fun toggleScript() {
        val engine = this.engine ?: return
        val next = if (engine.outputScript() == "simplified") "traditional" else "simplified"
        if (engine.setOutputScript(next)) {
            prefs().edit().putString(KEY_SCRIPT, next).apply()
            keyboard?.simplified = next == "simplified"
        }
        refresh()
    }

    /** Pushes the engine's current state into the candidate bar and the app. */
    private fun refresh() {
        val engine = this.engine ?: return
        val composing = engine.composing()
        val sentence = engine.bestSentence()
        val windowOpen = engine.windowOpen()
        val list = if (windowOpen) engine.candidates() else emptyList()

        candidates?.show(composing, sentence, list, engine.outputIsFaithful())

        // The letters being typed stay in the field, underlined by the
        // application — the standard Android behaviour, and the reason the user
        // can see where the text will land.
        val connection = currentInputConnection ?: return
        // The letters stay in the field, underlined by the application, whether
        // or not the candidate list is open: the point of showing them is that
        // the user can see where the text will land. Only the candidate page
        // depends on the list being open.
        connection.setComposingText(if (composing.isEmpty()) "" else sentence, 1)
    }

    override fun onStartInput(info: EditorInfo?, restarting: Boolean) {
        super.onStartInput(info, restarting)
        engine?.reset()
        // Passwords and numbers get the system keyboard: an input method that
        // covers a numeric field with a Bopomofo board is one the user fights.
        englishMode = info?.inputType?.let {
            val type = it and InputType.TYPE_MASK_CLASS
            type == InputType.TYPE_CLASS_NUMBER ||
                type == InputType.TYPE_CLASS_PHONE ||
                (it and InputType.TYPE_TEXT_VARIATION_PASSWORD) != 0
        } ?: false
        refresh()
    }

    override fun onFinishInput() {
        // Leaving a field ends the sentence: a half-typed reading carried into
        // the next app would be typed into it.
        engine?.reset()
        super.onFinishInput()
    }

    override fun onDestroy() {
        engine?.let { engine ->
            // Saved on the worker: a dictionary write on the main thread during
            // teardown is a dropped frame at exactly the wrong moment.
            val path = userDictionary().absolutePath
            worker.execute {
                engine.saveUserDictionary(path)
                engine.close()
            }
        }
        engine = null
        worker.shutdown()
        super.onDestroy()
    }

    companion object {
        const val KEY_SCRIPT = "output_script"

        /**
         * The Latin board, for numeric and password fields.
         *
         * A Bopomofo board over a phone-number field is something the user has to
         * fight, and Android has no way to ask for "the system keyboard" — so an
         * input method that handles other people's fields has to bring its own.
         */
        private val QWERTY_ROWS: List<List<KeyboardView.Key>> = listOf(
            "1234567890".map { KeyboardView.Key(it, it.toString()) },
            "qwertyuiop".map { KeyboardView.Key(it, it.toString()) },
            "asdfghjkl".map { KeyboardView.Key(it, it.toString()) },
            "zxcvbnm".map { KeyboardView.Key(it, it.toString()) } + listOf(
                KeyboardView.Key(' ', "空白", weight = 3f, function = KeyboardView.Key.Function.Space),
                KeyboardView.Key('\b', "⌫", function = KeyboardView.Key.Function.Backspace),
                KeyboardView.Key('\n', "↵", function = KeyboardView.Key.Function.Enter),
            ),
        )
    }
}
