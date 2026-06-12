#!/bin/bash
# 点餐系统启动脚本
cd "$(dirname "$0")"

echo "╔══════════════════════════════════╗"
echo "║      🍽️  点餐系统启动          ║"
echo "╚══════════════════════════════════╝"

# 获取本机局域网 IP
IP=$(ipconfig getifaddr en0 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)

echo ""
echo "📡 启动 HTTP 服务..."
echo ""

python3 -m http.server 8080 &
PID=$!
echo "  服务已启动 (PID: $PID)"

echo ""
echo "======================================"
echo "  ✅ 电脑上打开: http://localhost:8080"
echo ""
if [ -n "$IP" ]; then
  echo "  📱 手机上打开: http://$IP:8080"
fi
echo "======================================"
echo ""
echo "📱 添加到手机桌面（真 App 体验）:"
echo "  1. 手机连同一个 WiFi"
echo "  2. Safari 打开 http://$IP:8080"
echo "  3. 点底部的分享按钮 📤"
echo "  4. 选择「添加到主屏幕」"
echo ""
echo "💾 数据存在手机浏览器本地，不会丢失"
echo "📤 需要备份点报表页的「导出」按钮"
echo "❌ 按 Ctrl+C 停止服务"
echo ""

# 等待子进程
wait $PID
