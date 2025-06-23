<template>
  <div class="app">
    <header class="header">
      <h1>iOS Log Viewer</h1>
      <div class="filter-box">
        <div class="search-box" style="display: flex; gap: 0.5rem; align-items: center;">
          <input 
            v-model="searchText" 
            type="text" 
            placeholder="搜索日志..." 
            @input="handleSearch"
          />
          <button class="clear-btn" @click="handleClearLogs">清空</button>
        </div>
        <div class="level-filter">
          <label class="level-checkbox" v-for="level in logLevels" :key="level">
            <input 
              type="checkbox" 
              v-model="selectedLevels" 
              :value="level"
              @change="handleLevelFilter"
            >
            <span class="level-tag" :class="level">{{ level }}</span>
          </label>
        </div>
      </div>
      <div v-if="!isConnected" class="reconnect-box">
        <button @click="connectWebSocket" class="reconnect-btn">重新连接</button>
      </div>
    </header>
    <main class="main">
      <div class="log-container" ref="logContainer" @scroll="handleScroll">
        <div 
          v-for="(log, index) in filteredLogs" 
          :key="index" 
          class="log-item"
          :class="{ 'highlight': isHighlighted(log) }"
          @click="copyLog(log)"
        >
          <span class="timestamp">{{ formatTimestamp(log.timestamp) }}</span>
          <span class="level" :class="log.level">{{ log.level }}</span>
          <span class="message" v-html="highlightText(log.message)"></span>
        </div>
      </div>
      <div 
        v-if="showNewLogsBubble" 
        class="new-logs-bubble"
        @click="scrollToBottom"
      >
        {{ newLogsCount }} 条新日志
      </div>
    </main>
    <div v-if="showToast" class="toast" :class="toastType">
      {{ toastMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useLogStore } from '@/stores/log'
import { highlightText } from '@/utils/highlight'

const logStore = useLogStore()
const searchText = ref('')
const logContainer = ref(null)
const ws = ref(null)
const isConnected = ref(false)
const showToast = ref(false)
const toastMessage = ref('')
const toastType = ref('info')
const reconnectAttempts = ref(0)
const maxReconnectAttempts = 10
const reconnectTimer = ref(null)
const RECONNECT_INTERVAL = 5000 // 5秒

// 日志级别筛选相关
const logLevels = ['info', 'warning', 'error']
const selectedLevels = ref(['info', 'warning', 'error'])

// 新消息提示相关
const showNewLogsBubble = ref(false)
const newLogsCount = ref(0)
const isAtBottom = ref(true)
const lastScrollTop = ref(0)

const filteredLogs = computed(() => {
  return logStore.logs.filter(log => {
    // 检查日志级别
    if (!selectedLevels.value.includes(log.level)) {
      return false
    }
    // 检查搜索文本
    if (searchText.value) {
      return log.message.toLowerCase().includes(searchText.value.toLowerCase())
    }
    return true
  })
})

const isHighlighted = (log) => {
  if (!searchText.value) return false
  return log.message.toLowerCase().includes(searchText.value.toLowerCase())
}

const handleSearch = () => {
  // 搜索时自动滚动到第一个匹配项
  nextTick(() => {
    const firstHighlighted = document.querySelector('.log-item.highlight')
    if (firstHighlighted) {
      firstHighlighted.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

const showToastMessage = (message, type = 'info') => {
  toastMessage.value = message
  toastType.value = type
  showToast.value = true
  setTimeout(() => {
    showToast.value = false
  }, 3000)
}

const connectWebSocket = () => {
  // 如果存在活跃的连接，先关闭它
  if (ws.value) {
    const state = ws.value.readyState
    console.log('Current WebSocket state:', state)
    
    if (state !== WebSocket.CLOSED) {
      console.log('Closing existing connection')
      try {
        ws.value.onclose = null // 移除onclose处理程序，避免触发重连
        ws.value.close(1000, 'Connection closed by client')
      } catch (error) {
        console.error('Error closing existing connection:', error)
      }
    }
    
    // 等待连接关闭
    const checkClose = setInterval(() => {
      if (ws.value.readyState === WebSocket.CLOSED) {
        clearInterval(checkClose)
        ws.value = null
        createNewConnection()
      }
    }, 100)
    
    // 5秒后强制清理
    setTimeout(() => {
      clearInterval(checkClose)
      ws.value = null
      createNewConnection()
    }, 5000)
  } else {
    createNewConnection()
  }
}

const createNewConnection = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const wsUrl = `${protocol}//${window.location.hostname}:8080/ws`
  
  console.log('Creating new WebSocket connection')
  ws.value = new WebSocket(wsUrl)
  
  // 设置连接超时
  const connectionTimeout = setTimeout(() => {
    if (ws.value && ws.value.readyState === WebSocket.CONNECTING) {
      console.log('Connection timeout')
      cleanupWebSocket()
      if (reconnectAttempts.value < maxReconnectAttempts) {
        showToastMessage('连接超时，正在重试...', 'warning')
        scheduleReconnect()
      } else {
        showToastMessage('连接失败，请点击重连按钮重新连接', 'error')
      }
    }
  }, 5000) // 5秒超时
  
  ws.value.onopen = () => {
    console.log('WebSocket connected')
    clearTimeout(connectionTimeout)
    isConnected.value = true
    reconnectAttempts.value = 0
    showToastMessage('WebSocket连接成功', 'success')
  }
  
  ws.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data)
      logStore.addLog(data)
      
      // 如果不在底部，显示新消息提示
      if (!isAtBottom.value) {
        newLogsCount.value++
        showNewLogsBubble.value = true
      } else {
        // 如果在底部，自动滚动
        nextTick(() => {
          if (logContainer.value) {
            logContainer.value.scrollTop = logContainer.value.scrollHeight
          }
        })
      }
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  }
  
  ws.value.onclose = (event) => {
    console.log('WebSocket closed', event)
    clearTimeout(connectionTimeout)
    isConnected.value = false
    
    // 如果连接已经被清理，不再尝试重连
    if (!ws.value) return
    
    if (reconnectAttempts.value < maxReconnectAttempts) {
      showToastMessage('连接断开，正在重试...', 'warning')
      cleanupWebSocket()
      scheduleReconnect()
    } else {
      console.log('Max reconnection attempts reached')
      showToastMessage('连接失败，请点击重连按钮重新连接', 'error')
      cleanupWebSocket()
    }
  }
  
  ws.value.onerror = (error) => {
    console.error('WebSocket error:', error)
    clearTimeout(connectionTimeout)
    if (reconnectAttempts.value < maxReconnectAttempts) {
      showToastMessage('连接发生错误，正在重试...', 'warning')
      cleanupWebSocket()
      scheduleReconnect()
    } else {
      showToastMessage('连接失败，请点击重连按钮重新连接', 'error')
      cleanupWebSocket()
    }
  }
}

// 重连相关
const scheduleReconnect = () => {
  // 如果已经达到最大重试次数，不再重连
  if (reconnectAttempts.value >= maxReconnectAttempts) {
    console.log('Max reconnection attempts reached, stopping auto reconnect')
    return
  }
  
  // 清理旧的定时器
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value)
    reconnectTimer.value = null
  }
  
  reconnectTimer.value = setTimeout(() => {
    reconnectAttempts.value++
    connectWebSocket()
  }, RECONNECT_INTERVAL)
}

