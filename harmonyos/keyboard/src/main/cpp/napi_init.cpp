/*
 * The NAPI surface of the shared engine.
 *
 * ArkTS cannot call a C ABI. It calls a NAPI module, which is a C++ shim with a
 * fixed registration shape. This file is that shim: every function here is a
 * translation of one engine call, so the decisions stay in core-rs/ where the
 * other three platforms also read them.
 *
 * The engine is linked in statically (see CMakeLists.txt), which means the
 * declarations in pingzhu.h and the definitions in core-rs/src/ffi.rs have to
 * agree or the link fails. core-rs/src/ffi.rs has a test that reads the header
 * and checks exactly that, because the Windows and Android shells load the
 * library dynamically and would never notice a disagreement.
 */
#include <string>
#include <vector>

#include "napi/native_api.h"
#include "pingzhu.h"

namespace {

// One engine per process is enough for an input method: the system runs one
// instance of the extension and every text field goes through it.
EngineHandle* g_engine = nullptr;

void ensure_engine() {
    if (g_engine != nullptr) return;
    // The model lives in the HAP's resources; the path is supplied by the ArkTS
    // side on first use, so this stays a lazy no-op until then.
}

napi_value EngineLinked(napi_env env, napi_callback_info info) {
    napi_value result;
    napi_get_boolean(env, g_engine != nullptr, &result);
    return result;
}

napi_value EngineDescription(napi_env env, napi_callback_info info) {
    const std::string text = g_engine != nullptr
        ? "core-rs linked"
        : "core-rs linked, model not loaded";
    napi_value result;
    napi_create_string_utf8(env, text.c_str(), text.size(), &result);
    return result;
}

// The ABI version the Rust side reports. Reading it proves the static library
// is really in this binary and not a stub.
napi_value AbiVersion(napi_env env, napi_callback_info info) {
    napi_value result;
    napi_create_uint32(env, engine_abi_version(), &result);
    return result;
}

// Loads the language model. Called once, from the ArkTS side, with a path it
// obtained from the ability context — the native side has no way to know where
// the HAP unpacked its resources.
napi_value Create(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    size_t length = 0;
    if (argc < 1 || napi_get_value_string_utf8(env, args[0], nullptr, 0, &length) != napi_ok) {
        napi_throw_error(env, nullptr, "create() expects the model directory as a string");
        return nullptr;
    }
    std::string dir(length, '\0');
    napi_get_value_string_utf8(env, args[0], dir.data(), length + 1, &length);

    if (g_engine != nullptr) {
        engine_destroy(g_engine);
        g_engine = nullptr;
    }
    // Three arguments, not one.
    //
    // engine_create(data_dir, layout, candidate_order) — the layout is "standard"
    // (大千式) or "eten", and the candidate order is "longest-first",
    // "frequency", or anything else for the default. Passing fewer arguments is
    // a compile error on the C++ side, which is how this was found; a shell that
    // loads the library dynamically would have found out at runtime instead.
    g_engine = engine_create(dir.c_str(), "standard", "frequency");
    if (g_engine == nullptr) {
        // Not an exception: the caller decides whether a missing model is fatal.
        // An input method that cannot read its dictionary should say so and stay
        // usable, not take the whole keyboard down.
        napi_value result;
        napi_get_boolean(env, false, &result);
        return result;
    }
    napi_value result;
    napi_get_boolean(env, true, &result);
    return result;
}

// The keyboard, straight from the engine.
//
// Not a table in ArkTS. The drawn keys and the understood keys come from the
// same place, so they cannot drift — which is the failure that produced the
// digit rule regression in v0.6.0, where 倒 and every word beginning with
// ㄅㄉㄓㄚㄞㄢ stopped typing.
napi_value KeyboardRows(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    std::string layout = "standard";
    if (argc >= 1) {
        size_t length = 0;
        if (napi_get_value_string_utf8(env, args[0], nullptr, 0, &length) == napi_ok) {
            layout.resize(length);
            napi_get_value_string_utf8(env, args[0], layout.data(), length + 1, &length);
        }
    }

    char* rows = engine_keyboard_rows(layout.c_str());
    napi_value result;
    if (rows == nullptr) {
        napi_throw_error(env, nullptr, "the engine has no such layout");
        return nullptr;
    }
    napi_create_string_utf8(env, rows, NAPI_AUTO_LENGTH, &result);
    engine_keyboard_rows_free(rows);
    return result;
}

napi_value Candidates(napi_env env, napi_callback_info info) {
    if (g_engine == nullptr) {
        napi_throw_error(env, nullptr, "candidates() before create()");
        return nullptr;
    }
    const size_t count = engine_candidate_count(g_engine);
    napi_value list;
    napi_create_array_with_length(env, count, &list);
    for (size_t i = 0; i < count; ++i) {
        const char* text = engine_candidate_at(g_engine, i);
        napi_value item;
        napi_create_string_utf8(env, text == nullptr ? "" : text, NAPI_AUTO_LENGTH, &item);
        napi_set_element(env, list, i, item);
    }
    return list;
}

napi_value BestSentence(napi_env env, napi_callback_info info) {
    if (g_engine == nullptr) {
        napi_throw_error(env, nullptr, "bestSentence() before create()");
        return nullptr;
    }
    const char* text = engine_best_sentence(g_engine);
    napi_value result;
    napi_create_string_utf8(env, text == nullptr ? "" : text, NAPI_AUTO_LENGTH, &result);
    return result;
}

// One key at a time, for a keyboard that sends keystrokes as they are tapped.
napi_value FeedKey(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    size_t length = 0;
    if (argc < 1 || napi_get_value_string_utf8(env, args[0], nullptr, 0, &length) != napi_ok
        || length != 1) {
        napi_throw_error(env, nullptr, "feedKey() expects exactly one character");
        return nullptr;
    }
    char key[2] = {0, 0};
    napi_get_value_string_utf8(env, args[0], key, 2, &length);

    if (g_engine == nullptr) {
        napi_throw_error(env, nullptr, "feedKey() before create()");
        return nullptr;
    }
    napi_value result;
    napi_get_boolean(env, engine_feed_key(g_engine, key), &result);
    return result;
}

// Picks the n-th candidate and commits it.
//
// The panel's candidate list had onClick handlers that just called commit(),
// which commits the *default* — so tapping 妳好 gave 你好. Selecting by index is
// the whole point of showing a list.
napi_value SelectCandidate(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    uint32_t index = 0;
    if (argc < 1 || napi_get_value_uint32(env, args[0], &index) != napi_ok) {
        napi_throw_error(env, nullptr, "selectCandidate() expects a 1-based index");
        return nullptr;
    }
    if (g_engine == nullptr) {
        napi_throw_error(env, nullptr, "selectCandidate() before create()");
        return nullptr;
    }
    const char* text = engine_select_candidate(g_engine, index);
    napi_value result;
    napi_create_string_utf8(env, text == nullptr ? "" : text, NAPI_AUTO_LENGTH, &result);
    return result;
}

napi_value NextPage(napi_env env, napi_callback_info info) {
    if (g_engine == nullptr) { napi_value r; napi_get_boolean(env, false, &r); return r; }
    napi_value result;
    napi_get_boolean(env, engine_next_candidate_page(g_engine), &result);
    return result;
}

napi_value CandidateCount(napi_env env, napi_callback_info info) {
    napi_value result;
    napi_create_uint32(env, g_engine == nullptr ? 0 : engine_candidate_count(g_engine), &result);
    return result;
}

napi_value Composing(napi_env env, napi_callback_info info) {
    if (g_engine == nullptr) { napi_value r; napi_create_string_utf8(env, "", 0, &r); return r; }
    const char* text = engine_composing(g_engine);
    napi_value result;
    napi_create_string_utf8(env, text == nullptr ? "" : text, NAPI_AUTO_LENGTH, &result);
    return result;
}

napi_value Commit(napi_env env, napi_callback_info info) {
    if (g_engine == nullptr) { napi_value r; napi_create_string_utf8(env, "", 0, &r); return r; }
    const char* text = engine_commit(g_engine);
    napi_value result;
    napi_create_string_utf8(env, text == nullptr ? "" : text, NAPI_AUTO_LENGTH, &result);
    return result;
}

napi_value Reset(napi_env env, napi_callback_info info) {
    if (g_engine != nullptr) engine_reset(g_engine);
    return nullptr;
}

napi_value Decode(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1] = {nullptr};
    napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);

    size_t length = 0;
    if (argc < 1 || napi_get_value_string_utf8(env, args[0], nullptr, 0, &length) != napi_ok) {
        napi_throw_error(env, nullptr, "decode() expects the keystrokes as a string");
        return nullptr;
    }
    std::string keys(length, '\0');
    napi_get_value_string_utf8(env, args[0], keys.data(), length + 1, &length);

    if (g_engine == nullptr) {
        napi_throw_error(env, nullptr, "decode() before create()");
        return nullptr;
    }

    engine_reset(g_engine);
    engine_feed_keys(g_engine, keys.c_str());
    const char* text = engine_best_sentence(g_engine);

    napi_value result;
    // A null pointer here is a bug in the core, not an empty decode. Saying so
    // is better than handing ArkTS a string that looks like "nothing matched".
    if (text == nullptr) {
        napi_throw_error(env, nullptr, "the engine returned no sentence");
        return nullptr;
    }
    napi_create_string_utf8(env, text, NAPI_AUTO_LENGTH, &result);
    return result;
}

}  // namespace

