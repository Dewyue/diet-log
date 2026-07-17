# 饮食日志

以月历为核心的个人饮食追踪：按餐记热量与宏量，对照每日目标看是否「到位」。数据存在本机浏览器。

在线：https://dewyue.github.io/diet-log/

## 功能

- 月历：当日热量、到位绿点 / 未到位灰点
- 手动按餐记录：早餐 / 午餐 / 晚餐 / 加餐
- 到位判定：热量容差 + 宏量达标 + 必吃餐次
- 设置：每日目标、简单备份、清空

## 本地开发

```bash
bun install
bun run dev
```

## 构建与部署

```bash
bun run build
```

推送到 `main` 后 GitHub Actions 发布到 Pages（`VITE_BASE_PATH=/diet-log/`）。