// 清理WebSocket连接
const cleanupWebSocket = () => {
  console.log('Cleaning up WebSocket connection')
  
  // 清理重连定时器
  if (reconnectTimer.value) {
    clearTimeout(reconnectTimer.value)
    reconnectTimer.value = null
  }
  
  if (ws.value) {
    try {
      // 移除所有事件监听器
      ws.value.onopen = null
      ws.value.onmessage = null
      ws.value.onclose = null
      ws.value.onerror = null
      
      // 关闭连接
      if (ws.value.readyState !== WebSocket.CLOSED) {
        ws.value.close(1000, 'Connection closed by client')
      }
      
      // 强制设置为null，确保垃圾回收
      ws.value = null
    } catch (error) {
      console.error('Error while cleaning up WebSocket:', error)
    }
  }
  
  isConnected.value = false
}

// 格式化时间戳
const formatTimestamp = (timestamp) => {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch (error) {
    console.error('Failed to format timestamp:', error)
    return timestamp
  }
}

// 复制日志内容
const copyLog = async (log) => {
  try {
    const logText = `[${formatTimestamp(log.timestamp)}] [${log.level}] ${log.message}`
    await navigator.clipboard.writeText(logText)
    showToastMessage('日志已复制到剪贴板', 'success')
  } catch (error) {
    console.error('复制失败:', error)
    showToastMessage('复制失败，请重试', 'error')
  }
}

