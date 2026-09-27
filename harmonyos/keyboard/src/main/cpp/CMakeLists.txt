# 平注的 HarmonyOS 原生模組。
#
# 這一層的責任只有一個：把 C ABI 包成 ArkTS 能呼叫的 NAPI 模組。
# 解碼在 core-rs/ 裡，跟 Windows、Android、macOS 用的是同一份。
#
# 這一版還沒有連結 Rust 靜態庫——先證明 NAPI 本身編得過、跑得起來，
# 再把核心接上。**分階段，因為今天已經學到「安靜的失敗」有多貴。**
cmake_minimum_required(VERSION 3.5.0)
project(pingzhu)

set(CMAKE_CXX_STANDARD 17)
set(NATIVERENDER_ROOT_PATH ${CMAKE_CURRENT_SOURCE_DIR})

include_directories(${NATIVERENDER_ROOT_PATH})
include_directories(${NATIVERENDER_ROOT_PATH}/include)

add_library(pingzhu SHARED napi_init.cpp)

# libace_napi.z.so is the NAPI runtime the ArkTS side talks to. It ships with
# the system image, not with this module.
target_link_libraries(pingzhu PUBLIC libace_napi.z.so)
