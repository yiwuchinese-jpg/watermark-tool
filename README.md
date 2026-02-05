# 在线水印工具 (Online Watermark Tool)

这是一个基于 Node.js, Express, Sharp 和 FFmpeg 构建的在线水印处理工具。支持图片和视频的 Logo 添加、平铺水印等功能。

## 🚀 极速部署指南 (Render)

你可以使用 Render 免费部署本项目。Render 提供免费的 Web 服务托管，且原生支持 Docker。

### 步骤 1: 上传代码到 GitHub
1. 在 GitHub 上创建一个新仓库（例如 `watermark-app`）。
2. 将本项目的所有文件推送到该仓库。

### 步骤 2: 在 Render 上部署
1. 访问 [Render Dashboard](https://dashboard.render.com/) 并注册/登录。
2. 点击右上角的 **"New +"** 按钮，选择 **"Blueprint"**。
3. 连接你的 GitHub 账号，并选择你刚才创建的 `watermark-app` 仓库。
4. Render 会自动检测到 `render.yaml` 文件。
5. 点击 **"Apply"**。

☕️ **这就完成了！**  
Render 会自动构建 Docker 镜像并启动服务。构建过程可能需要几分钟。完成后，你会获得一个 `https://xxxx.onrender.com` 的网址，这就是你的线上工具地址。

## 🛠 本地运行

如果你想在本地运行：

1. 确保安装了 Node.js。
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动服务：
   ```bash
   npm start
   ```
4. 访问 `http://localhost:3000`

## ⚠️ 注意事项
* Render 的免费实例会在闲置 15 分钟后自动休眠（Spin Down），再次访问时可能需要几十秒的启动时间。
* 上传的文件是临时的，服务重启后会丢失（因为使用的是临时文件系统）。
