import { defineStore } from 'pinia'

export const useLogStore = defineStore('log', {
  state: () => ({
    logs: []
  }),
  
  actions: {
    addLog(log) {
      this.logs.push(log)
      // 限制日志数量，防止内存占用过大
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-1000)
      }
    },
    
    clearLogs() {
      this.logs = []
    }
  }
}) 