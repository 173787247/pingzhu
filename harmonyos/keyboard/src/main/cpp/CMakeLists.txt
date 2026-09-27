# 平注的 HarmonyOS 原生模組。
#
# 這一層的責任只有一個：把 C ABI 包成 ArkTS 能呼叫的 NAPI 模組。
# 解碼在 core-rs/ 裡，跟 Windows、Android、macOS 用的是同一份。
cmake_minimum_required(VERSION 3.5.0)
project(pingzhu)

set(CMAKE_CXX_STANDARD 17)
set(NATIVERENDER_ROOT_PATH ${CMAKE_CURRENT_SOURCE_DIR})

# Where the repository root is — found, not counted.
#
# The first version wrote out ../ six times and was off by one, which produced a
# message about a missing file rather than about a wrong path, and cost a CI run
# to notice. Walking up until core-rs appears cannot be off by one.
set(PINGZHU_REPO_ROOT "")
set(_probe ${NATIVERENDER_ROOT_PATH})
foreach(_step RANGE 1 8)
  get_filename_component(_probe ${_probe} DIRECTORY)
  if(EXISTS ${_probe}/core-rs/Cargo.toml)
    set(PINGZHU_REPO_ROOT ${_probe})
    break()
  endif()
endforeach()

if(PINGZHU_REPO_ROOT STREQUAL "")
  message(FATAL_ERROR
    "Could not find core-rs/Cargo.toml by walking up from ${NATIVERENDER_ROOT_PATH}.\n"
    "This file expects to live inside the pingzhu repository.")
endif()

message(STATUS "pingzhu repository root: ${PINGZHU_REPO_ROOT}")

include_directories(${NATIVERENDER_ROOT_PATH})
include_directories(${NATIVERENDER_ROOT_PATH}/include)
include_directories(${PINGZHU_REPO_ROOT}/core-rs/include)

# The Rust core, already cross-compiled by the workflow job that runs before
# this one. If it is missing, stop with a message that says how to produce it —
# rather than linking a shared library that silently exports a stub.
set(PINGZHU_CORE_LIB
  ${PINGZHU_REPO_ROOT}/core-rs/target/aarch64-unknown-linux-ohos/release/libpingzhu_core.a)

if(NOT EXISTS ${PINGZHU_CORE_LIB})
  message(FATAL_ERROR
    "libpingzhu_core.a is not at ${PINGZHU_CORE_LIB}\n"
    "Cross-compile it first:\n"
    "  rustup target add aarch64-unknown-linux-ohos\n"
    "  CARGO_TARGET_AARCH64_UNKNOWN_LINUX_OHOS_LINKER=<ndk>/llvm/bin/aarch64-unknown-linux-ohos-clang \\\n"
    "    cargo build --release --manifest-path core-rs/Cargo.toml --target aarch64-unknown-linux-ohos")
endif()

add_library(pingzhu_core STATIC IMPORTED)
set_target_properties(pingzhu_core PROPERTIES IMPORTED_LOCATION ${PINGZHU_CORE_LIB})

add_library(pingzhu SHARED napi_init.cpp)

# libace_napi.z.so is the NAPI runtime the ArkTS side talks to; it ships with the
# system image. The Rust core is linked statically, so the .so inside the HAP
# carries the engine with it — which is also why the HAP went from 8K to 1.3M.
target_link_libraries(pingzhu PUBLIC libace_napi.z.so pingzhu_core)
