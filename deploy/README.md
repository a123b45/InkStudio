# InkStudio — Ubuntu Server 部署说明

## 环境

- Ubuntu 22.04+（已在 22.04.5 验证流程）
- 需要 Docker（没有就先装）

## 快速开始

```bash
git clone -b Ubuntu-Server https://github.com/a123b45/InkStudio.git /data/inkstudio
cd /data/inkstudio/deploy
chmod +x start.sh stop.sh install-docker.sh list-users.sh

# 1) 未安装 Docker 时（只需一次）
sudo ./install-docker.sh

# 2) 启动
./start.sh
```

## 访问

| 服务 | 端口 |
|------|------|
| Web | `http://公网IP:8080` |
| API | `http://公网IP:5000` |
| Mongo Express | `http://公网IP:8081` |

`deploy/.env` 里的 `DEPLOY_HOST` 请填本机公网 IP（首次 `start.sh` 会尝试自动探测）。

## 防火墙

腾讯云安全组 / `ufw` 放行 **8080、5000、8081**。

```bash
ufw allow 8080/tcp
ufw allow 5000/tcp
ufw allow 8081/tcp
```

## 常用命令

```bash
./stop.sh
docker compose logs -f api
docker compose ps
./list-users.sh
```

## 与 RockyLinux-Server 的区别

| 项目 | Ubuntu-Server | RockyLinux-Server |
|------|---------------|-------------------|
| 系统 | Ubuntu 22.04+ | Rocky Linux |
| Docker 安装 | `deploy/install-docker.sh` | 需自行安装 / 已有 Docker |
| 启动 | 同样 `./start.sh`（含 Docker 检测） | `./start.sh` |
