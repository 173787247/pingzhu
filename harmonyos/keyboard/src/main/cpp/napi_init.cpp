/*
 * The NAPI surface of the shared engine.
 *
 * ArkTS cannot call a C ABI. It calls a NAPI module, which is a C++ shim with a
 * fixed registration shape. This file is that shim and nothing else: every
 * function here is a translation of one engine call, so the decisions stay in
 * core-rs/ where the other three platforms also read them.
 *
 * Right now it answers one question — is the engine there — and the answer is
 * honestly "not yet". Wiring the Rust static library in is the next step, and
 * until it is done the keyboard can be drawn and cannot select words. Saying so
 * through the API means the ArkTS side can show it rather than guess.
 */
#include <string>

#include "napi/native_api.h"

namespace {

// Where the engine would be called from. Kept as a separate function so the
// shape of the real binding is visible even while it is a stub.
std::string engine_description() {
    return "not linked yet";
}

napi_value EngineLinked(napi_env env, napi_callback_info info) {
    napi_value result;
    napi_get_boolean(env, false, &result);
    return result;
}

napi_value EngineDescription(napi_env env, napi_callback_info info) {
    const std::string text = engine_description();
    napi_value result;
    napi_create_string_utf8(env, text.c_str(), text.size(), &result);
    return result;
}

// The syllable-to-word call, once the engine is in. The signature is the one
// the other three shells use, so the ArkTS side can be written against it now.
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

    // No engine yet, so the honest answer is the input unchanged rather than an
    // empty string. An empty string looks like a decode that found nothing;
    // this looks like what it is.
    napi_value result;
    napi_create_string_utf8(env, keys.c_str(), keys.size(), &result);
    return result;
}

}  // namespace

EXTERN_C_START
static napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor desc[] = {
        {"engineLinked", nullptr, EngineLinked, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"engineDescription", nullptr, EngineDescription, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"decode", nullptr, Decode, nullptr, nullptr, nullptr, napi_default, nullptr},
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
