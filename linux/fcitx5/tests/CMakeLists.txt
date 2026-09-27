# A smoke test that uses the same C ABI and the same installed data directory the
# addon does. Run with:  ctest --test-dir build
add_executable(engine_smoke engine_smoke.c)
target_include_directories(engine_smoke PRIVATE ${PINGZHU_REPO_ROOT}/core-rs/include)
target_link_libraries(engine_smoke PRIVATE ${PINGZHU_CORE_LIB})

add_test(NAME engine_smoke
         COMMAND engine_smoke ${CMAKE_INSTALL_FULL_DATADIR}/pingzhu)
