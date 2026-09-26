package tw.pingzhu.ime

import android.content.Context
import android.graphics.Typeface
import android.util.AttributeSet
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * The candidate strip: what has been typed, what it would become, and the ten
 * choices for this page.
 *
 * Laid out as a scrolling row of `TextView`s rather than drawn, because the
 * number of candidates changes on every keystroke and scrolling long pages comes
 * free — an input method that re-implements edge-fade scrolling is an input
 * method with a scrolling bug.
 */
class CandidateBar(context: Context, attrs: AttributeSet? = null) :
    HorizontalScrollView(context, attrs) {

    /** Called with a one-based index when a candidate is tapped. */
    var onSelect: ((Int) -> Unit)? = null

    private val row = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        setPadding(dp(6f), dp(4f), dp(6f), dp(4f))
    }

    private val composingLabel = TextView(context).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
        setTypeface(Typeface.MONOSPACE)
        setTextColor(0xFF7FB2E5.toInt())
        setPadding(dp(6f), 0, dp(10f), 0)
    }

    private val sentenceLabel = TextView(context).apply {
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 19f)
        setTypeface(Typeface.DEFAULT_BOLD)
        setTextColor(0xFFF2F5FF.toInt())
        setPadding(dp(4f), 0, dp(12f), 0)
    }

    private val divider = View(context).apply {
        setBackgroundColor(0xFF3A414D.toInt())
    }

    init {
        isHorizontalScrollBarEnabled = false
        setBackgroundColor(0xFF262B33.toInt())
        row.addView(composingLabel)
        row.addView(sentenceLabel)
        row.addView(divider)
        addView(row)
    }

    private fun dp(value: Float) = (value * resources.displayMetrics.density).toInt()

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        // A one-pixel rule between the sentence and the choices; sized here
        // because it only knows its height once the bar does.
        divider.layoutParams = LinearLayout.LayoutParams(dp(1f), (h * 0.5f).toInt()).apply {
            gravity = Gravity.CENTER_VERTICAL
            marginEnd = dp(8f)
        }
    }

    /**
     * @param composing the raw keys so far, e.g. `su3`
     * @param sentence what they would become
     * @param candidates the current page
     * @param faithful false when the sentence is a guess rather than a decode
     */
    fun show(composing: String, sentence: String, candidates: List<String>, faithful: Boolean) {
        composingLabel.text = if (composing.isEmpty()) "" else "[$composing]"
        sentenceLabel.text = sentence
        // A guess is dimmed and italic: the user should be able to tell at a
        // glance whether the engine recognised the word or is doing its best,
        // because that is exactly when they need to check the choices.
        sentenceLabel.alpha = if (faithful) 1.0f else 0.55f
        sentenceLabel.setTypeface(Typeface.DEFAULT_BOLD, if (faithful) Typeface.NORMAL else Typeface.ITALIC)

        // Candidate views are rebuilt rather than reused: there are at most ten,
        // and a recycled pool here would be more code than it saves.
        while (row.childCount > 3) row.removeViewAt(3)

        candidates.forEachIndexed { index, candidate ->
            val number = if (index == 9) "0" else (index + 1).toString()
            val view = TextView(context).apply {
                text = "$number $candidate"
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
                setTextColor(0xFFE8EDF7.toInt())
                setPadding(dp(10f), dp(6f), dp(10f), dp(6f))
                isClickable = true
                setOnClickListener { onSelect?.invoke(index + 1) }
            }
            row.addView(view)
        }
        visibility = if (composing.isEmpty() && candidates.isEmpty()) GONE else VISIBLE
    }
}