EXTERN_C_START
static napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor desc[] = {
        {"engineLinked", nullptr, EngineLinked, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"engineDescription", nullptr, EngineDescription, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"abiVersion", nullptr, AbiVersion, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"create", nullptr, Create, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"decode", nullptr, Decode, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"keyboardRows", nullptr, KeyboardRows, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"candidates", nullptr, Candidates, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"bestSentence", nullptr, BestSentence, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"feedKey", nullptr, FeedKey, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"selectCandidate", nullptr, SelectCandidate, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"nextPage", nullptr, NextPage, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"candidateCount", nullptr, CandidateCount, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"composing", nullptr, Composing, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"commit", nullptr, Commit, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"reset", nullptr, Reset, nullptr, nullptr, nullptr, napi_default, nullptr},
    };
    napi_define_properties(env, exports, sizeof(desc) / sizeof(desc[0]), desc);
    return exports;
}
EXTERN_C_END

static napi_module pingzhuModule = {
    .nm_version = 1,
    .nm_flags = 0,
    .nm_filename = nullptr,
    .nm_register_func = Init,
    .nm_modname = "pingzhu",
    .nm_priv = nullptr,
    .reserved = {0},
};

extern "C" __attribute__((constructor)) void RegisterPingZhuModule(void) {
    napi_module_register(&pingzhuModule);
}
