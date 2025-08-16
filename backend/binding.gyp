{
  "targets": [
    {
      "target_name": "clob_binding",
      "sources": [ "src/clob_binding.cpp" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags!": [ "-fno-exceptions" ],
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [ "NAPI_DISABLE_CPP_EXCEPTIONS" ],
      "conditions": [
        ['OS=="mac"', {
          "xcode_settings": {
            "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
            "CLANG_CXX_LIBRARY": "libc++",
            "MACOSX_DEPLOYMENT_TARGET": "10.7"
          },
          "libraries": [
            "-L<!@(node -p \"require('path').resolve('../clob/target/release')\")",
            "-lclob"
          ]
        }],
        ['OS=="linux"', {
          "cflags": [ "-std=c++17" ],
          "cflags_cc": [ "-std=c++17" ],
          "libraries": [
            "-L<!@(node -p \"require('path').resolve('../clob/target/release')\")",
            "-lclob"
          ]
        }],
        ['OS=="win"', {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1
            }
          },
          "libraries": [
            "-L<!@(node -p \"require('path').resolve('../clob/target/release')\")",
            "-lclob"
          ]
        }]
      ]
    }
  ]
} 