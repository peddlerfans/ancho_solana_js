// plugins/element-plus.client.js

import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ElementPlus from 'element-plus'

// 导入 Element Plus 样式 (请根据您的需求选择 Light 或 Dark)
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css' // 如果需要暗黑主题

export default defineNuxtPlugin((nuxtApp) => {
    // 1. 注册 Element Plus 主体
    nuxtApp.vueApp.use(ElementPlus, {
        // 如果需要语言配置
        // locale: ...
    })

    // 2. 注册 Element Plus 图标
    for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
        nuxtApp.vueApp.component(key, component)
    }
})