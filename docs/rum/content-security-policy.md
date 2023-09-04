# Content Security Policy
HTTP 响应头 Content-Security-Policy 允许站点管理者控制用户代理能够为指定的页面加载哪些资源。除了少数例外情况，设置的政策主要涉及指定服务器的源和脚本结束点。这将帮助防止跨站脚本攻击（Cross-Site Script）。
详情参考 [Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy)

## 多内容安全策略
CSP 允许在一个资源中指定多个策略，包括通过 [Content-Security-Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy) 头，以及 [Content-Security-Policy-Report-Only](https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Content-Security-Policy-Report-Only) 头，和 [<meta>](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/meta) 组件。

## 是列子
```js
// header
Content-Security-Policy: connect-src http://example.com/;
                         script-src http://example.com/

// meta tag
<meta http-equiv="Content-Security-Policy" content="connect-src http://example.com/;
                         script-src http://example.com/">
```
## 如何在使用 CSP 的网站应用中，接入 RUM SDK

如果您的网站应用正在使用 CSP， 接入观测云 RUM SDK 之后，可能会在浏览器中出现安全违规的提示，你需要将以下 URL 添加到对应的指令中

### Datakit 上报 URLs
依赖于 [RUM SDK 初始化配置]()中的 `datakitOrigin` 选项：
```js
 DATAFLUX_RUM.init({
      ...
      datakitOrigin: 'https://test.dk.com',
      ...
    })
```
在 CSP 安全指令中，请添加如下条目：
```js
    connect-src https://*.dk.com
```

### Session Replay worker
如果你开启了 RUM SDK [Session Replay]() 功能,请确保通过添加以下 worker-src 条目:

```json
 worker-src blob:;
```

### CDN 地址
如果您正在使用 [CDN 异步]() 或 [CDN 同步]() 的方式引入 RUM SDK，请添加以下 script-src 条目：
```json
script-src https://static.guance.com
```