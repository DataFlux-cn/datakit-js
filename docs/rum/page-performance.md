# 监控页面性能

不断优化用户体验是所有网站取得长远成功的关键。无论您是一名企业家、营销人员，还是开发者，Web 指标都能帮助您量化网站的体验指数，并发掘改进的机会。

# Google 核心 Web 指标 (Google’s Core Web Vitals)
[Web Vitals](https://web.dev/vitals/) 是 Google 开创的一项新计划，旨在为网络质量信号提供统一指导，这些信号对于提供出色的网络用户体验至关重要。

核心 Web 指标的构成指标会随着时间的推移而发展 。当前针对 2020 年的指标构成侧重于用户体验的三个方面——加载性能、交互性和视觉稳定性——并包括以下指标（及各指标相应的阈值）：

![web-vitals](../assets/web-vitals.avif)

[Largest Contentful Paint (LCP) ](https://web.dev/lcp/):最大内容绘制，测量加载性能。为了提供良好的用户体验，LCP 应在页面首次开始加载后的2.5 秒内发生。

[First Input Delay (FID)](https://web.dev/fid/) ：首次输入延迟，测量交互性。为了提供良好的用户体验，页面的 FID 应为100 毫秒或更短。

[Cumulative Layout Shift (CLS)](https://web.dev/cls/) :累积布局偏移，测量视觉稳定性。为了提供良好的用户体验，页面的 CLS 应保持在 0.1. 或更少。