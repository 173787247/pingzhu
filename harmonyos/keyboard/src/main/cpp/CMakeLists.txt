# 平注的 HarmonyOS 原生模組。
#
# 這一層的責任只有一個：把 C ABI 包成 ArkTS 能呼叫的 NAPI 模組。
# 解碼在 core-rs/ 裡，跟 Windows、Android、macOS 用的是同一份。
cmake_minimum_required(VERSION 3.5.0)
project(pingzhu)

set(CMAKE_CXX_STANDARD 17)
set(NATIVERENDER_ROOT_PATH ${CMAKE_CURRENT_SOURCE_DIR})

include_directories(${NATIVERENDER_ROOT_PATH})
include_directories(${NATIVERENDER_ROOT_PATH}/include)
include_directories(${NATIVERENDER_ROOT_PATH}/../../../../../../core-rs/include)

# The Rust core, already cross-compiled by the workflow step that runs before
# this one. A relative path, not an absolute one: an absolute path to one
# machine's checkout works exactly until somebody else clones the repository.
#
# If the file is missing, CMake fails here with a clear message rather than
# producing a shared library that silently exports a stub.
set(PINGZHU_CORE_DIR ${NATIVERENDER_ROOT_PATH}/../../../../../../core-rs/target/aarch64-unknown-linux-ohos/release)
set(PINGZHU_CORE_LIB ${PINGZHU_CORE_DIR}/libpingzhu_core.a)

if(NOT EXISTS ${PINGZHU_CORE_LIB})
  message(FATAL_ERROR
    "libpingzhu_core.a is not at ${PINGZHU_CORE_LIB}.\n"
    "The Rust core has to be cross-compiled for aarch64-unknown-linux-ohos first:\n"
    "  rustup target add aarch64-unknown-linux-ohos\n"
    "  CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_LINKER=<ndk>/llvm/bin/aarch64-unknown-linux-ohos-clang \\\n"
    "    cargo build --release --manifest-path core-rs/Cargo.toml --target aarch64-unknown-linux-ohos\n"
    "Rather than link a stub, this stops.")
endif()

add_library(pingzhu_core STATIC IMPORTED)
set_target_properties(pingzhu_core PROPERTIES IMPORTED_LOCATION ${PINGZHU_CORE_LIB})

add_library(pingzhu SHARED napi_init.cpp)

# libace_napi.z.so is the NAPI runtime the ArkTS side talks to; it ships with
# the system image. The Rust core is statically linked, so the .so in the HAP
# carries the engine with it.
target_link_libraries(pingzhu PUBLIC libace_napi.z.so pingzhu_core)
