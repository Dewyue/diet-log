# 饮食日志

以月历为核心的个人饮食追踪工具：按餐记录热量与宏量，对照每日目标判断「是否到位」。数据保存在本机浏览器，可导出/导入同步。

风格与交互对齐 [健身打卡](https://github.com/Dewyue/fitness-log)，主色为 Apple Health 风格橙色。

## 功能

- 月历：格子显示当日热量与到位状态（绿点到位 / 灰点未到位）
- 按餐记录：早餐 / 午餐 / 晚餐 / 加餐，热量 + 蛋白/碳水/脂肪
- 到位判定：热量落在目标容差内 + 宏量达标 + 必吃餐次齐全
- 设置：自定义每日目标、热量容差、宏量上限、必吃餐次
- 导入：快捷指令 JSON、剪贴板、URL 深链、日历 `.ics`
- 跨设备同步：JSON 复制/粘贴或文件导入导出
- PWA：可添加到手机主屏幕

## 本地开发

```bash
bun install
bun run dev
```

## 构建

```bash
bun run build
```

## 部署说明

推送到 `main` 分支后，GitHub Actions 会构建并发布到 GitHub Pages（`VITE_BASE_PATH=/diet-log/`）。

部署后地址示例：`https://dewyue.github.io/diet-log/`

> 数据仍保存在用户手机/浏览器本地，不经过服务器。

---

## 快捷指令：AI 拍照 → 写入饮食日志

你已有「拍照识别热量并写入日历」的快捷指令时，建议在末尾增加一步，把结构化结果发给本网页。

### 推荐事件 / 文本格式（日历备注）

```text
标题：午餐 · 鸡胸饭
备注：热量 650kcal | 蛋白 45g | 碳水 60g | 脂肪 18g
```

导出日历为 `.ics` 后，在设置页「日历 ICS 导入」上传或粘贴即可。同日同名同热量且来源为 ics 的记录会自动去重。

### 推荐 JSON（剪贴板或深链）

```json
{
  "date": "2026-07-17",
  "meal": "lunch",
  "name": "鸡胸饭",
  "calories": 650,
  "protein": 45,
  "carbs": 60,
  "fat": 18
}
```

`meal` 可选：`breakfast` | `lunch` | `dinner` | `snack`（也可用中文「午餐」等）。

### 快捷指令改造示例

1. 用现有 AI 动作得到菜名与营养数字  
2. **文本** 拼出上面的 JSON  
3. 任选其一：  
   - **复制到剪贴板** → 打开饮食日志 → 设置「导入这一餐」或某日「粘贴导入」  
   - **打开 URL**（部署后替换域名）：

```text
https://dewyue.github.io/diet-log/?import=<URL编码后的JSON>
```

Safari「快捷指令」里可用「URL」+「编码」动作生成链接，再「打开 URL」。网页会弹出确认表单，保存后写入本地。

## 网页内拍照识别

1. 打开 **设置 → 拍照识别热量**
2. 选择 **Gemini**（推荐）或 **OpenAI**，填入自己的 API Key 并保存  
   - Gemini：https://aistudio.google.com/apikey  
   - OpenAI：https://platform.openai.com/api-keys  
3. 在某日详情点 **拍照识别热量** → 拍照或选图 → 核对预填结果后保存

Key 只存在本机浏览器；识别时图片会直接发给对应云端模型（不经过本站服务器）。估算结果仅供参考，请人工确认后再写入。
