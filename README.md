# 时空桌面钟 (PWA)

一个专为 iPad / 移动端展示设计的 PWA 桌面时钟。

## 功能

- 大字号动态时钟（约占屏幕 50%）
- 天气信息：当前天气、今日最高/最低温
- 未来 3 天天气预报
- 空气质量（AQI + PM2.5）
- 月历视图（高亮当天）
- PWA 安装与离线缓存

## 运行方式

在项目目录启动一个静态服务器（必须使用 HTTP 服务，不能直接双击文件）：

```powershell
cd G:\AIAgent\pwa-desk-clock
python -m http.server 8080
```

然后访问：`http://localhost:8080`

## 说明

- 天气/AQI数据源：Open-Meteo API（无需 key）
- 默认会请求定位权限；拒绝后将回退到上海坐标
- 可在 iPad Safari 中“添加到主屏幕”作为 PWA 使用
