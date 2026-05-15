import { createApp } from 'vue'
import App from './App.vue'
import './styles.css'
import { siteConfig } from './siteConfig'

document.title = siteConfig.siteTitle
createApp(App).mount('#app')
