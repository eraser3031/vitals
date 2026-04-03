{
  "targets": [
    {
      "target_name": "corner_radius",
      "sources": ["corner_radius.mm"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "conditions": [
        [
          "OS=='mac'",
          {
            "xcode_settings": {
              "CLANG_CXX_LANGUAGE_STANDARD": "c++17",
              "OTHER_CFLAGS": ["-ObjC++", "-fno-objc-arc"],
              "OTHER_LDFLAGS": [
                "-framework Cocoa",
                "-framework AppKit"
              ]
            }
          }
        ]
      ]
    }
  ]
}