// 处理滚动事件
const handleScroll = () => {
  if (!logContainer.value) return
  
  const container = logContainer.value
  const scrollTop = container.scrollTop
  const scrollHeight = container.scrollHeight
  const clientHeight = container.clientHeight
  
  // 判断是否在底部
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 10
  
  // 如果向上滚动，隐藏新消息提示
  if (scrollTop > lastScrollTop.value) {
    showNewLogsBubble.value = false
    newLogsCount.value = 0
  }
  
  lastScrollTop.value = scrollTop
}

// 滚动到底部
const scrollToBottom = () => {
  if (logContainer.value) {
    logContainer.value.scrollTop = logContainer.value.scrollHeight
    showNewLogsBubble.value = false
    newLogsCount.value = 0
  }
}

// 处理级别筛选变化
const handleLevelFilter = () => {
  nextTick(() => {
    const firstVisible = document.querySelector('.log-item')
    if (firstVisible) {
      firstVisible.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  })
}

const handleClearLogs = () => {
  logStore.clearLogs()
  showToastMessage('日志已清空', 'success')
}

onMounted(() => {
  connectWebSocket()
})

onUnmounted(() => {
  cleanupWebSocket()
})
</script>

<style lang="scss">
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #1e1e1e;
  color: #d4d4d4;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.header {
  padding: 1rem;
  background-color: #252526;
  border-bottom: 1px solid #333;
  
  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #fff;
  }
  
  .filter-box {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
}

.main {
  flex: 1;
  overflow: hidden;
}

.log-container {
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
  
  .log-item {
    padding: 0.5rem;
    border-bottom: 1px solid #333;
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 0.9rem;
    line-height: 1.5;
    cursor: pointer;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: #2a2d2e;
    }
    
    &.highlight {
      background-color: #2a2d2e;
    }
    
    .timestamp {
      color: #6a9955;
      margin-right: 1rem;
    }
    
    .level {
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-size: 0.8rem;
      margin-right: 1rem;
      
      &.info {
        background-color: #0078d4;
        color: #fff;
      }
      
      &.warning {
        background-color: #ffb900;
        color: #000;
      }
      
      &.error {
        background-color: #d13438;
        color: #fff;
      }
    }
    
    .message {
      color: #d4d4d4;
      
      .highlight {
        background-color: #264f78;
        padding: 0.1rem 0.2rem;
        border-radius: 2px;
      }
    }
  }
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #2d2d2d;
}

::-webkit-scrollbar-thumb {
  background: #3c3c3c;
  border-radius: 4px;
  
  &:hover {
    background: #4c4c4c;
  }
}

.reconnect-box {
  margin-top: 1rem;
  text-align: center;
  
  .reconnect-btn {
    padding: 0.5rem 1rem;
    background-color: #0078d4;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    
    &:hover {
      background-color: #106ebe;
    }
  }
}

.toast {
  position: fixed;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 4px;
  color: white;
  font-size: 14px;
  z-index: 1000;
  animation: fadeInOut 3s ease-in-out;
  
  &.info {
    background-color: #0078d4;
  }
  
  &.success {
    background-color: #107c10;
  }
  
  &.warning {
    background-color: #ffb900;
  }
  
  &.error {
    background-color: #d13438;
  }
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translate(-50%, 20px);
  }
  10% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  90% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 20px);
  }
}

.new-logs-bubble {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #0078d4;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  z-index: 1000;
  
  &:hover {
    background-color: #106ebe;
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
}

.search-box {
  width: 100%;
  
  input {
    width: 100%;
    padding: 0.5rem;
    background-color: #3c3c3c;
    border: 1px solid #555;
    border-radius: 4px;
    color: #fff;
    
    &:focus {
      outline: none;
      border-color: #0078d4;
    }
  }
}

.level-filter {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.level-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  
  input[type="checkbox"] {
    display: none;
    
    &:checked + .level-tag {
      opacity: 1;
    }
    
    &:not(:checked) + .level-tag {
      opacity: 0.5;
    }
  }
  
  .level-tag {
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8rem;
    transition: opacity 0.2s;
    
    &.info {
      background-color: #0078d4;
      color: #fff;
    }
    
    &.warning {
      background-color: #ffb900;
      color: #000;
    }
    
    &.error {
      background-color: #d13438;
      color: #fff;
    }
  }
}

.clear-btn {
  padding: 0.5rem 1rem;
  background-color: #d13438;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.2s;
  &:hover {
    background-color: #a4262c;
  }
}
</style> 