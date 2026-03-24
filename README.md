# 时空桌面钟 (PWA)

一个面向大屏/平板场景的纯前端 PWA 桌面时钟：上半区为超大数字时钟（含公历与农历），下半区为天气与空气质量卡片。

## 当前功能

- 上下两栏布局
  - 上栏：超大数字时钟
  - 左上角：公历日期 + 农历
  - 右下角：系统时区
  - 下栏：天气与空气质量卡片
- 天气信息
  - 当前天气、体感温度、湿度、紫外线
  - AQI 与 PM2.5
  - 未来预报自适应：宽度不足显示未来 3 日，宽度足够显示未来 7 日
- 设置面板
  - 主题切换：`aurora` / `sunrise` / `mono`
  - 字体切换：`avenir` / `georgia` / `trebuchet`
  - 天气自动刷新间隔：5/10/15/30 分钟
  - 是否显示秒数
- PWA 能力
  - `manifest.webmanifest`
  - `service worker` 资源缓存与离线壳支持

## 项目结构

```text
pwa-desk-clock/
  ├─ index.html              # 页面结构（时钟区、天气卡、设置面板）
  ├─ styles.css              # 全量样式（主题、布局、响应式、动画）
  ├─ app.js                  # 业务逻辑（时钟、定位、天气、设置、渲染）
  ├─ sw.js                   # Service Worker 缓存策略
  ├─ manifest.webmanifest    # PWA 清单
  ├─ assets/
  │  └─ icon.svg             # 应用图标
  └─ README.md
```

## 本地运行

> 这是静态前端项目，请通过本地 HTTP 服务访问，不要直接双击 `index.html`。

```powershell
cd G:\AIAgent\pwa-desk-clock
python -m http.server 8080
```

访问：`http://localhost:8080`

## 数据与定位策略

- 定位：优先浏览器 `Geolocation API`
  - 用户拒绝或失败时，回退到上海坐标：`31.2304, 121.4737`
- 天气数据源：
  - 中国地区优先尝试和风天气（QWeather）
  - 失败时回退到 Open-Meteo
- 空气质量：
  - QWeather 路径下使用和风空气质量接口
  - Open-Meteo 路径下使用 Open-Meteo Air Quality 接口

## 缓存与离线说明

`sw.js` 当前策略：

- App Shell（`index.html` / `styles.css` / `app.js` / `manifest` / `icon`）预缓存
- Open-Meteo 请求使用“网络优先，失败回退缓存”
- 其它静态资源优先走缓存

注意：QWeather 域名请求当前未被 `isApi` 逻辑单独标记为网络优先缓存分支。

## 配置持久化

设置项通过 `localStorage` 保存：

- key: `desk-clock-settings-v1`
- 字段：`theme`、`font`、`refreshMinutes`、`showSeconds`

## 开发备注

- 当前代码中仍保留了部分历史日历/表盘相关逻辑的兼容分支（不会在现有页面结构中显示）。
- 若后续继续精简，可清理未使用的 DOM 查询与旧渲染函数。