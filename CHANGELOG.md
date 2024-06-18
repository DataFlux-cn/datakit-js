# Changelog

## v3.1.16

- fix: CLS cumulatedValue bug
- fix: add injectTraceHeader context
- fix: update license

## v3.1.15

- feat: add injectTraceHeader configuration
- fix: interactiontonextPaint selector  bug
- fix: 处理hash 问题
- feat: add trackResum handler
- fix: getSelectorFromElement add isConnected handler
- fix: 修改resourceCollection validateEntry 逻辑
- fix: action duration为负数bug
- fix: add source:browser to all RUM Events
- fix: cls detached node 内存泄露bug
- fix: update script
- fix: doc
- feat: 添加部分md 文档

## v3.1.14

- fix: 修复 rum logs 类型定义

## v3.1.13

- fix: 添加typescript 注解
- fix: 修复typescript 定义错误
- fix: 修改hash 模式path 获取方式
- fix: buildUrlContext path group bug
- fix: 添加iframe 屏蔽信息
- feat: updrade learn version

## v3.1.12

- feat: 修改webpack 版本
- feat: 添加第三方cookie 支持
- fix: 添加 resource url dataURL 处理
- fix: 忽略滚动对 action 的处理
- feat: add resource collection decodeSize,encodeSize
- fix: trackCumulativeLayoutShift target element connected

## v3.1.11

- feat:  Optimize DOM iteration
- fix: fix unexpected session renewal after expire() ([#2632](https://gitlab.jiagouyun.com/cloudcare/dataflux-rum-sdk-javscript/pull/2632))
- fix: 添加 error causes 字段
- fix: add getNodePrivacyLevel cache handler

## v3.1.10

- fix: update npmignore

## v3.1.9

- fix: add package.json repository directory
- fix: types
- fix: update ignore
- feat: add types d.ts file
- merge test unit branch
- feat: update bebel config exclude to ignore
- feat: 添加 exclude spec file
- feat: add test unit
- fix: remove TODO

## v3.1.8

- fix: method undefined
- fix: update worker bug
- fix: observable first function handler
- feat: add view metric sampled_for_replay
- feat: add config metric
- feat: add ds_store ignore
- fix: 重复shadowroot bug

## v3.1.7

- fix: stop session bug

## v3.1.6

- fix: 修改view_url_query 逻辑
- fix: .ds_store
- fix: xx
- fix: remove pagestate isTrust hanler
- updrade verstion to 3.1.5
- fix: update changelog

## v3.1.5

- fix: add deviceInfo monitor
- fix: headless bug
- add public dataway configuration
- feat: add resource filter handler
- fix: isSafir to webview bug
- fix: remove resource console
- fix: fix first_paint_time collection bug

## v3.1.4

- fix: \_dd to \_gc
- updrade: changelog

## v3.1.3

- feat: 1. add cumulative_layout_shift_target_selector, first_input_target_selector,interaction_to_next_paint_target_selector metric
- feat: add config to json send data
- feat: update changelog
- feat: add storeContextsToLocal configuration to localstorage global context
- fix: fix memory leak when using shadow dom

## v3.1.2

- feat: add storeContextsToLocal configuration to localstorage global context
- fix: fix memory leak when using shadow dom

## v3.1.1

- fix: bug
- feat: add storeContextsToLocal configuration to localstorage global context
- fix: fix memory leak when using shadow dom

## v3.1.1

- fix: remove console
- fix: update session replay deflate handler
- fix: update changelog

## v3.1.0

- fix: clickCollection bug
- feat: add view scroll metric
- fix: remove style tag child serialize
- feat: add csp md
- fix: isHashAnAnchor hash handler
- fix: serialize isShadow remove
- fix: add shadowroot bug
- feat: add lts version handler
- fix: update publish cdn handler
- fix: update logger telemetry
- add telemetry

## v3.0.29

- fix: serialze bug
- feat: add monitor callback handler
- fix: 修改 generate-changelog.js
- comment: add changelog
- feat: updrade version
- fix: update ci
- fix: 修改 command ci cmd help
- feat: 添加 changelog 配置
- feat: update changlog ci
- feat: add changelog ci
- fix: update esm modules handler
- fix: esm handler
- fix: add cssEscape tagName
