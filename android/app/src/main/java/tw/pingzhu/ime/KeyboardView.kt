package tw.pingzhu.ime

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.util.AttributeSet
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View

/**
 * The keyboard, drawn rather than assembled from buttons.
 *
 * A 41-key Bopomofo board with a bottom row does not fit Android's `KeyboardView`
 * (deprecated, and built for the Latin alphabet), and a `GridLayout` of `Button`s
 * puts a view per key between the touch and the input method — which is exactly
 * where an input method cannot afford latency.
 *
 * The key labels come from the engine, not from a table here. See
 * `Engine.keyboardRows`.
 */
class KeyboardView(context: Context, attrs: AttributeSet? = null) : View(context, attrs) {

    /** Called for every key press, with the character the key stands for. */
    var onKey: ((Key) -> Unit)? = null

    /**
     * A key on the board.
     *
     * [label] is what the user reads; [key] is what the engine receives. For the
     * function keys they differ — the space bar is labelled "空白" and sends a
     * space — and keeping them separate is what lets the labels be translated
     * without touching the decoding.
     */
    data class Key(
        val key: Char,
        val label: String,
        val weight: Float = 1f,
        val function: Function = Function.None,
    ) {
        enum class Function { None, Script, Space, Backspace, Enter }
    }

    private val rows: MutableList<MutableList<Key>> = mutableListOf()
    private val keyRects = mutableListOf<RectF>()
    private var pressed = -1

    private val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        typeface = Typeface.create("sans-serif", Typeface.NORMAL)
    }
    private val keyPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val pressedPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val functionPaint = Paint(Paint.ANTI_ALIAS_FLAG)

    init {
        setBackgroundColor(0xFF20242B.toInt())
        keyPaint.color = 0xFF343A44.toInt()
        pressedPaint.color = 0xFF4A8FD8.toInt()
        functionPaint.color = 0xFF2A2F38.toInt()
        labelPaint.color = 0xFFF2F5FF.toInt()
    }

    /** Replaces the board. Called after the engine has produced its layout. */
    fun setKeys(rows: List<List<Key>>) {
        this.rows.clear()
        this.rows.addAll(rows.map { it.toMutableList() })
        requestLayout()
        invalidate()
    }

    /** Which script the toggle key currently shows. */
    var simplified: Boolean = false
        set(value) {
            field = value
            // The toggle is the one key whose label is state, so changing it has
            // to redraw — and only it, so the board does not flicker on every
            // keystroke.
            invalidate()
        }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val rowHeight = (width / 10.5f).coerceAtLeast(dp(38f))
        /*
         * Never zero, even with no keys.
         *
         * The input view is measured once before the engine has finished loading,
         * and at that moment there are no rows to size against. A height of zero
         * is not a neutral answer: the window adopts it, and the framework then
         * measures everything afterwards against AT_MOST 0 — so the keyboard that
         * arrives a second later has nowhere to be drawn. Reserving the full
         * five rows up front means the space is already correct when the keys
         * arrive, and nothing has to be resized.
         */
        val rows = maxOf(this.rows.size, EXPECTED_ROWS)
        setMeasuredDimension(width, (rowHeight * rows).toInt())
    }

    private fun dp(value: Float) = value * resources.displayMetrics.density

    private companion object {
        /** Four Bopomofo rows and the function row. */
        const val EXPECTED_ROWS = 5
    }

    override fun onDraw(canvas: Canvas) {
        if (rows.isEmpty()) return
        val rowHeight = height.toFloat() / rows.size
        val gap = dp(2f)
        keyRects.clear()

        labelPaint.textSize = rowHeight * 0.42f

        rows.forEachIndexed { rowIndex, row ->
            val totalWeight = row.sumOf { it.weight.toDouble() }.toFloat()
            var x = gap
            val top = rowIndex * rowHeight + gap
            val bottom = (rowIndex + 1) * rowHeight - gap
            row.forEach { key ->
                val width = (this.width - gap * (row.size + 1)) * (key.weight / totalWeight)
                val rect = RectF(x, top, x + width, bottom)
                keyRects.add(rect)
                val isPressed = keyRects.size - 1 == pressed

                val background = when {
                    isPressed -> pressedPaint
                    key.function != Key.Function.None -> functionPaint
                    else -> keyPaint
                }
                canvas.drawRoundRect(rect, dp(6f), dp(6f), background)

                val text = when (key.function) {
                    // The toggle shows what will be produced, not what pressing it
                    // does. "What is displayed is what is output" is the whole
                    // point of a script indicator.
                    Key.Function.Script -> if (simplified) "简" else "繁"
                    else -> key.label
                }
                if (text.isNotEmpty()) {
                    val centre = rect.centerY() - (labelPaint.descent() + labelPaint.ascent()) / 2
                    canvas.drawText(text, rect.centerX(), centre, labelPaint)
                }
                x += width + gap
            }
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                pressed = indexAt(event.x, event.y)
                if (pressed >= 0) {
                    performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP)
                    invalidate()
                }
                return pressed >= 0
            }
            MotionEvent.ACTION_MOVE -> {
                val index = indexAt(event.x, event.y)
                if (index != pressed) {
                    pressed = index
                    invalidate()
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                val index = pressed
                pressed = -1
                invalidate()
                // Releasing on a different key cancels, the way a physical
                // keyboard behaves: sliding off a key must not type it.
                if (index >= 0 && index == indexAt(event.x, event.y)) {
                    rows.flatten().getOrNull(index)?.let { onKey?.invoke(it) }
                }
                return true
            }
            MotionEvent.ACTION_CANCEL -> {
                pressed = -1
                invalidate()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun indexAt(x: Float, y: Float): Int {
        keyRects.forEachIndexed { index, rect ->
            if (rect.contains(x, y)) return index
        }
        return -1
    }
}
